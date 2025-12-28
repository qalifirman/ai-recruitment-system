import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { HRDashboard } from './components/hr/HRDashboard';
import { ApplicantDashboard } from './components/applicant/ApplicantDashboard';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (user.role === 'hr') {
    return <HRDashboard />;
  }

  return <ApplicantDashboard />;
}

export default function App() {
  return (
    <React.StrictMode>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </React.StrictMode>
  );
}