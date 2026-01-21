import React, { useState, useRef } from 'react';
import { Button } from './ui/Button';
import { api } from '../services/api';
import { 
  User, Briefcase, Code, Upload, X, FileText, 
  Linkedin, Github, Phone, Target, Loader2, CheckCircle 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

const experienceLevels = [
  { value: 'fresher', label: 'Fresher (0-1 years)', description: 'Just starting out' },
  { value: 'junior', label: 'Junior (1-3 years)', description: 'Building experience' },
  { value: 'mid', label: 'Mid-Level (3-5 years)', description: 'Solid experience' },
  { value: 'senior', label: 'Senior (5-8 years)', description: 'Expert level' },
  { value: 'lead', label: 'Lead (8-12 years)', description: 'Leadership experience' },
  { value: 'manager', label: 'Manager (12+ years)', description: 'Management & Strategy' }
];

export const ProfileSetup = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAppStore();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: '',
    experienceLevel: '',
    yearsOfExperience: 0,
    currentRole: '',
    targetRole: '',
    skills: '',
    linkedinUrl: '',
    githubUrl: ''
  });
  
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleExperienceSelect = (level) => {
    setFormData(prev => ({ ...prev, experienceLevel: level }));
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
      setResume(file);
      setError('');
    }
  };

  const handleRemoveResume = () => {
    setResume(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        setError('Please enter your name');
        return;
      }
      if (!formData.experienceLevel) {
        setError('Please select your experience level');
        return;
      }
      setError('');
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // First, upload resume if selected
      if (resume) {
        setUploadingResume(true);
        await api.uploadResume(resume);
        setUploadingResume(false);
      }

      // Then complete profile setup
      const updatedUser = await api.completeProfileSetup(formData);
      setUser(updatedUser);
      
      navigate('/mockmate/candidate/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to save profile');
      setUploadingResume(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      const updatedUser = await api.completeProfileSetup({ 
        name: formData.name || user?.name,
        experienceLevel: formData.experienceLevel || 'fresher'
      });
      setUser(updatedUser);
      navigate('/mockmate/candidate/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 text-white">
          <h1 className="text-2xl font-bold">Complete Your Profile</h1>
          <p className="text-blue-100 mt-1">Help us personalize your interview experience</p>
          
          {/* Progress Indicator */}
          <div className="flex items-center gap-2 mt-4">
            <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-white' : 'bg-white/30'}`} />
            <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-white' : 'bg-white/30'}`} />
          </div>
          <div className="flex justify-between text-xs mt-2 text-blue-100">
            <span>Basic Info</span>
            <span>Professional Details</span>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
              <X size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <User size={16} className="inline mr-2" />
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter your full name"
                  />
                </div>

                {/* Experience Level */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    <Briefcase size={16} className="inline mr-2" />
                    Experience Level *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {experienceLevels.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => handleExperienceSelect(level.value)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          formData.experienceLevel === level.value
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-medium text-slate-800">{level.label}</div>
                        <div className="text-xs text-slate-500">{level.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="button" onClick={handleNext}>
                    Next Step
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                {/* Current & Target Role */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <Briefcase size={16} className="inline mr-2" />
                      Current Role
                    </label>
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
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <Target size={16} className="inline mr-2" />
                      Target Role
                    </label>
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

                {/* Skills */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Code size={16} className="inline mr-2" />
                    Skills
                  </label>
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

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Phone size={16} className="inline mr-2" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                {/* Social Links */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <Linkedin size={16} className="inline mr-2" />
                      LinkedIn URL
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
                      <Github size={16} className="inline mr-2" />
                      GitHub URL
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

                {/* Resume Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <FileText size={16} className="inline mr-2" />
                    Upload Resume
                  </label>
                  
                  {!resume ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
                    >
                      <Upload className="mx-auto text-slate-400 mb-3" size={32} />
                      <p className="text-slate-600 font-medium">Click to upload your resume</p>
                      <p className="text-xs text-slate-400 mt-1">PDF, DOC, or DOCX (max 10MB)</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <CheckCircle className="text-emerald-500" size={20} />
                      <div className="flex-1">
                        <p className="font-medium text-slate-700">{resume.name}</p>
                        <p className="text-xs text-slate-500">{(resume.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveResume}
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

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-slate-600 hover:text-slate-800 font-medium"
                  >
                    ← Back
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSkip}
                      disabled={loading}
                      className="text-slate-500 hover:text-slate-700 text-sm"
                    >
                      Skip for now
                    </button>
                    <Button type="submit" isLoading={loading}>
                      {uploadingResume ? (
                        <>
                          <Loader2 className="animate-spin mr-2" size={16} />
                          Uploading Resume...
                        </>
                      ) : (
                        'Complete Setup'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
