import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Button } from './ui/Button';
import { Play, FileText, Trash2, Loader2, Plus } from 'lucide-react';

export const Dashboard = ({ onStartNew, onResume, onViewReport }) => {
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
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Your Interviews</h1>
            <p className="text-slate-500">Track your progress and review feedback.</p>
          </div>
          <Button onClick={onStartNew} size="lg" className="shadow-lg shadow-blue-500/20">
            <Plus size={20} className="mr-2" /> Start New Interview
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-blue-500" size={40} />
          </div>
        ) : interviews.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
              <FileText size={40} />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Interviews Yet</h3>
            <p className="text-slate-500 mb-8">Start your first mock interview to see it here.</p>
            <Button onClick={onStartNew}>Create Interview</Button>
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