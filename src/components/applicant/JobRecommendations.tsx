import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { serverFunctionUrl } from '../../utils/supabase/info';
import { calculateMatch } from '../../utils/ai/nlp-engine';
import { Search, MapPin, Briefcase, Clock, Filter, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
  matchedKeywords: string[];
  explanation: string;
}

interface ActiveResume {
  id: string;
  fileUrl: string;
  parsedData: {
    skills: string[];
    yearsOfExperience: number;
    rawText: string;
  };
}

export function JobRecommendations() {
  const { user, accessToken } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobMatches, setJobMatches] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeResume, setActiveResume] = useState<ActiveResume | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [processingApp, setProcessingApp] = useState<string | null>(null);

  const serverUrl = serverFunctionUrl;

  useEffect(() => {
    if (user && accessToken) {
      fetchData();
    }
  }, [user, accessToken]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Resumes
      const resumeRes = await fetch(`${serverUrl}/resumes`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      let currentResume: ActiveResume | undefined;

      if (resumeRes.ok) {
        const data = await resumeRes.json();
        // Find the active one
        currentResume = (data.resumes || []).find((r: any) => r.isActive);
        if (currentResume) {
          setActiveResume(currentResume);
        }
      }

      // 2. Fetch Jobs
      const jobRes = await fetch(`${serverUrl}/jobs`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (jobRes.ok) {
        const data = await jobRes.json();
        const cleanJobs = (data.jobs || []).map((j: any) => ({
          ...j,
          requiredSkills: j.requiredSkills || j.requirements || [], 
          requiredYearsExp: j.requiredYearsExp || 0
        }));
        setJobs(cleanJobs);

        // 3. Match immediately if we have both jobs and a resume
        if (currentResume && cleanJobs.length > 0) {
          runMatchingAlgorithm(cleanJobs, currentResume);
        } else {
          setJobMatches([]); 
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const runMatchingAlgorithm = (jobsToMatch: Job[], resume: ActiveResume) => {
    const { rawText, skills, yearsOfExperience } = resume.parsedData;

    const matches = jobsToMatch.map(job => {
      const matchResult = calculateMatch(
        rawText,
        job.description,
        skills,
        job.requiredSkills || [],
        yearsOfExperience || 0,
        job.requiredYearsExp || 0
      );

      return {
        ...job,
        ...matchResult
      };
    });

    setJobMatches(matches.sort((a, b) => b.matchScore - a.matchScore));
  };

  const applyToJob = async (job: JobMatch) => {
    if (!activeResume) {
      toast.error('Please go to "Resume Manager" and upload a resume first.');
      return;
    }

    setProcessingApp(job.id);

    try {
      const applicationData = {
        jobId: job.id,
        resumeUrl: activeResume.fileUrl,
        yearsOfExperience: activeResume.parsedData.yearsOfExperience,
        
        // AI Data
        matchScore: job.matchScore,
        skillMatch: job.skillMatch,
        textSimilarity: job.textSimilarity,
        experienceScore: job.experienceScore,
        matchedSkills: job.matchedSkills,
        missingSkills: job.missingSkills,
        matchedKeywords: job.matchedKeywords,
        explanation: job.explanation,
        
        // Applicant Info
        applicantName: user?.name,
        applicantEmail: user?.email
      };

      const response = await fetch(`${serverUrl}/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(applicationData)
      });

      if (response.ok) {
        toast.success(`Application submitted for ${job.title}!`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to submit application');
      }
    } catch (error) {
      console.error('Application error:', error);
      toast.error('Failed to submit application');
    } finally {
      setProcessingApp(null);
    }
  };

  const getFilteredJobs = () => {
    let displayList: any[] = activeResume ? jobMatches : jobs;

    if (searchTerm) {
      displayList = displayList.filter(job =>
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.requiredSkills || []).some((s: string) => s.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (locationFilter) {
      displayList = displayList.filter(job =>
        job.location.toLowerCase().includes(locationFilter.toLowerCase())
      );
    }

    return displayList;
  };

  const filteredJobs = getFilteredJobs();

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
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

      {!activeResume && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-600" />
          <div>
            <h4 className="font-medium text-yellow-900">No Active Resume Found</h4>
            <p className="text-sm text-yellow-700">
              Please go to the <strong>Resume Manager</strong> tab to upload and activate a resume. 
              Jobs below are not personalized to your skills.
            </p>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl text-gray-900">
            {activeResume ? 'Recommended Jobs' : 'All Jobs'} ({filteredJobs.length})
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
                      {(job.requiredSkills || []).slice(0, 6).map((skill: string) => {
                        const isMatched = activeResume && (job as JobMatch).matchedSkills?.includes(skill);
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

                  {activeResume && (job as JobMatch).matchScore !== undefined && (
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

                {activeResume && (job as JobMatch).matchScore !== undefined && (
                  <>
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

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                      <p className="text-sm text-blue-900">{(job as JobMatch).explanation}</p>
                    </div>
                  </>
                )}

                <button
                  onClick={() => applyToJob(job as JobMatch)}
                  disabled={!activeResume || processingApp === job.id}
                  className={`w-full py-3 rounded-xl transition-all flex justify-center items-center gap-2 ${
                    activeResume
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {processingApp === job.id ? (
                     <Loader2 className="w-5 h-5 animate-spin" />
                  ) : activeResume ? (
                    'Apply Now'
                  ) : (
                    'Upload resume in Manager to apply'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}