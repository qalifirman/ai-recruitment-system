import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';

const app = new Hono().basePath('/functions/v1/make-server-76bea622');

// Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function initStorage() {
  const bucketName = 'make-76bea622-resumes';
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
  
  if (!bucketExists) {
    await supabase.storage.createBucket(bucketName, { public: false });
    console.log('Created resumes bucket');
  }
}

initStorage().catch(console.error);

async function verifyAuth(request: Request) {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (!user || error) return null;
  return user;
}

// ========================================
// AUTH ROUTES
// ========================================

app.post('/signup', async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();
    
    if (!email || !password || !name || !role) return c.json({ error: 'Missing required fields' }, 400);
    if (!['hr', 'applicant'].includes(role)) return c.json({ error: 'Invalid role' }, 400);
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role },
      email_confirm: true 
    });
    
    if (error) return c.json({ error: error.message }, 400);
    
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      email,
      name,
      role
    });

    if (profileError) return c.json({ error: 'Failed to create profile record' }, 500);
    
    return c.json({ user: { id: data.user.id, email, name, role } });
  } catch (error) {
    return c.json({ error: 'Sign up failed' }, 500);
  }
});

// ========================================
// USER ROUTES
// ========================================

app.get('/user/profile', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (error || !profile) return c.json({ error: 'Profile not found' }, 404);
    
    return c.json({ profile });
  } catch (error) {
    return c.json({ error: 'Failed to get profile' }, 500);
  }
});

app.put('/user/profile', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const updates = await c.req.json();
    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update({ name: updates.name })
      .eq('id', user.id)
      .select()
      .single();

    if (error) return c.json({ error: 'Failed to update profile' }, 500);
    return c.json({ profile: updatedProfile });
  } catch (error) {
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

// ========================================
// JOB ROUTES (HR Only)
// ========================================

app.post('/jobs', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'hr') return c.json({ error: 'Only HR managers can create jobs' }, 403);
    
    const jobData = await c.req.json();
    
    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        hr_id: user.id,
        title: jobData.title,
        description: jobData.description,
        // FIX: Accept both requirements (db) and requiredSkills (frontend)
        requirements: jobData.requirements || jobData.requiredSkills || [],
        salary_range: jobData.salary,
        department: jobData.department,
        employment_type: jobData.employmentType,
        required_years_exp: jobData.requiredYearsExp,
        location: jobData.location,
        status: 'active'
      })
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ job });
  } catch (error) {
    return c.json({ error: 'Failed to create job' }, 500);
  }
});

app.get('/jobs', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    
    let query = supabase.from('jobs').select('*');
    if (profile?.role === 'hr') query = query.eq('hr_id', user.id);
    else query = query.eq('status', 'active');

    const { data: jobs, error } = await query;
    if (error) throw error;
    
    const mappedJobs = (jobs || []).map((job: any) => ({
      ...job,
      employmentType: job.employment_type,
      salary: job.salary_range,
      requiredYearsExp: job.required_years_exp || 0,
      // FIX: Ensure frontend receives requiredSkills
      requiredSkills: job.requirements || []
    }));
    
    return c.json({ jobs: mappedJobs });
  } catch (error) {
    return c.json({ error: 'Failed to get jobs' }, 500);
  }
});

app.get('/jobs/:id', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { data: job, error } = await supabase.from('jobs').select('*').eq('id', c.req.param('id')).single();
    if (error || !job) return c.json({ error: 'Job not found' }, 404);

    const mappedJob = {
      ...job,
      employmentType: job.employment_type,
      salary: job.salary_range,
      requiredYearsExp: job.required_years_exp || 0,
      requiredSkills: job.requirements || []
    };
    
    return c.json({ job: mappedJob });
  } catch (error) {
    return c.json({ error: 'Failed to get job' }, 500);
  }
});

app.put('/jobs/:id', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const jobId = c.req.param('id');
    const updates = await c.req.json();

    const { data: job, error } = await supabase
      .from('jobs')
      .update({
        title: updates.title,
        description: updates.description,
        // FIX: Update using either field
        requirements: updates.requirements || updates.requiredSkills,
        salary_range: updates.salary,
        department: updates.department,
        employment_type: updates.employmentType,
        required_years_exp: updates.requiredYearsExp,
        location: updates.location,
        status: updates.status
      })
      .eq('id', jobId)
      .eq('hr_id', user.id)
      .select()
      .single();

    if (error || !job) return c.json({ error: 'Job not found or unauthorized' }, 404);
    
    const mappedJob = {
      ...job,
      employmentType: job.employment_type,
      salary: job.salary_range,
      requiredYearsExp: job.required_years_exp || 0,
      requiredSkills: job.requirements || []
    };

    return c.json({ job: mappedJob });
  } catch (error) {
    return c.json({ error: 'Failed to update job' }, 500);
  }
});

app.delete('/jobs/:id', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { error } = await supabase.from('jobs').delete().eq('id', c.req.param('id')).eq('hr_id', user.id);
    if (error) return c.json({ error: 'Failed to delete job' }, 403);
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to delete job' }, 500);
  }
});

// ========================================
// RESUME & APP ROUTES (Unchanged Logic mostly)
// ========================================

app.post('/resumes/upload', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    if (!file) return c.json({ error: 'No file' }, 400);
    
    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    const fileBuffer = await file.arrayBuffer();
    
    const { error } = await supabase.storage.from('make-76bea622-resumes').upload(fileName, fileBuffer, { contentType: file.type });
    if (error) return c.json({ error: 'Upload failed' }, 500);
    
    const { data: urlData } = await supabase.storage.from('make-76bea622-resumes').createSignedUrl(fileName, 31536000);
    return c.json({ path: fileName, url: urlData?.signedUrl, name: file.name, type: file.type });
  } catch (error) { return c.json({ error: 'Upload error' }, 500); }
});

app.post('/resumes', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { filename, filePath, fileUrl, parsedData } = await c.req.json();
    
    await supabase.from('resumes').update({ is_active: false }).eq('user_id', user.id);
    const { data: resume, error } = await supabase.from('resumes').insert({
      user_id: user.id, file_name: filename, file_path: filePath, file_url: fileUrl, parsed_data: parsedData, is_active: true
    }).select().single();
    
    if (error) throw error;
    return c.json({ resume: { ...resume, isActive: resume.is_active } });
  } catch (error) { return c.json({ error: 'Save failed' }, 500); }
});

app.get('/resumes', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: resumes, error } = await supabase.from('resumes').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) throw error;
    return c.json({ resumes: resumes.map(r => ({ ...r, isActive: r.is_active, parsedData: r.parsed_data })) });
  } catch (error) { return c.json({ error: 'Fetch failed' }, 500); }
});

app.put('/resumes/:id/activate', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    await supabase.from('resumes').update({ is_active: false }).eq('user_id', user.id);
    await supabase.from('resumes').update({ is_active: true }).eq('id', c.req.param('id')).eq('user_id', user.id);
    return c.json({ success: true });
  } catch (error) { return c.json({ error: 'Activate failed' }, 500); }
});

app.delete('/resumes/:id', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const resumeId = c.req.param('id');
    const { data: resume } = await supabase.from('resumes').select('file_path').eq('id', resumeId).eq('user_id', user.id).single();
    if (resume) await supabase.storage.from('make-76bea622-resumes').remove([resume.file_path]);
    await supabase.from('resumes').delete().eq('id', resumeId).eq('user_id', user.id);
    return c.json({ success: true });
  } catch (error) { return c.json({ error: 'Delete failed' }, 500); }
});

app.post('/applications', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const appData = await c.req.json();
    
    const { data: application, error } = await supabase.from('applications').insert({
        job_id: appData.jobId,
        applicant_id: user.id,
        resume_url: appData.resumeUrl || null,
        status: 'applied',
        years_of_experience: appData.yearsOfExperience || 0,
        match_score: appData.matchScore || 0,
        skill_match_score: appData.skillMatch || 0,
        text_similarity: appData.textSimilarity || 0,
        matched_skills: appData.matchedSkills || [],
        missing_skills: appData.missingSkills || [],
        explanation: appData.explanation || ''
      }).select().single();

    if (error) return c.json({ error: 'Submission failed' }, 500);
    return c.json({ application });
  } catch (error) { return c.json({ error: 'Error submitting' }, 500); }
});

app.get('/applications', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    let query = supabase.from('applications').select('*, jobs(*), profiles(*)');

    if (profile?.role === 'applicant') query = query.eq('applicant_id', user.id);
    else if (profile?.role === 'hr') {
      const { data: myJobs } = await supabase.from('jobs').select('id').eq('hr_id', user.id);
      query = query.in('job_id', (myJobs || []).map(j => j.id));
    }
    
    const { data: applications, error } = await query;
    if (error) throw error;
    
    const mappedApps = (applications || []).map((app: any) => ({
      ...app,
      applicantName: app.profiles?.name || 'Anonymous',
      applicantEmail: app.profiles?.email || '',
      jobTitle: app.jobs?.title || 'Unknown Job',
      jobLocation: app.jobs?.location,
      matchScore: app.match_score,
      skillMatch: app.skill_match_score,
      textSimilarity: app.text_similarity,
      experienceScore: 0, // Not stored in DB? If it is, map it.
      matchedSkills: app.matched_skills,
      missingSkills: app.missing_skills,
      createdAt: app.created_at
    }));
    
    return c.json({ applications: mappedApps });
  } catch (error) { return c.json({ error: 'Fetch failed' }, 500); }
});

app.put('/applications/:id', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { status } = await c.req.json();
    const { data: updatedApp, error } = await supabase.from('applications').update({ status }).eq('id', c.req.param('id')).select().single();
    if (error) throw error;
    return c.json({ application: updatedApp });
  } catch (error) { return c.json({ error: 'Update failed' }, 500); }
});

// Updated /analytics endpoint
app.get('/analytics', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    // 1. Fetch HR's jobs
    const { data: hrJobs } = await supabase.from('jobs').select('*').eq('hr_id', user.id);
    const jobs = hrJobs || [];
    
    // 2. Fetch applications for these jobs
    const { data: apps } = await supabase.from('applications').select('*').in('job_id', jobs.map(j => j.id));
    const allApps = apps || [];

    // 3. Calculate Average Match Score
    const avgMatch = allApps.length 
      ? allApps.reduce((s, a) => s + (Number(a.match_score) || 0), 0) / allApps.length 
      : 0;
    
    // 4. Calculate Applications Per Job (Missing Piece 1)
    const applicationsPerJob = jobs.map(job => ({
      jobId: job.id,
      jobTitle: job.title,
      count: allApps.filter(a => a.job_id === job.id).length
    })).sort((a, b) => b.count - a.count); // Sort by highest count

    // 5. Calculate Top Skills (Missing Piece 2)
    // Aggregates skills from job requirements to see what is most "in demand"
    const skillCounts: Record<string, number> = {};
    jobs.forEach(job => {
      const skills = job.requirements || []; // Assuming this is stored as an array
      if (Array.isArray(skills)) {
        skills.forEach((skill: any) => {
          const s = String(skill).trim();
          if (s) skillCounts[s] = (skillCounts[s] || 0) + 1;
        });
      }
    });

    const topSkills = Object.entries(skillCounts)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 skills

    return c.json({ 
      analytics: {
        totalJobs: jobs.length,
        totalApplications: allApps.length,
        avgMatchScore: Math.round(avgMatch * 100) / 100,
        applicationsByStatus: {
          applied: allApps.filter(a => a.status === 'applied').length,
          under_review: allApps.filter(a => a.status === 'under_review').length,
          shortlisted: allApps.filter(a => a.status === 'shortlisted').length,
          rejected: allApps.filter(a => a.status === 'rejected').length
        },
        // Include the missing fields required by the frontend
        applicationsPerJob,
        topSkills
      }
    });
  } catch (error) { 
    console.error('Analytics error:', error);
    return c.json({ error: 'Analytics error' }, 500); 
  }
});

Deno.serve(app.fetch);