import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { serverFunctionUrl } from '../../utils/supabase/info';
import { Clock, CheckCircle, XCircle, AlertCircle, Briefcase } from 'lucide-react';

interface Application {
  id: string;
  jobId: string;
  matchScore: number;
  status: 'applied' | 'under_review' | 'shortlisted' | 'rejected';
  createdAt: string;
  jobTitle?: string;
  jobLocation?: string;
  matchedSkills: string[];
}

const STATUS_CONFIG = {
  applied: { label: 'Applied', icon: Clock, color: 'blue', progress: 25 },
  under_review: { label: 'Under Review', icon: AlertCircle, color: 'yellow', progress: 50 },
  shortlisted: { label: 'Shortlisted', icon: CheckCircle, color: 'green', progress: 75 },
  rejected: { label: 'Rejected', icon: XCircle, color: 'red', progress: 100 }
};

export function ApplicationTracking() {
  const { accessToken } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const serverUrl = serverFunctionUrl;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Only fetch applications; backend joins the Job details automatically
      const appsRes = await fetch(`${serverUrl}/applications`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      const appsData = appsRes.ok ? await appsRes.json() : { applications: [] };

      // Backend now sends jobTitle and jobLocation joined, no need for manual lookup that overwrites it
      setApplications(appsData.applications || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading applications...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl text-gray-900 mb-2">My Applications</h2>
        <p className="text-gray-600">Track your job application status</p>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No applications yet. Start applying to jobs!</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl text-gray-900 mb-1">{applications.length}</div>
              <div className="text-sm text-gray-600">Total Applications</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl text-blue-600 mb-1">{applications.filter(a => a.status === 'applied').length}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl text-yellow-600 mb-1">{applications.filter(a => a.status === 'under_review').length}</div>
              <div className="text-sm text-gray-600">Under Review</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl text-green-600 mb-1">{applications.filter(a => a.status === 'shortlisted').length}</div>
              <div className="text-sm text-gray-600">Shortlisted</div>
            </div>
          </div>

          <div className="grid gap-4">
            {applications.map(app => {
              const statusConfig = STATUS_CONFIG[app.status];
              const Icon = statusConfig.icon;
              
              const statusStyles = {
                applied: 'bg-blue-50 text-blue-600',
                under_review: 'bg-yellow-50 text-yellow-600',
                shortlisted: 'bg-green-50 text-green-600',
                rejected: 'bg-red-50 text-red-600'
              };
              
              const progressBarStyles = {
                applied: 'bg-blue-500',
                under_review: 'bg-yellow-500',
                shortlisted: 'bg-green-500',
                rejected: 'bg-red-500'
              };

              return (
                <div key={app.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg text-gray-900 mb-1">{app.jobTitle || 'Job Title Unavailable'}</h3>
                      <p className="text-sm text-gray-600 mb-3">{app.jobLocation || 'Location Unavailable'}</p>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-600">
                          Match Score: <span className="text-blue-600">{Math.round((app.matchScore || 0) * 100)}%</span>
                        </span>
                        <span className="text-gray-600">
                          Applied: {new Date(app.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${statusStyles[app.status]}`}>
                      <Icon className="w-5 h-5" />
                      <span className="text-sm">{statusConfig.label}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span>Application Progress</span>
                      <span>{statusConfig.progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${progressBarStyles[app.status]}`}
                        style={{ width: `${statusConfig.progress}%` }}
                      />
                    </div>
                  </div>

                  {app.matchedSkills && app.matchedSkills.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-600 mb-2">Matched Skills:</div>
                      <div className="flex flex-wrap gap-2">
                        {app.matchedSkills.slice(0, 8).map(skill => (
                          <span key={skill} className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                            {skill}
                          </span>
                        ))}
                        {app.matchedSkills.length > 8 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                            +{app.matchedSkills.length - 8} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}