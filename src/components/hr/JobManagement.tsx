import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { serverFunctionUrl } from '../../utils/supabase/info';
import { Plus, Edit2, Trash2, Archive, X, Briefcase } from 'lucide-react';
import { SKILL_DATABASE } from '../../utils/ai/nlp-engine';

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
  status: 'active' | 'archived';
  createdAt: string;
}

export function JobManagement() {
  const { accessToken } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requiredSkills: [] as string[],
    requiredYearsExp: 0,
    location: '',
    department: '',
    employmentType: 'full-time',
    salary: ''
  });
  const [skillInput, setSkillInput] = useState('');
  const [skillSuggestions, setSkillSuggestions] = useState<string[]>([]);

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
        // FIX #1: Ensure requiredSkills is never null when data arrives
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

  const handleSkillInput = (value: string) => {
    setSkillInput(value);
    
    if (value.length > 1) {
      const suggestions = SKILL_DATABASE
        .filter(skill => skill.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 10);
      setSkillSuggestions(suggestions);
    } else {
      setSkillSuggestions([]);
    }
  };

  const addSkill = (skill: string) => {
    // Safety check: ensure requiredSkills exists
    const currentSkills = formData.requiredSkills || [];
    if (skill && !currentSkills.includes(skill)) {
      setFormData({
        ...formData,
        requiredSkills: [...currentSkills, skill]
      });
      setSkillInput('');
      setSkillSuggestions([]);
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setFormData({
      ...formData,
      requiredSkills: (formData.requiredSkills || []).filter(s => s !== skillToRemove)
    });
  };

  const openCreateModal = () => {
    setEditingJob(null);
    setFormData({
      title: '',
      description: '',
      requiredSkills: [],
      requiredYearsExp: 0,
      location: '',
      department: '',
      employmentType: 'full-time',
      salary: ''
    });
    setShowModal(true);
  };

  const openEditModal = (job: Job) => {
    setEditingJob(job);
    setFormData({
      title: job.title,
      description: job.description,
      // FIX #2: Handle null skills when opening Edit Modal
      requiredSkills: job.requiredSkills || [],
      requiredYearsExp: job.requiredYearsExp,
      location: job.location,
      department: job.department,
      employmentType: job.employmentType,
      salary: job.salary || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingJob
        ? `${serverUrl}/jobs/${editingJob.id}`
        : `${serverUrl}/jobs`;
      
      const method = editingJob ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchJobs();
        setShowModal(false);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save job');
      }
    } catch (error) {
      console.error('Error saving job:', error);
      alert('Failed to save job');
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job?')) return;

    try {
      const response = await fetch(`${serverUrl}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        await fetchJobs();
      } else {
        alert('Failed to delete job');
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      alert('Failed to delete job');
    }
  };

  const toggleArchive = async (job: Job) => {
    try {
      const response = await fetch(`${serverUrl}/jobs/${job.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          ...job,
          status: job.status === 'active' ? 'archived' : 'active'
        })
      });

      if (response.ok) {
        await fetchJobs();
      }
    } catch (error) {
      console.error('Error archiving job:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading jobs...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl text-gray-900">Job Postings</h2>
          <p className="text-gray-600">Manage your job listings</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl"
        >
          <Plus className="w-5 h-5" />
          Create Job
        </button>
      </div>

      {/* Jobs Grid */}
      {jobs.length === 0 ? (
        <div className="text-center py-12">
          <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No jobs posted yet. Create your first job posting!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {jobs.map(job => (
            <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl text-gray-900">{job.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      job.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                  {/* Join non-empty items with a bullet point automatically */}
                    {[
                      job.location, 
                      job.department, 
                      job.employmentType, 
                      job.requiredYearsExp ? `${job.requiredYearsExp}+ years` : null
                      ]
                      .filter(Boolean) // Removes null/undefined/empty strings
                      .join(' • ')}    {/* Joins them with the dot */}
                  </div>
                  <p className="text-gray-700 mb-3 line-clamp-2">{job.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {/* FIX #3: Handle null skills in display logic */}
                    {(job.requiredSkills || []).slice(0, 5).map(skill => (
                      <span key={skill} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm">
                        {skill}
                      </span>
                    ))}
                    {(job.requiredSkills || []).length > 5 && (
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">
                        +{(job.requiredSkills || []).length - 5} more
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => openEditModal(job)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => toggleArchive(job)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title={job.status === 'active' ? 'Archive' : 'Activate'}
                  >
                    <Archive className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(job.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h3 className="text-2xl text-gray-900">
                {editingJob ? 'Edit Job' : 'Create New Job'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Job Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-2">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Employment Type</label>
                  <select
                    value={formData.employmentType}
                    onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-2">Required Years of Experience</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.requiredYearsExp}
                    onChange={(e) => setFormData({ ...formData, requiredYearsExp: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Salary Range (Optional)</label>
                <input
                  type="text"
                  value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., $80,000 - $120,000"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Required Skills</label>
                <div className="relative">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => handleSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && skillInput) {
                        e.preventDefault();
                        addSkill(skillInput);
                      }
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Type to search skills..."
                  />
                  {skillSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-10">
                      {skillSuggestions.map(skill => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => addSkill(skill)}
                          className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors"
                        >
                          {skill}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {(formData.requiredSkills || []).map(skill => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="hover:text-blue-900"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg"
                >
                  {editingJob ? 'Update Job' : 'Create Job'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}