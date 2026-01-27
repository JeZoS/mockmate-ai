import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { api } from '../services/api';
import { 
  User, Briefcase, Code, Upload, X, FileText, 
  Linkedin, Github, Phone, Target, Loader2, CheckCircle,
  Sparkles, Globe, GraduationCap, ArrowRight, SkipForward,
  Info, HelpCircle, RefreshCw
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

const roleTypes = [
  { value: 'tech', label: 'Technical', description: 'Software, Engineering, Data, IT', icon: Code },
  { value: 'non-tech', label: 'Non-Technical', description: 'Sales, Marketing, HR, Finance, Ops', icon: Briefcase }
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
    githubUrl: '',
    portfolioUrl: '',
    roleType: 'tech' // Default to tech
  });
  
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Resume Upload, 2: Basic Info, 3: Professional Details
  const [extractedData, setExtractedData] = useState(null);
  const [showExtractedBadge, setShowExtractedBadge] = useState({});
  const [useExistingResume, setUseExistingResume] = useState(false);
  const [showTargetRoleTooltip, setShowTargetRoleTooltip] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Fetch user profile on mount to get resume info
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await api.getProfile();
        setUser(profile);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [setUser]);

  // Check if user has an existing resume
  const hasExistingResume = user?.resumeFileName && user?.resumeUrl;

  const isTechRole = formData.roleType === 'tech';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleExperienceSelect = (level) => {
    setFormData(prev => ({ ...prev, experienceLevel: level }));
  };

  const handleRoleTypeSelect = (type) => {
    setFormData(prev => ({ 
      ...prev, 
      roleType: type,
      // Clear GitHub URL if switching to non-tech
      githubUrl: type === 'non-tech' ? '' : prev.githubUrl
    }));
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 7 * 1024 * 1024) {
        setError('File size must be less than 7MB');
        return;
      }
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        setError('Only PDF, DOC, and DOCX files are allowed');
        return;
      }
      setResume(file);
      setError('');
      
      // Automatically parse the resume
      await parseResumeFile(file);
    }
  };

  const parseResumeFile = async (file) => {
    setParsingResume(true);
    setError('');
    
    try {
      const result = await api.parseResume(file);
      
      if (result.extractedData) {
        setExtractedData(result.extractedData);
        
        // Auto-fill form with extracted data
        const extracted = result.extractedData;
        const fieldsToUpdate = {};
        const badges = {};
        
        if (extracted.name && extracted.name.trim()) {
          fieldsToUpdate.name = extracted.name;
          badges.name = true;
        }
        if (extracted.phone && extracted.phone.trim()) {
          fieldsToUpdate.phone = extracted.phone;
          badges.phone = true;
        }
        if (extracted.currentRole && extracted.currentRole.trim()) {
          fieldsToUpdate.currentRole = extracted.currentRole;
          badges.currentRole = true;
        }
        if (extracted.skills && extracted.skills.length > 0) {
          fieldsToUpdate.skills = Array.isArray(extracted.skills) 
            ? extracted.skills.join(', ') 
            : extracted.skills;
          badges.skills = true;
        }
        if (extracted.linkedinUrl && extracted.linkedinUrl.trim()) {
          fieldsToUpdate.linkedinUrl = extracted.linkedinUrl;
          badges.linkedinUrl = true;
        }
        if (extracted.githubUrl && extracted.githubUrl.trim()) {
          fieldsToUpdate.githubUrl = extracted.githubUrl;
          badges.githubUrl = true;
        }
        if (extracted.portfolioUrl && extracted.portfolioUrl.trim()) {
          fieldsToUpdate.portfolioUrl = extracted.portfolioUrl;
          badges.portfolioUrl = true;
        }
        if (extracted.experienceLevel && extracted.experienceLevel.trim()) {
          fieldsToUpdate.experienceLevel = extracted.experienceLevel;
          badges.experienceLevel = true;
        }
        if (extracted.yearsOfExperience) {
          fieldsToUpdate.yearsOfExperience = extracted.yearsOfExperience;
          badges.yearsOfExperience = true;
        }
        if (extracted.roleType) {
          fieldsToUpdate.roleType = extracted.roleType;
          badges.roleType = true;
        }
        
        setFormData(prev => ({ ...prev, ...fieldsToUpdate }));
        setShowExtractedBadge(badges);
      }
    } catch (err) {
      console.error('Resume parsing error:', err);
      setError('Failed to parse resume. You can still fill in your details manually.');
    } finally {
      setParsingResume(false);
    }
  };

  const handleRemoveResume = () => {
    setResume(null);
    setExtractedData(null);
    setShowExtractedBadge({});
    setUseExistingResume(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUseExistingResume = async () => {
    setUseExistingResume(true);
    setParsingResume(true);
    setError('');
    
    try {
      // Fetch and parse the existing resume
      const result = await api.parseExistingResume();
      
      if (result.extractedData) {
        setExtractedData(result.extractedData);
        
        // Auto-fill form with extracted data
        const extracted = result.extractedData;
        const fieldsToUpdate = {};
        const badges = {};
        
        if (extracted.name && extracted.name.trim()) {
          fieldsToUpdate.name = extracted.name;
          badges.name = true;
        }
        if (extracted.phone && extracted.phone.trim()) {
          fieldsToUpdate.phone = extracted.phone;
          badges.phone = true;
        }
        if (extracted.currentRole && extracted.currentRole.trim()) {
          fieldsToUpdate.currentRole = extracted.currentRole;
          badges.currentRole = true;
        }
        if (extracted.skills && extracted.skills.length > 0) {
          fieldsToUpdate.skills = Array.isArray(extracted.skills) 
            ? extracted.skills.join(', ') 
            : extracted.skills;
          badges.skills = true;
        }
        if (extracted.linkedinUrl && extracted.linkedinUrl.trim()) {
          fieldsToUpdate.linkedinUrl = extracted.linkedinUrl;
          badges.linkedinUrl = true;
        }
        if (extracted.githubUrl && extracted.githubUrl.trim()) {
          fieldsToUpdate.githubUrl = extracted.githubUrl;
          badges.githubUrl = true;
        }
        if (extracted.portfolioUrl && extracted.portfolioUrl.trim()) {
          fieldsToUpdate.portfolioUrl = extracted.portfolioUrl;
          badges.portfolioUrl = true;
        }
        if (extracted.experienceLevel && extracted.experienceLevel.trim()) {
          fieldsToUpdate.experienceLevel = extracted.experienceLevel;
          badges.experienceLevel = true;
        }
        if (extracted.yearsOfExperience) {
          fieldsToUpdate.yearsOfExperience = extracted.yearsOfExperience;
          badges.yearsOfExperience = true;
        }
        if (extracted.roleType) {
          fieldsToUpdate.roleType = extracted.roleType;
          badges.roleType = true;
        }
        
        setFormData(prev => ({ ...prev, ...fieldsToUpdate }));
        setShowExtractedBadge(badges);
      }
    } catch (err) {
      console.error('Resume parsing error:', err);
      setError('Failed to parse existing resume. You can upload a new one or fill details manually.');
      setUseExistingResume(false);
    } finally {
      setParsingResume(false);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      // Resume step - can proceed with or without resume
      setError('');
      setStep(2);
    } else if (step === 2) {
      if (!formData.name.trim()) {
        setError('Please enter your name');
        return;
      }
      if (!formData.experienceLevel) {
        setError('Please select your experience level');
        return;
      }
      if (!formData.roleType) {
        setError('Please select your role type');
        return;
      }
      setError('');
      setStep(3);
    }
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const updatedUser = await api.completeProfileSetup(formData);
      setUser(updatedUser);
      navigate('/mockmate/candidate/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      const updatedUser = await api.completeProfileSetup({ 
        name: formData.name || user?.name,
        experienceLevel: formData.experienceLevel || 'fresher',
        roleType: formData.roleType || 'tech'
      });
      setUser(updatedUser);
      navigate('/mockmate/candidate/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const ExtractedBadge = () => (
    <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-2">
      <Sparkles size={10} /> Auto-filled
    </span>
  );

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
            <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-white' : 'bg-white/30'}`} />
          </div>
          <div className="flex justify-between text-xs mt-2 text-blue-100">
            <span>Resume</span>
            <span>Basic Info</span>
            <span>Details</span>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
              <X size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Step 1: Resume Upload */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileText className="text-blue-600" size={28} />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-800">Upload Your Resume</h2>
                  <p className="text-slate-500 mt-2">We'll extract your details automatically using AI</p>
                </div>

                {/* Info about updating details later */}
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <Info size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-800">
                    AI extraction may not be 100% accurate. Don't worry — you can review and update all details in the next steps or later from your profile settings.
                  </p>
                </div>

                {/* Loading state while fetching profile */}
                {loadingProfile ? (
                  <div className="flex items-center justify-center gap-3 p-8 border-2 border-dashed border-slate-200 rounded-xl">
                    <Loader2 className="animate-spin text-slate-400" size={24} />
                    <span className="text-slate-500">Checking for existing resume...</span>
                  </div>
                ) : !resume && !useExistingResume ? (
                  <div className="space-y-4">
                    {/* Existing Resume Option */}
                    {hasExistingResume && false && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="text-blue-600" size={20} />
                            <div>
                              <p className="font-medium text-slate-700">Previously uploaded resume</p>
                              <p className="text-xs text-slate-500">{user.resumeFileName}</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={handleUseExistingResume}
                            disabled={parsingResume}
                          >
                            <RefreshCw size={14} className="mr-1" />
                            Use This
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Upload New Resume */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                    >
                      <Upload className="mx-auto text-slate-400 group-hover:text-blue-500 mb-4 transition-colors" size={40} />
                      <p className="text-slate-600 font-medium">
                        {hasExistingResume ? 'Or upload a new resume' : 'Click to upload your resume'}
                      </p>
                      <p className="text-sm text-slate-400 mt-2">PDF, DOC, or DOCX (max 7MB)</p>
                      <div className="mt-4 flex items-center justify-center gap-2 text-purple-600 text-sm">
                        <Sparkles size={14} />
                        <span>AI will extract skills, experience & more</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <CheckCircle className="text-emerald-500 flex-shrink-0" size={24} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-700 truncate">
                          {resume ? resume.name : user?.resumeFileName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {resume ? `${(resume.size / 1024).toFixed(1)} KB` : 'Using existing resume'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveResume}
                        disabled={parsingResume}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {parsingResume && (
                      <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <Loader2 className="animate-spin text-blue-600" size={20} />
                        <span className="text-blue-700 font-medium">Analyzing resume with AI...</span>
                      </div>
                    )}

                    {extractedData && !parsingResume && (
                      <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                        <div className="flex items-center gap-2 text-purple-700 font-medium mb-3">
                          <Sparkles size={16} />
                          <span>Extracted from resume</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {extractedData.name && (
                            <div className="text-slate-600">
                              <span className="text-slate-400">Name:</span> {extractedData.name}
                            </div>
                          )}
                          {extractedData.currentRole && (
                            <div className="text-slate-600">
                              <span className="text-slate-400">Role:</span> {extractedData.currentRole}
                            </div>
                          )}
                          {extractedData.yearsOfExperience && (
                            <div className="text-slate-600">
                              <span className="text-slate-400">Experience:</span> {extractedData.yearsOfExperience} years
                            </div>
                          )}
                          {extractedData.skills && extractedData.skills.length > 0 && (
                            <div className="text-slate-600 col-span-2">
                              <span className="text-slate-400">Skills:</span> {extractedData.skills.slice(0, 5).join(', ')}{extractedData.skills.length > 5 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="flex items-center justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                  >
                    <SkipForward size={14} />
                    Skip, I'll fill manually
                  </button>
                  <Button 
                    type="button" 
                    onClick={handleNext}
                    disabled={parsingResume}
                  >
                    {(resume || useExistingResume) ? 'Continue' : 'Continue without resume'}
                    <ArrowRight size={16} className="ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Basic Info */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Verification notice if data was extracted */}
                {Object.keys(showExtractedBadge).length > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-blue-800">
                      <strong>Please verify:</strong> We've pre-filled some fields from your resume. Please review and correct any information that may be inaccurate.
                    </p>
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <User size={16} className="inline mr-2" />
                    Full Name *
                    {showExtractedBadge.name && <ExtractedBadge />}
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

                {/* Role Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    <Briefcase size={16} className="inline mr-2" />
                    Role Type *
                    {showExtractedBadge.roleType && <ExtractedBadge />}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {roleTypes.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => handleRoleTypeSelect(type.value)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          formData.roleType === type.value
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <type.icon size={18} className={formData.roleType === type.value ? 'text-blue-600' : 'text-slate-400'} />
                          <span className="font-medium text-slate-800">{type.label}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{type.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Experience Level */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    <GraduationCap size={16} className="inline mr-2" />
                    Experience Level *
                    {showExtractedBadge.experienceLevel && <ExtractedBadge />}
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

                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-slate-600 hover:text-slate-800 font-medium"
                  >
                    ← Back
                  </button>
                  <Button type="button" onClick={handleNext}>
                    Next Step
                    <ArrowRight size={16} className="ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Professional Details */}
            {step === 3 && (
              <div className="space-y-6">
                {/* Verification notice if data was extracted */}
                {Object.keys(showExtractedBadge).length > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-blue-800">
                      <strong>Please verify:</strong> Review the auto-filled fields below and make corrections if needed.
                    </p>
                  </div>
                )}

                {/* Current & Target Role */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <Briefcase size={16} className="inline mr-2" />
                      Current Role
                      {showExtractedBadge.currentRole && <ExtractedBadge />}
                    </label>
                    <input
                      type="text"
                      name="currentRole"
                      value={formData.currentRole}
                      onChange={handleChange}
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder={isTechRole ? "e.g., Software Engineer" : "e.g., Marketing Manager"}
                    />
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <Target size={16} className="inline mr-2" />
                      Target Role
                      <button
                        type="button"
                        className="ml-1 text-slate-400 hover:text-slate-600 inline-flex"
                        onMouseEnter={() => setShowTargetRoleTooltip(true)}
                        onMouseLeave={() => setShowTargetRoleTooltip(false)}
                        onClick={() => setShowTargetRoleTooltip(!showTargetRoleTooltip)}
                      >
                        <HelpCircle size={14} />
                      </button>
                      {showTargetRoleTooltip && (
                        <div className="absolute left-0 top-full mt-1 z-10 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg">
                          <p><strong>Target Role</strong> is the position you're preparing to interview for. This helps us tailor interview questions to your career goals.</p>
                          <p className="mt-1 text-slate-300">Example: If you're a Junior Developer aiming for a Senior role, enter "Senior Developer".</p>
                          <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-800 rotate-45"></div>
                        </div>
                      )}
                    </label>
                    <input
                      type="text"
                      name="targetRole"
                      value={formData.targetRole}
                      onChange={handleChange}
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder={isTechRole ? "e.g., Senior Developer" : "e.g., Director of Marketing"}
                    />
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Code size={16} className="inline mr-2" />
                    {isTechRole ? 'Technical Skills' : 'Key Skills'}
                    {showExtractedBadge.skills && <ExtractedBadge />}
                  </label>
                  <input
                    type="text"
                    name="skills"
                    value={formData.skills}
                    onChange={handleChange}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder={isTechRole 
                      ? "e.g., JavaScript, React, Node.js, Python" 
                      : "e.g., Leadership, Communication, Project Management"
                    }
                  />
                  <p className="text-xs text-slate-500 mt-1">Separate skills with commas</p>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Phone size={16} className="inline mr-2" />
                    Phone Number
                    {showExtractedBadge.phone && <ExtractedBadge />}
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

                {/* Social Links - Conditional */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-slate-700">Professional Links</h3>
                  
                  {/* LinkedIn - Always shown */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <Linkedin size={16} className="inline mr-2" />
                      LinkedIn URL
                      {showExtractedBadge.linkedinUrl && <ExtractedBadge />}
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

                  {/* GitHub - Only for tech roles */}
                  {isTechRole && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        <Github size={16} className="inline mr-2" />
                        GitHub URL
                        {showExtractedBadge.githubUrl && <ExtractedBadge />}
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
                  )}

                  {/* Portfolio - For everyone */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <Globe size={16} className="inline mr-2" />
                      Portfolio / Personal Website
                      {showExtractedBadge.portfolioUrl && <ExtractedBadge />}
                    </label>
                    <input
                      type="url"
                      name="portfolioUrl"
                      value={formData.portfolioUrl}
                      onChange={handleChange}
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="https://yourportfolio.com"
                    />
                  </div>
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
                      Complete Setup
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
