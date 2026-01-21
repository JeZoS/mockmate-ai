import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { api } from '../services/api';
import { 
  User, Briefcase, Code, Upload, X, FileText, ArrowLeft,
  Linkedin, Github, Phone, Target, Loader2, CheckCircle, Save, Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { MenuButton } from './MenuButton';
import { SideDrawer } from './SideDrawer';

const experienceLevels = [
  { value: 'fresher', label: 'Fresher (0-1 years)' },
  { value: 'junior', label: 'Junior (1-3 years)' },
  { value: 'mid', label: 'Mid-Level (3-5 years)' },
  { value: 'senior', label: 'Senior (5-8 years)' },
  { value: 'lead', label: 'Lead (8-12 years)' },
  { value: 'manager', label: 'Manager (12+ years)' }
];

export const UserProfile = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAppStore();
  const fileInputRef = useRef(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    experienceLevel: '',
    yearsOfExperience: 0,
    currentRole: '',
    targetRole: '',
    skills: '',
    linkedinUrl: '',
    githubUrl: ''
  });
  
  const [currentResume, setCurrentResume] = useState(null);
  const [newResume, setNewResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [deletingResume, setDeletingResume] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const profile = await api.getProfile();
      setFormData({
        name: profile.name || '',
        phone: profile.phone || '',
        experienceLevel: profile.experienceLevel || '',
        yearsOfExperience: profile.yearsOfExperience || 0,
        currentRole: profile.currentRole || '',
        targetRole: profile.targetRole || '',
        skills: Array.isArray(profile.skills) ? profile.skills.join(', ') : '',
        linkedinUrl: profile.linkedinUrl || '',
        githubUrl: profile.githubUrl || ''
      });
      if (profile.resumeFileName) {
        setCurrentResume({
          name: profile.resumeFileName,
          url: profile.resumeSignedUrl
        });
      }
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        setError('Only PDF, DOC, and DOCX files are allowed');
        return;
      }
      setNewResume(file);
      setError('');
    }
  };

  const handleRemoveNewResume = () => {
    setNewResume(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteCurrentResume = async () => {
    if (!confirm('Are you sure you want to delete your resume?')) return;
    
    setDeletingResume(true);
    try {
      await api.deleteResume();
      setCurrentResume(null);
      setSuccess('Resume deleted successfully');
    } catch (err) {
      setError('Failed to delete resume');
    } finally {
      setDeletingResume(false);
    }
  };

  const handleUploadResume = async () => {
    if (!newResume) return;
    
    setUploadingResume(true);
    setError('');
    try {
      const result = await api.uploadResume(newResume);
      setCurrentResume({
        name: result.resumeFileName,
        url: result.resumeUrl
      });
      setNewResume(null);
      setSuccess('Resume uploaded successfully');
    } catch (err) {
      setError('Failed to upload resume');
    } finally {
      setUploadingResume(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const updatedUser = await api.updateProfile(formData);
      setUser(updatedUser);
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/mockmate/candidate/dashboard')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Profile Settings</h1>
              <p className="text-sm text-slate-500">Manage your personal information</p>
            </div>
          </div>
          <MenuButton onClick={() => setIsDrawerOpen(true)} />
        </div>
      </div>

      <SideDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

      <div className="max-w-4xl mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
            <X size={16} /> {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle size={16} /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <User size={18} className="text-blue-600" />
                Basic Information
              </h2>
            </div>
            <div className="p-6 grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Experience Level</label>
                <select
                  name="experienceLevel"
                  value={formData.experienceLevel}
                  onChange={handleChange}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Select level</option>
                  {experienceLevels.map(level => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Professional Details */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Briefcase size={18} className="text-purple-600" />
                Professional Details
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Current Role</label>
                  <input
                    type="text"
                    name="currentRole"
                    value={formData.currentRole}
                    onChange={handleChange}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g., Software Engineer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Target Role</label>
                  <input
                    type="text"
                    name="targetRole"
                    value={formData.targetRole}
                    onChange={handleChange}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g., Senior Developer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Skills</label>
                <input
                  type="text"
                  name="skills"
                  value={formData.skills}
                  onChange={handleChange}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., JavaScript, React, Node.js, Python"
                />
                <p className="text-xs text-slate-500 mt-1">Separate skills with commas</p>
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Code size={18} className="text-emerald-600" />
                Social Links
              </h2>
            </div>
            <div className="p-6 grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Linkedin size={14} className="inline mr-1" /> LinkedIn
                </label>
                <input
                  type="url"
                  name="linkedinUrl"
                  value={formData.linkedinUrl}
                  onChange={handleChange}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Github size={14} className="inline mr-1" /> GitHub
                </label>
                <input
                  type="url"
                  name="githubUrl"
                  value={formData.githubUrl}
                  onChange={handleChange}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://github.com/username"
                />
              </div>
            </div>
          </div>

          {/* Resume */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-amber-600" />
                Resume
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {/* Current Resume */}
              {currentResume && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <FileText className="text-blue-500" size={20} />
                  <div className="flex-1">
                    <p className="font-medium text-slate-700">{currentResume.name}</p>
                    <p className="text-xs text-slate-500">Current resume</p>
                  </div>
                  {currentResume.url && (
                    <a
                      href={currentResume.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      View
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleDeleteCurrentResume}
                    disabled={deletingResume}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    {deletingResume ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                  </button>
                </div>
              )}

              {/* Upload New Resume */}
              {!newResume ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
                >
                  <Upload className="mx-auto text-slate-400 mb-2" size={28} />
                  <p className="text-slate-600 font-medium">
                    {currentResume ? 'Upload a new resume' : 'Click to upload your resume'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">PDF, DOC, or DOCX (max 10MB)</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircle className="text-emerald-500" size={20} />
                  <div className="flex-1">
                    <p className="font-medium text-slate-700">{newResume.name}</p>
                    <p className="text-xs text-slate-500">{(newResume.size / 1024).toFixed(1)} KB - Ready to upload</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleUploadResume}
                    isLoading={uploadingResume}
                  >
                    <Upload size={14} className="mr-1" /> Upload
                  </Button>
                  <button
                    type="button"
                    onClick={handleRemoveNewResume}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <Button type="submit" isLoading={saving} className="px-8">
              <Save size={18} className="mr-2" />
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
