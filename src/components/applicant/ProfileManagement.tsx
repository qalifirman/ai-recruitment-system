import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { serverFunctionUrl } from '../../utils/supabase/info';
import { User, Mail, Briefcase, Save } from 'lucide-react';

export function ProfileManagement() {
  const { user, accessToken, refreshProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const serverUrl = serverFunctionUrl;

  useEffect(() => {
    if (user) {
      setName(user.name);
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch(`${serverUrl}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ name })
      });

      if (response.ok) {
        await refreshProfile();
        setMessage('Profile updated successfully!');
      } else {
        setMessage('Failed to update profile');
      }
    } catch (error) {
      console.error('Update error:', error);
      setMessage('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl text-gray-900 mb-2">Profile Settings</h2>
        <p className="text-gray-600">Manage your account information</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-2xl">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Full Name
              </div>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </div>
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>

          {/* Role (Read-only) */}
          <div>
            <label className="block text-sm text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Account Type
              </div>
            </label>
            <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-blue-900 capitalize">
                {user?.role === 'hr' ? 'HR Manager' : 'Job Applicant'}
              </span>
            </div>
          </div>

          {/* Success/Error Message */}
          {message && (
            <div className={`p-3 rounded-xl ${
              message.includes('success')
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {message}
            </div>
          )}

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Additional Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-6 max-w-2xl">
        <h3 className="text-lg text-blue-900 mb-2">About AI Matching</h3>
        <p className="text-sm text-blue-800 mb-3">
          Our AI-powered system uses advanced Natural Language Processing (NLP) with TF-IDF and Cosine Similarity algorithms to:
        </p>
        <ul className="text-sm text-blue-800 space-y-2 ml-4">
          <li>• Extract skills from your resume automatically</li>
          <li>• Match you with relevant job opportunities</li>
          <li>• Provide explainable match scores</li>
          <li>• Highlight your strengths and skill gaps</li>
        </ul>
      </div>
    </div>
  );
}
