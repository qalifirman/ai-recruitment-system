import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { serverFunctionUrl, publicAnonKey } from '../../utils/supabase/info';
import { parseResumeFile, validateResumeFile } from '../../utils/pdf-parser';
import { parseResume } from '../../utils/ai/nlp-engine';
import { Upload, FileText, Trash2, Download, Check, X, AlertCircle } from 'lucide-react';

interface StoredResume {
  id: string;
  filename: string;
  filePath: string;
  fileUrl: string;
  parsedData: {
    skills: string[];
    yearsOfExperience: number;
    education: string[];
    rawText: string;
  };
  uploadedAt: string;
  isActive: boolean;
}

interface ResumeManagerProps {
  onResumeSelect?: (resume: StoredResume) => void;
}

export function ResumeManager({ onResumeSelect }: ResumeManagerProps) {
  const { accessToken } = useAuth();
  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const serverUrl = serverFunctionUrl;

  // Load saved resumes on mount
  useEffect(() => {
    loadResumes();
  }, []);

  const loadResumes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${serverUrl}/resumes`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setResumes(data.resumes || []);
      } else {
        console.error('Failed to load resumes');
      }
    } catch (error) {
      console.error('Error loading resumes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccessMessage('');
    setUploading(true);

    try {
      // Validate file
      const validation = validateResumeFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        setUploading(false);
        return;
      }

      // Parse resume
      const text = await parseResumeFile(file);
      const parsed = parseResume(text);

      console.log('Parsed resume:', { skills: parsed.skills, years: parsed.yearsOfExperience });

      // Upload to storage
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch(`${serverUrl}/resumes/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
      });

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();

        // Save resume metadata
        const saveResponse = await fetch(`${serverUrl}/resumes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            filename: file.name,
            filePath: uploadData.path,
            fileUrl: uploadData.url,
            parsedData: {
              skills: parsed.skills,
              yearsOfExperience: parsed.yearsOfExperience,
              education: parsed.education,
              rawText: parsed.rawText
            }
          })
        });

        if (saveResponse.ok) {
          setSuccessMessage('Resume uploaded successfully!');
          await loadResumes();
          
          // Clear file input
          e.target.value = '';
        } else {
          const errorData = await saveResponse.json();
          setError(errorData.error || 'Failed to save resume');
        }
      } else {
        const errorData = await uploadResponse.json();
        setError(errorData.error || 'Failed to upload resume');
      }
    } catch (error: any) {
      console.error('Resume upload error:', error);
      setError(error.message || 'Failed to process resume');
    } finally {
      setUploading(false);
    }
  };

  const handleSetActive = async (resumeId: string) => {
    try {
      const response = await fetch(`${serverUrl}/resumes/${resumeId}/activate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        await loadResumes();
        
        // Notify parent component
        const activeResume = resumes.find(r => r.id === resumeId);
        if (activeResume && onResumeSelect) {
          onResumeSelect(activeResume);
        }
        
        setSuccessMessage('Resume set as active');
      } else {
        setError('Failed to set resume as active');
      }
    } catch (error) {
      console.error('Error setting active resume:', error);
      setError('Failed to set resume as active');
    }
  };

  const handleDelete = async (resumeId: string) => {
    if (!confirm('Are you sure you want to delete this resume?')) return;

    try {
      const response = await fetch(`${serverUrl}/resumes/${resumeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        setSuccessMessage('Resume deleted successfully');
        await loadResumes();
      } else {
        setError('Failed to delete resume');
      }
    } catch (error) {
      console.error('Error deleting resume:', error);
      setError('Failed to delete resume');
    }
  };

  const activeResume = resumes.find(r => r.isActive);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg text-gray-900 mb-4">Upload Resume</h3>
        
        <div className="flex items-center gap-4">
          <label className="flex-1 flex items-center justify-center gap-3 px-6 py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer">
            <Upload className="w-5 h-5 text-gray-400" />
            <span className="text-gray-600">
              {uploading ? 'Uploading...' : 'Choose Resume (PDF, DOCX, TXT)'}
            </span>
            <input
              type="file"
              onChange={handleFileUpload}
              accept=".pdf,.docx,.txt"
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        <p className="text-sm text-gray-500 mt-2">
          Maximum file size: 10MB. Supported formats: PDF, DOCX, TXT
        </p>

        {/* Messages */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <p className="text-sm text-green-600">{successMessage}</p>
          </div>
        )}
      </div>

      {/* Active Resume */}
      {activeResume && (
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg text-gray-900">{activeResume.filename}</h3>
                  <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">Active</span>
                </div>
                <p className="text-sm text-gray-600">
                  Uploaded {new Date(activeResume.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white rounded-lg p-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Skills Found</p>
              <p className="text-xl text-blue-600">{activeResume.parsedData.skills.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Experience</p>
              <p className="text-xl text-blue-600">{activeResume.parsedData.yearsOfExperience} years</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Education</p>
              <p className="text-xl text-blue-600">{activeResume.parsedData.education.length} entries</p>
            </div>
          </div>

          {activeResume.parsedData.skills.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Top Skills:</p>
              <div className="flex flex-wrap gap-2">
                {activeResume.parsedData.skills.slice(0, 10).map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-white text-blue-700 text-sm rounded-full border border-blue-200"
                  >
                    {skill}
                  </span>
                ))}
                {activeResume.parsedData.skills.length > 10 && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                    +{activeResume.parsedData.skills.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saved Resumes List */}
      {resumes.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg text-gray-900 mb-4">
            Saved Resumes ({resumes.length})
          </h3>

          <div className="space-y-3">
            {resumes.map((resume) => (
              <div
                key={resume.id}
                className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                  resume.isActive
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <FileText className={`w-5 h-5 ${resume.isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-gray-900">{resume.filename}</p>
                      {resume.isActive && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {resume.parsedData.skills.length} skills • {resume.parsedData.yearsOfExperience} years exp
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!resume.isActive && (
                    <button
                      onClick={() => handleSetActive(resume.id)}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Set Active
                    </button>
                  )}
                  
                  <a
                    href={resume.fileUrl}
                    download
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  
                  <button
                    onClick={() => handleDelete(resume.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {resumes.length === 0 && !loading && (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No resumes uploaded yet</p>
          <p className="text-sm text-gray-400 mt-1">Upload your first resume to get started</p>
        </div>
      )}
    </div>
  );
}
