import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { serverFunctionUrl, publicAnonKey } from '../../utils/supabase/info';
import { Search, ExternalLink, Filter, ArrowUpDown } from 'lucide-react';

interface Application {
  id: string;
  jobId: string;
  applicantId: string;
  resumeText: string;
  resumePath: string;
  resumeUrl?: string;
  skills: string[];
  yearsOfExperience: number;
  matchScore: number;
  skillMatch: number;
  textSimilarity: number;
  experienceScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  matchedKeywords: string[];
  explanation: string;
  status: 'applied' | 'under_review' | 'shortlisted' | 'rejected';
  createdAt: string;
  applicantName?: string;
  applicantEmail?: string;
  jobTitle?: string;
}

interface Job {
  id: string;
  title: string;
}

export function CandidateReview() {
  const { accessToken } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const serverUrl = serverFunctionUrl;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [jobsRes, appsRes] = await Promise.all([
        fetch(`${serverUrl}/jobs`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }),
        fetch(`${serverUrl}/applications`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
      ]);

      const jobsData = jobsRes.ok ? await jobsRes.json() : { jobs: [] };
      setJobs(jobsData.jobs || []);

      if (appsRes.ok) {
        const appsData = await appsRes.json();
        
        // Enrich applications with job titles
        const enrichedApps = (appsData.applications || []).map((app: Application) => {
          const job = (jobsData.jobs || []).find((j: Job) => j.id === app.jobId);
          return {
            ...app,
            jobTitle: job?.title || 'Unknown Job'
          };
        });
        
        setApplications(enrichedApps);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (appId: string, newStatus: string) => {
    try {
      const response = await fetch(`${serverUrl}/applications/${appId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getFilteredAndSortedApplications = () => {
    let filtered = applications;

    if (selectedJob !== 'all') {
      filtered = filtered.filter(app => app.jobId === selectedJob);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(app => app.status === statusFilter);
    }

    if (sortBy === 'score') {
      filtered.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    } else {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return filtered;
  };

  const filteredApps = getFilteredAndSortedApplications();

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading candidates...</div>;
  }

  return (
    <div>
      {/* Header with Filters */}
      <div className="mb-6">
        <h2 className="text-2xl text-gray-900 mb-4">Candidate Review</h2>
        
        <div className="flex flex-wrap gap-4">
          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Jobs</option>
            {jobs.map(job => (
              <option key={job.id} value={job.id}>{job.title}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="applied">Applied</option>
            <option value="under_review">Under Review</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="rejected">Rejected</option>
          </select>

          <button
            onClick={() => setSortBy(sortBy === 'score' ? 'date' : 'score')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" />
            Sort by {sortBy === 'score' ? 'Score' : 'Date'}
          </button>
        </div>
      </div>

      {/* Applications List */}
      {filteredApps.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Filter className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No applications found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredApps.map(app => (
            <div key={app.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg text-gray-900 mb-1">{app.applicantName || app.applicantEmail || 'Anonymous'}</h3>
                  <p className="text-sm text-gray-600">{app.jobTitle}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl text-blue-600 mb-1">
                    {Math.round((app.matchScore || 0) * 100)}%
                  </div>
                  <div className="text-sm text-gray-500">Match Score</div>
                </div>
              </div>

              {/* Match Breakdown */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Skills Match</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(app.skillMatch || 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-900">{Math.round((app.skillMatch || 0) * 100)}%</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Text Similarity</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full"
                        style={{ width: `${(app.textSimilarity || 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-900">{Math.round((app.textSimilarity || 0) * 100)}%</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Experience</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${(app.experienceScore || 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-900">{Math.round((app.experienceScore || 0) * 100)}%</span>
                  </div>
                </div>
              </div>

              {/* Skills */}
              <div className="mb-4">
                <div className="text-sm text-gray-700 mb-2">Matched Skills ({app.matchedSkills?.length || 0})</div>
                <div className="flex flex-wrap gap-2">
                  {(app.matchedSkills || []).slice(0, 8).map(skill => (
                    <span key={skill} className="px-2 py-1 bg-green-50 text-green-700 rounded-lg text-sm">
                      {skill}
                    </span>
                  ))}
                  {(app.matchedSkills?.length || 0) > 8 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">
                      +{(app.matchedSkills?.length || 0) - 8} more
                    </span>
                  )}
                </div>
                {(app.missingSkills?.length || 0) > 0 && (
                  <div className="mt-2">
                    <div className="text-sm text-gray-700 mb-2">Missing Skills ({app.missingSkills.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {app.missingSkills.slice(0, 5).map(skill => (
                        <span key={skill} className="px-2 py-1 bg-red-50 text-red-700 rounded-lg text-sm">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Explanation */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                <p className="text-sm text-blue-900">{app.explanation}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <select
                  value={app.status}
                  onChange={(e) => updateStatus(app.id, e.target.value)}
                  className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="applied">Applied</option>
                  <option value="under_review">Under Review</option>
                  <option value="shortlisted">Shortlisted</option>
                  <option value="rejected">Rejected</option>
                </select>

                <button
                  onClick={() => setSelectedApp(app)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedApp(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <h3 className="text-2xl text-gray-900">Application Details</h3>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-sm text-gray-600 mb-2">Years of Experience</h4>
                <p className="text-lg text-gray-900">{selectedApp.yearsOfExperience} years</p>
              </div>
              
              <div>
                <h4 className="text-sm text-gray-600 mb-2">All Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {(selectedApp.skills || []).map(skill => (
                    <span key={skill} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm text-gray-600 mb-2">Matched Keywords</h4>
                <div className="flex flex-wrap gap-2">
                  {(selectedApp.matchedKeywords || []).map(keyword => (
                    <span key={keyword} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm text-gray-600 mb-2">Resume Text (Preview)</h4>
                <div className="p-4 bg-gray-50 rounded-lg max-h-64 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">{selectedApp.resumeText?.slice(0, 1000)}...</pre>
                </div>
              </div>

              <button
                onClick={() => setSelectedApp(null)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}