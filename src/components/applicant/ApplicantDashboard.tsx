import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { JobRecommendations } from './JobRecommendations';
import { ApplicationTracking } from './ApplicationTracking';
import { ProfileManagement } from './ProfileManagement';
import { ResumeManager } from './ResumeManager';
import { LogOut, Briefcase, FileText, User, Upload } from 'lucide-react';

type Tab = 'jobs' | 'applications' | 'resumes' | 'profile';

export function ApplicantDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('resumes');

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-gray-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl text-gray-900">Job Portal</h1>
                <p className="text-sm text-gray-500">Welcome, {user?.name}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-6">
            <button
              onClick={() => setActiveTab('jobs')}
              className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                activeTab === 'jobs'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Briefcase className="w-5 h-5" />
              Find Jobs
            </button>
            <button
              onClick={() => setActiveTab('applications')}
              className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                activeTab === 'applications'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-5 h-5" />
              My Applications
            </button>
            <button
              onClick={() => setActiveTab('resumes')}
              className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                activeTab === 'resumes'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Upload className="w-5 h-5" />
              Resumes
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                activeTab === 'profile'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <User className="w-5 h-5" />
              Profile
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'jobs' && <JobRecommendations />}
        {activeTab === 'applications' && <ApplicationTracking />}
        {activeTab === 'resumes' && <ResumeManager />}
        {activeTab === 'profile' && <ProfileManagement />}
      </main>
    </div>
  );
}