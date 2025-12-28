import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';

const app = new Hono().basePath('/make-server-76bea622');

// Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize storage bucket for resumes
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

// Helper function to verify auth
async function verifyAuth(request: Request) {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  
  if (!user || error) {
    return null;
  }
  
  return user;
}

// ========================================
// AUTH ROUTES
// ========================================

// Sign up route
app.post('/signup', async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();
    
    if (!email || !password || !name || !role) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    if (!['hr', 'applicant'].includes(role)) {
      return c.json({ error: 'Invalid role. Must be hr or applicant' }, 400);
    }
    
    // 1. Create Auth User
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role },
      email_confirm: true 
    });
    
    if (error) {
      console.error('Sign up error:', error);
      return c.json({ error: error.message }, 400);
    }
    
    // 2. Create Profile in SQL Table
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        email: email,
        name: name,
        role: role
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      return c.json({ error: 'Failed to create profile record' }, 500);
    }
    
    return c.json({ 
      user: {
        id: data.user.id,
        email,
        name,
        role
      }
    });
  } catch (error) {
    console.error('Sign up error:', error);
    return c.json({ error: 'Sign up failed' }, 500);
  }
});

// ========================================
// USER ROUTES
// ========================================

// Get current user profile
app.get('/user/profile', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error || !profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }
    
    return c.json({ profile });
  } catch (error) {
    console.error('Get profile error:', error);
    return c.json({ error: 'Failed to get profile' }, 500);
  }
});

// Update user profile
app.put('/user/profile', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const updates = await c.req.json();
    
    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update({
        name: updates.name,
        // Add other allowed fields here if needed
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      return c.json({ error: 'Failed to update profile' }, 500);
    }
    
    return c.json({ profile: updatedProfile });
  } catch (error) {
    console.error('Update profile error:', error);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

// ========================================
// JOB ROUTES (HR Only)
// ========================================

// Create job
app.post('/jobs', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    // Check Role in SQL
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'hr') {
      return c.json({ error: 'Only HR managers can create jobs' }, 403);
    }
    
    const jobData = await c.req.json();
    
    // Insert into SQL Table
    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        hr_id: user.id,
        title: jobData.title,
        description: jobData.description,
        requirements: jobData.requirements || [],
        
        // --- FIXED: Added Mapping for all fields ---
        salary_range: jobData.salary,
        department: jobData.department,
        employment_type: jobData.employmentType,
        required_years_exp: jobData.requiredYearsExp, // This was missing!
        
        location: jobData.location,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      console.error('Job insert error:', error);
      return c.json({ error: error.message }, 500);
    }
    
    return c.json({ job });
  } catch (error) {
    console.error('Create job error:', error);
    return c.json({ error: 'Failed to create job' }, 500);
  }
});

// Get all jobs (filtered by role)
app.get('/jobs', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    let query = supabase.from('jobs').select('*');

    if (profile?.role === 'hr') {
      query = query.eq('hr_id', user.id);
    } else {
      query = query.eq('status', 'active');
    }

    const { data: jobs, error } = await query;

    if (error) throw error;
    
    // --- FIXED: Mapping DB snake_case to Frontend camelCase ---
    const mappedJobs = (jobs || []).map((job: any) => ({
      ...job,
      employmentType: job.employment_type,      // Map employment_type -> employmentType
      salary: job.salary_range,                 // Map salary_range -> salary
      requiredYearsExp: job.required_years_exp || 0 // Map required_years_exp -> requiredYearsExp
    }));
    
    return c.json({ jobs: mappedJobs });
  } catch (error) {
    console.error('Get jobs error:', error);
    return c.json({ error: 'Failed to get jobs' }, 500);
  }
});

// Get single job
app.get('/jobs/:id', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const jobId = c.req.param('id');
    
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (error || !job) {
      return c.json({ error: 'Job not found' }, 404);
    }

    // --- FIXED: Mapping for single job ---
    const mappedJob = {
      ...job,
      employmentType: job.employment_type,
      salary: job.salary_range,
      requiredYearsExp: job.required_years_exp || 0
    };
    
    return c.json({ job: mappedJob });
  } catch (error) {
    console.error('Get job error:', error);
    return c.json({ error: 'Failed to get job' }, 500);
  }
});

// Update job
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
        requirements: updates.requirements,
        
        // --- FIXED: Updating new fields ---
        salary_range: updates.salary,
        department: updates.department,
        employment_type: updates.employmentType,
        required_years_exp: updates.requiredYearsExp,
        
        location: updates.location,
        status: updates.status
      })
      .eq('id', jobId)
      .eq('hr_id', user.id) // Ensure ownership
      .select()
      .single();

    if (error || !job) {
      return c.json({ error: 'Job not found or unauthorized' }, 404);
    }
    
    // Return mapped job
    const mappedJob = {
      ...job,
      employmentType: job.employment_type,
      salary: job.salary_range,
      requiredYearsExp: job.required_years_exp || 0
    };

    return c.json({ job: mappedJob });
  } catch (error) {
    console.error('Update job error:', error);
    return c.json({ error: 'Failed to update job' }, 500);
  }
});

// Delete job
app.delete('/jobs/:id', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const jobId = c.req.param('id');

    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId)
      .eq('hr_id', user.id);

    if (error) {
      return c.json({ error: 'Failed to delete job or unauthorized' }, 403);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete job error:', error);
    return c.json({ error: 'Failed to delete job' }, 500);
  }
});

// ========================================
// RESUME ROUTES (Now SQL Tables!)
// ========================================

// Upload resume
app.post('/resumes/upload', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) return c.json({ error: 'No file provided' }, 400);
    
    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    const fileBuffer = await file.arrayBuffer();
    
    const { error } = await supabase.storage
      .from('make-76bea622-resumes')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false
      });
    
    if (error) {
      console.error('File upload error:', error);
      return c.json({ error: 'Failed to upload file' }, 500);
    }
    
    const { data: urlData } = await supabase.storage
      .from('make-76bea622-resumes')
      .createSignedUrl(fileName, 31536000);
    
    return c.json({ 
      path: fileName,
      url: urlData?.signedUrl,
      name: file.name,
      type: file.type
    });
  } catch (error) {
    console.error('Upload resume error:', error);
    return c.json({ error: 'Failed to upload resume' }, 500);
  }
});

// Save resume metadata
app.post('/resumes', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { filename, filePath, fileUrl, parsedData } = await c.req.json();
    
    if (!filename || !filePath || !parsedData) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    // 1. Deactivate all existing resumes for this user in SQL
    await supabase
      .from('resumes')
      .update({ is_active: false })
      .eq('user_id', user.id);
    
    // 2. Insert new resume
    const { data: resume, error } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        file_name: filename,
        file_path: filePath,
        file_url: fileUrl,
        parsed_data: parsedData,
        is_active: true
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Map keys for frontend
    const mappedResume = {
      ...resume,
      userId: resume.user_id,
      filename: resume.file_name,
      filePath: resume.file_path,
      fileUrl: resume.file_url,
      parsedData: resume.parsed_data,
      uploadedAt: resume.created_at,
      isActive: resume.is_active
    };

    return c.json({ resume: mappedResume });
  } catch (error) {
    console.error('Save resume error:', error);
    return c.json({ error: 'Failed to save resume' }, 500);
  }
});

// Get user's resumes
app.get('/resumes', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { data: resumes, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    const formattedResumes = resumes.map(r => ({
      id: r.id,
      userId: r.user_id,
      filename: r.file_name,
      filePath: r.file_path,
      fileUrl: r.file_url,
      parsedData: r.parsed_data,
      uploadedAt: r.created_at,
      isActive: r.is_active
    }));
    
    return c.json({ resumes: formattedResumes });
  } catch (error) {
    console.error('Get resumes error:', error);
    return c.json({ error: 'Failed to get resumes' }, 500);
  }
});

// Set active resume
app.put('/resumes/:id/activate', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const resumeId = c.req.param('id');
    
    // Deactivate all
    await supabase
      .from('resumes')
      .update({ is_active: false })
      .eq('user_id', user.id);
      
    // Activate selected
    const { error } = await supabase
      .from('resumes')
      .update({ is_active: true })
      .eq('id', resumeId)
      .eq('user_id', user.id);
      
    if (error) throw error;
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Activate resume error:', error);
    return c.json({ error: 'Failed to activate resume' }, 500);
  }
});

// Delete resume
app.delete('/resumes/:id', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const resumeId = c.req.param('id');
    
    // Get file path first
    const { data: resume } = await supabase
      .from('resumes')
      .select('file_path')
      .eq('id', resumeId)
      .eq('user_id', user.id)
      .single();
      
    if (!resume) return c.json({ error: 'Resume not found' }, 404);
    
    // Delete from Storage
    await supabase.storage
      .from('make-76bea622-resumes')
      .remove([resume.file_path]);
    
    // Delete from DB
    const { error } = await supabase
      .from('resumes')
      .delete()
      .eq('id', resumeId)
      .eq('user_id', user.id);
      
    if (error) throw error;
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete resume error:', error);
    return c.json({ error: 'Failed to delete resume' }, 500);
  }
});

// Get resume URL
app.get('/resumes/:path', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const path = c.req.param('path');
    const { data, error } = await supabase.storage
      .from('make-76bea622-resumes')
      .createSignedUrl(path, 3600);
    
    if (error) return c.json({ error: 'Failed to get resume URL' }, 500);
    return c.json({ url: data.signedUrl });
  } catch (error) {
    return c.json({ error: 'Failed to get resume' }, 500);
  }
});

// ========================================
// APPLICATION ROUTES
// ========================================

// Submit application
app.post('/applications', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'applicant') {
      return c.json({ error: 'Only applicants can submit applications' }, 403);
    }
    
    const appData = await c.req.json();
    
    // Insert into SQL table
    const { data: application, error } = await supabase
      .from('applications')
      .insert({
        job_id: appData.jobId,
        applicant_id: user.id,
        resume_url: appData.resumeUrl || null,
        status: 'applied',
        match_score: appData.matchScore || 0
      })
      .select()
      .single();

    if (error) {
      console.error('App insert error:', error);
      return c.json({ error: 'Failed to submit application' }, 500);
    }
    
    return c.json({ application });
  } catch (error) {
    console.error('Submit application error:', error);
    return c.json({ error: 'Failed to submit application' }, 500);
  }
});

// Get applications
app.get('/applications', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    let query = supabase.from('applications').select('*, jobs(*)');

    if (profile?.role === 'applicant') {
      query = query.eq('applicant_id', user.id);
    } else if (profile?.role === 'hr') {
      // Find jobs owned by this HR first to filter
      const { data: myJobs } = await supabase.from('jobs').select('id').eq('hr_id', user.id);
      const myJobIds = myJobs?.map(j => j.id) || [];
      query = query.in('job_id', myJobIds);
    }
    
    const { data: applications, error } = await query;
    if (error) throw error;
    
    return c.json({ applications: applications || [] });
  } catch (error) {
    console.error('Get applications error:', error);
    return c.json({ error: 'Failed to get applications' }, 500);
  }
});

// Get applications for specific job
app.get('/jobs/:jobId/applications', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const jobId = c.req.param('jobId');

    // Verify job owner
    const { data: job } = await supabase
      .from('jobs')
      .select('hr_id')
      .eq('id', jobId)
      .single();
      
    if (!job || job.hr_id !== user.id) {
      return c.json({ error: 'Unauthorized or Job not found' }, 403);
    }
    
    const { data: applications, error } = await supabase
      .from('applications')
      .select('*')
      .eq('job_id', jobId);
      
    if (error) throw error;
    
    return c.json({ applications: applications || [] });
  } catch (error) {
    console.error('Get job applications error:', error);
    return c.json({ error: 'Failed to get job applications' }, 500);
  }
});

// Update application status
app.put('/applications/:id', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const applicationId = c.req.param('id');
    const { status } = await c.req.json();
    
    if (!['applied', 'under_review', 'shortlisted', 'rejected'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    // Get app and job to verify ownership
    const { data: appData } = await supabase
      .from('applications')
      .select('job_id')
      .eq('id', applicationId)
      .single();
      
    if (!appData) return c.json({ error: 'Application not found' }, 404);
    
    const { data: job } = await supabase
      .from('jobs')
      .select('hr_id')
      .eq('id', appData.job_id)
      .single();
      
    if (!job || job.hr_id !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    const { data: updatedApp, error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', applicationId)
      .select()
      .single();
      
    if (error) throw error;

    return c.json({ application: updatedApp });
  } catch (error) {
    console.error('Update application error:', error);
    return c.json({ error: 'Failed to update application' }, 500);
  }
});

// ========================================
// ANALYTICS ROUTES (SQL Optimized)
// ========================================

app.get('/analytics', async (c) => {
  try {
    const user = await verifyAuth(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    // Get all HR jobs
    const { data: hrJobs } = await supabase
      .from('jobs')
      .select('*')
      .eq('hr_id', user.id);
      
    const jobIds = hrJobs?.map(j => j.id) || [];
    
    // Get all applications for those jobs
    const { data: hrApplications } = await supabase
      .from('applications')
      .select('*')
      .in('job_id', jobIds);
      
    const apps = hrApplications || [];
    
    const totalJobs = hrJobs?.length || 0;
    const totalApplications = apps.length;
    
    const avgMatchScore = apps.length > 0
      ? apps.reduce((sum, app) => sum + (Number(app.match_score) || 0), 0) / apps.length
      : 0;
      
    const applicationsByStatus = {
      applied: apps.filter(a => a.status === 'applied').length,
      under_review: apps.filter(a => a.status === 'under_review').length,
      shortlisted: apps.filter(a => a.status === 'shortlisted').length,
      rejected: apps.filter(a => a.status === 'rejected').length
    };
    
    const applicationsPerJob = hrJobs?.map(job => ({
      jobId: job.id,
      jobTitle: job.title,
      count: apps.filter(a => a.job_id === job.id).length
    }));
    
    const skillDemand: Record<string, number> = {};
    hrJobs?.forEach(job => {
      (job.requirements || []).forEach((skill: string) => {
        skillDemand[skill] = (skillDemand[skill] || 0) + 1;
      });
    });
    
    const topSkills = Object.entries(skillDemand)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, count }));
    
    return c.json({
      analytics: {
        totalJobs,
        totalApplications,
        avgMatchScore: Math.round(avgMatchScore * 100) / 100,
        applicationsByStatus,
        applicationsPerJob,
        topSkills
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    return c.json({ error: 'Failed to get analytics' }, 500);
  }
});

Deno.serve(app.fetch);