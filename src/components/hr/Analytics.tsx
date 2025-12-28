import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { serverFunctionUrl } from '../../utils/supabase/info';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Briefcase, Target, Download } from 'lucide-react';

interface AnalyticsData {
  totalJobs: number;
  totalApplications: number;
  avgMatchScore: number;
  applicationsByStatus: {
    applied: number;
    under_review: number;
    shortlisted: number;
    rejected: number;
  };
  applicationsPerJob: Array<{
    jobId: string;
    jobTitle: string;
    count: number;
  }>;
  topSkills: Array<{
    skill: string;
    count: number;
  }>;
}

const STATUS_COLORS = {
  applied: '#3b82f6',
  under_review: '#f59e0b',
  shortlisted: '#10b981',
  rejected: '#ef4444'
};

export function Analytics() {
  const { accessToken } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const serverUrl = serverFunctionUrl;

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${serverUrl}/analytics`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!analytics) return;

    const csv = [
      ['Metric', 'Value'],
      ['Total Jobs', analytics.totalJobs],
      ['Total Applications', analytics.totalApplications],
      ['Average Match Score', `${analytics.avgMatchScore}%`],
      [''],
      ['Application Status', 'Count'],
      ['Applied', analytics.applicationsByStatus.applied],
      ['Under Review', analytics.applicationsByStatus.under_review],
      ['Shortlisted', analytics.applicationsByStatus.shortlisted],
      ['Rejected', analytics.applicationsByStatus.rejected],
      [''],
      ['Top Skills', 'Demand'],
      ...analytics.topSkills.map(s => [s.skill, s.count])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recruitment-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading analytics...</div>;
  }

  if (!analytics) {
    return <div className="text-center py-12 text-gray-500">No analytics data available</div>;
  }

  const statusData = [
    { name: 'Applied', value: analytics.applicationsByStatus.applied, color: STATUS_COLORS.applied },
    { name: 'Under Review', value: analytics.applicationsByStatus.under_review, color: STATUS_COLORS.under_review },
    { name: 'Shortlisted', value: analytics.applicationsByStatus.shortlisted, color: STATUS_COLORS.shortlisted },
    { name: 'Rejected', value: analytics.applicationsByStatus.rejected, color: STATUS_COLORS.rejected }
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl text-gray-900">Analytics & Reports</h2>
          <p className="text-gray-600">Recruitment performance insights</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg"
        >
          <Download className="w-5 h-5" />
          Export CSV
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Briefcase className="w-8 h-8 opacity-80" />
            <div className="text-3xl">{analytics.totalJobs}</div>
          </div>
          <div className="text-blue-100">Total Jobs</div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 opacity-80" />
            <div className="text-3xl">{analytics.totalApplications}</div>
          </div>
          <div className="text-cyan-100">Total Applications</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Target className="w-8 h-8 opacity-80" />
            <div className="text-3xl">{analytics.avgMatchScore.toFixed(1)}%</div>
          </div>
          <div className="text-green-100">Avg Match Score</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <div className="text-3xl">{analytics.applicationsByStatus.shortlisted}</div>
          </div>
          <div className="text-purple-100">Shortlisted</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Applications by Status */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg text-gray-900 mb-4">Applications by Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Applications per Job */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg text-gray-900 mb-4">Applications per Job</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.applicationsPerJob.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="jobTitle" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Skills in Demand */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg text-gray-900 mb-4">Top Skills in Demand</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={analytics.topSkills} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="skill" type="category" width={150} />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#06b6d4" name="Number of Jobs" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Statistics Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mt-6">
        <h3 className="text-lg text-gray-900 mb-4">Detailed Statistics</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-700">Metric</th>
                <th className="text-right py-3 px-4 text-gray-700">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-900">Total Active Jobs</td>
                <td className="text-right py-3 px-4 text-gray-900">{analytics.totalJobs}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-900">Total Applications Received</td>
                <td className="text-right py-3 px-4 text-gray-900">{analytics.totalApplications}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-900">Average Match Score</td>
                <td className="text-right py-3 px-4 text-gray-900">{analytics.avgMatchScore.toFixed(2)}%</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-900">Applications per Job (Avg)</td>
                <td className="text-right py-3 px-4 text-gray-900">
                  {analytics.totalJobs > 0 ? (analytics.totalApplications / analytics.totalJobs).toFixed(1) : 0}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-900">Shortlist Rate</td>
                <td className="text-right py-3 px-4 text-gray-900">
                  {analytics.totalApplications > 0 
                    ? ((analytics.applicationsByStatus.shortlisted / analytics.totalApplications) * 100).toFixed(1) 
                    : 0}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
