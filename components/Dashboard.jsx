import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Button } from './ui/Button';
import { Play, FileText, Trash2, Loader2, Plus, Code2, Bell, Search, Briefcase, UserCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

// Dashboard Header Component
const DashboardHeader = ({ onMenuClick }) => {
  const { user } = useAppStore();
  
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl text-white">
              <Code2 size={24} />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-slate-900">Zi MockMate</h1>
              <p className="text-xs text-slate-500 -mt-0.5">AI Interview Coach</p>
            </div>
          </div>

          {/* Search Bar - Hidden on mobile */}
          {/* <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search interviews..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div> */}

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            {/* <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button> */}

            {/* User Profile */}
            <button 
              onClick={onMenuClick}
              className="flex items-center gap-3 p-1.5 pr-3 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-slate-700 leading-tight">{user?.name || 'User'}</p>
                {/* <p className="text-xs text-slate-500 leading-tight">{user?.experienceLevel || 'Candidate'}</p> */}
              </div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export const Dashboard = ({ onStartNew, onResume, onViewReport, onMenuClick, onSelectMode }) => {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInterviews = async () => {
    setLoading(true);
    try {
      const data = await api.getMyInterviews();
      setInterviews(data);
    } catch (error) {
      console.error("Failed to fetch interviews", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this interview?")) {
      try {
        await api.deleteInterview(id);
        setInterviews(prev => prev.filter(i => i._id !== id));
      } catch (err) {
        alert("Failed to delete interview.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader onMenuClick={onMenuClick} />
      
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 md:p-8 text-white">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">Welcome back! 👋</h1>
              <p className="text-blue-100 text-sm md:text-base">
                Ready to ace your next interview? Track your progress and keep practicing.
              </p>
            </div>
            <Button 
              onClick={onStartNew} 
              className="bg-blue-30 text-blue-50 hover:bg-blue-50 shadow-lg"
            >
              <Plus size={20} className="mr-2" /> Start New Interview
            </Button>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/20">
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-bold">{interviews.length}</p>
              <p className="text-xs md:text-sm text-blue-100">Total Interviews</p>
            </div>
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-bold">
                {interviews.filter(i => i.status === 'COMPLETED').length}
              </p>
              <p className="text-xs md:text-sm text-blue-100">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-bold">
                {interviews.filter(i => i.status === 'IN_PROGRESS').length}
              </p>
              <p className="text-xs md:text-sm text-blue-100">In Progress</p>
            </div>
          </div>
        </div>

        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Your Interviews</h2>
            <p className="text-sm text-slate-500">Review your practice sessions and feedback</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-blue-500" size={40} />
          </div>
        ) : interviews.length === 0 ? (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Start Your First Interview</h3>
              <p className="text-slate-500">Choose how you'd like to practice</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {/* Option 1: Job Description */}
              <button
                onClick={() => onSelectMode?.("jd")}
                className="group relative flex flex-col items-center p-8 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-400 rounded-2xl transition-all shadow-sm hover:shadow-xl hover:shadow-blue-500/10 text-left"
              >
                <div className="p-4 bg-blue-50 rounded-full mb-6 group-hover:bg-blue-100 group-hover:text-blue-600 text-blue-500 transition-colors">
                  <Briefcase size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900 text-center">Job Description Based</h3>
                <p className="text-sm text-slate-500 text-center">
                  Paste a JD and let the AI extract requirements to grill you on specifics.
                </p>
              </button>

              {/* Option 2: Resume Upload */}
              <button
                onClick={() => onSelectMode?.("resume")}
                className="group relative flex flex-col items-center p-8 bg-white hover:bg-slate-50 border border-slate-200 hover:border-purple-400 rounded-2xl transition-all shadow-sm hover:shadow-xl hover:shadow-purple-500/10 text-left"
              >
                <div className="p-4 bg-purple-50 rounded-full mb-6 group-hover:bg-purple-100 group-hover:text-purple-600 text-purple-500 transition-colors">
                  <FileText size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900 text-center">Resume Based</h3>
                <p className="text-sm text-slate-500 text-center">
                  Upload your resume. The AI will suggest roles and skills to practice.
                </p>
              </button>

              {/* Option 3: General Role */}
              <button
                onClick={() => onSelectMode?.("role")}
                className="group relative flex flex-col items-center p-8 bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-400 rounded-2xl transition-all shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 text-left"
              >
                <div className="p-4 bg-emerald-50 rounded-full mb-6 group-hover:bg-emerald-100 group-hover:text-emerald-600 text-emerald-500 transition-colors">
                  <UserCircle size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900 text-center">Practice for a Role</h3>
                <p className="text-sm text-slate-500 text-center">
                  Mention a role and the AI will customize the session for you.
                </p>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {interviews.map((interview) => (
              <div 
                key={interview._id} 
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg text-slate-900">{interview.role}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide
                      ${interview.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {interview.status.replace('_', ' ')}
                    </span>
                    {interview.language && interview.language !== 'English' && (
                       <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">
                         {interview.language}
                       </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {interview.focusArea} • {interview.level} • {new Date(interview.date).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto">
                  {interview.status === 'IN_PROGRESS' && (
                    <Button 
                      size="sm" 
                      onClick={() => onResume(interview)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Play size={16} className="mr-2" /> Resume
                    </Button>
                  )}
                  {interview.status === 'COMPLETED' && interview.feedback && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onViewReport(interview.feedback)}
                    >
                      <FileText size={16} className="mr-2" /> View Report
                    </Button>
                  )}
                  <button 
                    onClick={(e) => handleDelete(interview._id, e)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};