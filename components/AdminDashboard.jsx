import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Users, FileText, CheckCircle, BarChart3, LogOut, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { setUser, resetSession } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await api.getAdminStats();
        setStats(data);
      } catch (error) {
        console.error("Admin fetch failed", error);
        navigate('/mockmate/login');
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    resetSession();
    navigate('/mockmate/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const completedCount = stats?.statusCounts.find(s => s._id === 'COMPLETED')?.count || 0;
  const inProgressCount = stats?.statusCounts.find(s => s._id === 'IN_PROGRESS')?.count || 0;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Navbar */}
      <div className="bg-slate-900 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
           <div className="flex items-center gap-2">
             <div className="bg-blue-600 p-1.5 rounded-lg">
               <BarChart3 size={20} />
             </div>
             <span className="font-bold text-xl">MockMate Admin</span>
           </div>
           <button onClick={handleLogout} className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
             <LogOut size={18} /> Logout
           </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-slate-500 font-medium">Total Users</h3>
                 <Users className="text-blue-500" size={24} />
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats?.totalUsers}</p>
           </div>
           
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-slate-500 font-medium">Total Interviews</h3>
                 <FileText className="text-purple-500" size={24} />
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats?.totalInterviews}</p>
           </div>

           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-slate-500 font-medium">Completed</h3>
                 <CheckCircle className="text-emerald-500" size={24} />
              </div>
              <p className="text-3xl font-bold text-slate-900">{completedCount}</p>
           </div>

           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-slate-500 font-medium">Active Now</h3>
                 <Loader2 className="text-amber-500 animate-spin-slow" size={24} />
              </div>
              <p className="text-3xl font-bold text-slate-900">{inProgressCount}</p>
           </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="p-6 border-b border-slate-100">
             <h2 className="text-lg font-bold text-slate-900">Recent Interviews</h2>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm text-slate-600">
               <thead className="bg-slate-50 text-slate-900 font-medium">
                 <tr>
                   <th className="px-6 py-3">Candidate</th>
                   <th className="px-6 py-3">Role</th>
                   <th className="px-6 py-3">Status</th>
                   <th className="px-6 py-3">Date</th>
                   <th className="px-6 py-3">Score</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {stats?.recentInterviews.map((interview) => (
                   <tr key={interview._id} className="hover:bg-slate-50 transition-colors">
                     <td className="px-6 py-3 font-medium text-slate-900">
                       {interview.user?.name || 'Unknown'}
                       <div className="text-xs text-slate-400">{interview.user?.email}</div>
                     </td>
                     <td className="px-6 py-3">{interview.role}</td>
                     <td className="px-6 py-3">
                       <span className={`px-2 py-1 rounded text-xs font-semibold
                         ${interview.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}
                       `}>
                         {interview.status}
                       </span>
                     </td>
                     <td className="px-6 py-3">{new Date(interview.date).toLocaleDateString()}</td>
                     <td className="px-6 py-3 font-medium">
                       {interview.feedback?.overallScore ? `${interview.feedback.overallScore}%` : '-'}
                     </td>
                   </tr>
                 ))}
                 {stats?.recentInterviews.length === 0 && (
                   <tr>
                     <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                       No recent activity found.
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    </div>
  );
};