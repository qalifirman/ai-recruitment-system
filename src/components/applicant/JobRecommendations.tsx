import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { serverFunctionUrl } from '../../utils/supabase/info';
import { parseResumeFile, validateResumeFile } from '../../utils/pdf-parser';
import { parseResume, calculateMatch } from '../../utils/ai/nlp-engine';
import { Upload, Search, MapPin, Briefcase, Clock, TrendingUp, Filter, X } from 'lucide-react';

interface Job {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  requiredYearsExp: number;
  location: string;
  department: string;
  employmentType: string;
  salary?: string;
  createdAt: string;
}

interface JobMatch extends Job {
  matchScore: number;
  skillMatch: number;
  textSimilarity: number;
  experienceScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  matchedKeywords: string[]; // Added missing interface property
  explanation: string;
  resumePath: string;
}

export function JobRecommendations() {
  const { user, accessToken } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobMatches, setJobMatches] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [resumeSkills, setResumeSkills] = useState<string[]>([]);
  const [resumeYears, setResumeYears] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const serverUrl = serverFunctionUrl;

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await fetch(`${serverUrl}/jobs`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // FIX #1: Sanitize data immediately upon fetch
        const cleanJobs = (data.jobs || []).map((j: any) => ({
          ...j,
          requiredSkills: j.requiredSkills || [] 
        }));
        setJobs(cleanJobs);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateResumeFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setUploading(true);

    try {
      // Parse resume text
      const text = await parseResumeFile(file);
      
      // Extract structured data using AI
      const parsed = parseResume(text);
      
      setResumeText(text);
      setResumeSkills(parsed.skills);
      setResumeYears(parsed.yearsOfExperience);

      // Upload to server
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${serverUrl}/resumes/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        
        // Store resume path for future applications
        const resumePath = data.path;
        
        // Calculate matches for all jobs
        const matches = jobs.map(job => {
          const matchResult = calculateMatch(
            text,
            job.description,
            parsed.skills,
            job.requiredSkills || [], // Safety check for calculation
            parsed.yearsOfExperience,
            job.requiredYearsExp
          );

          return {
            ...job,
            ...matchResult,
            resumePath // Store path for applications
          };
        }).sort((a, b) => b.matchScore - a.matchScore);

        setJobMatches(matches);
        setResumeUploaded(true);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to upload resume');
      }
    } catch (error: any) {
      console.error('Resume upload error:', error);
      alert(error.message || 'Failed to process resume');
    } finally {
      setUploading(false);
    }
  };

  const applyToJob = async (job: JobMatch) => {
    if (!resumeUploaded) {
      alert('Please upload your resume first');
      return;
    }

    try {
      const response = await fetch(`${serverUrl}/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          jobId: job.id,
          resumeText,
          skills: resumeSkills,
          yearsOfExperience: resumeYears,
          matchScore: job.matchScore,
          skillMatch: job.skillMatch,
          textSimilarity: job.textSimilarity,
          experienceScore: job.experienceScore,
          matchedSkills: job.matchedSkills,
          missingSkills: job.missingSkills,
          matchedKeywords: job.matchedKeywords,
          explanation: job.explanation,
          applicantName: user?.name,
          applicantEmail: user?.email,
          resumeUrl: job.resumePath // Ensure resume path is sent
        })
      });

      if (response.ok) {
        alert('Application submitted successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to submit application');
      }
    } catch (error) {
      console.error('Application error:', error);
      alert('Failed to submit application');
    }
  };

  const getFilteredJobs = () => {
    let filtered = resumeUploaded ? jobMatches : jobs;

    if (searchTerm) {
      filtered = filtered.filter(job =>
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        // FIX #2: Safety check for search filter
        (job.requiredSkills || []).some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (locationFilter) {
      filtered = filtered.filter(job =>
        job.location.toLowerCase().includes(locationFilter.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredJobs = getFilteredJobs();

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading jobs...</div>;
  }

  return (
    <div>
      {/* Resume Upload Section */}
      {!resumeUploaded ? (
        <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-8 mb-8 text-white">
          <div className="max-w-2xl mx-auto text-center">
            <Upload className="w-16 h-16 mx-auto mb-4 opacity-90" />
            <h2 className="text-3xl mb-3">Upload Your Resume</h2>
            <p className="text-blue-100 mb-6">
              Get AI-powered job recommendations based on your skills and experience
            </p>
            <label className="inline-block cursor-pointer">
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleResumeUpload}
                className="hidden"
                disabled={uploading}
              />
              <div className="px-8 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-all shadow-lg inline-block">
                {uploading ? 'Processing...' : 'Upload Resume (PDF, DOCX, or TXT)'}
              </div>
            </label>
            <p className="text-sm text-blue-100 mt-4">Maximum file size: 10MB</p>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg text-green-900 mb-2">Resume Uploaded Successfully!</h3>
              <p className="text-green-700 mb-2">
                Extracted {resumeSkills.length} skills • {resumeYears} years of experience
              </p>
              <div className="flex flex-wrap gap-2">
                {resumeSkills.slice(0, 10).map(skill => (
                  <span key={skill} className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                    {skill}
                  </span>
                ))}
                {resumeSkills.length > 10 && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                    +{resumeSkills.length - 10} more
                  </span>
                )}
              </div>
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleResumeUpload}
                className="hidden"
                disabled={uploading}
              />
              <div className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                Update Resume
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, skills..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="w-48">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="Location"
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <Filter className="w-5 h-5" />
            Filters
          </button>
          {(searchTerm || locationFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setLocationFilter('');
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Job Listings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl text-gray-900">
            {resumeUploaded ? 'Recommended Jobs' : 'All Jobs'} ({filteredJobs.length})
          </h2>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No jobs found matching your criteria</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredJobs.map(job => (
              <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl text-gray-900 mb-2">{job.title}</h3>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        {job.employmentType}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {job.requiredYearsExp}+ years
                      </span>
                      {job.salary && <span>💰 {job.salary}</span>}
                    </div>
                    <p className="text-gray-700 mb-4 line-clamp-2">{job.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {/* FIX #3: Handle null skills in display logic */}
                      {(job.requiredSkills || []).slice(0, 6).map(skill => {
                        const isMatched = resumeUploaded && (job as JobMatch).matchedSkills?.includes(skill);
                        return (
                          <span
                            key={skill}
                            className={`px-3 py-1 rounded-lg text-sm ${
                              isMatched
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {skill}
                          </span>
                        );
                      })}
                      {(job.requiredSkills || []).length > 6 && (
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">
                          +{(job.requiredSkills || []).length - 6} more
                        </span>
                      )}
                    </div>
                  </div>

                  {resumeUploaded && (job as JobMatch).matchScore !== undefined && (
                    <div className="ml-6 text-center">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-2">
                        <div>
                          <div className="text-2xl text-white">
                            {Math.round((job as JobMatch).matchScore * 100)}%
                          </div>
                          <div className="text-xs text-blue-100">Match</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {resumeUploaded && (job as JobMatch).matchScore !== undefined && (
                  <>
                    {/* Match Details */}
                    <div className="grid grid-cols-3 gap-4 mb-4 pt-4 border-t border-gray-200">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Skills</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${(job as JobMatch).skillMatch * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-900">{Math.round((job as JobMatch).skillMatch * 100)}%</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Content</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 rounded-full"
                              style={{ width: `${(job as JobMatch).textSimilarity * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-900">{Math.round((job as JobMatch).textSimilarity * 100)}%</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Experience</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${(job as JobMatch).experienceScore * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-900">{Math.round((job as JobMatch).experienceScore * 100)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* AI Explanation */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                      <p className="text-sm text-blue-900">{(job as JobMatch).explanation}</p>
                    </div>
                  </>
                )}

                {/* Apply Button */}
                <button
                  onClick={() => applyToJob(job as JobMatch)}
                  disabled={!resumeUploaded}
                  className={`w-full py-3 rounded-xl transition-all ${
                    resumeUploaded
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {resumeUploaded ? 'Apply Now' : 'Upload resume to apply'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}