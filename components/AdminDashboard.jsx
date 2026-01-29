import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { 
  Users, FileText, CheckCircle, BarChart3, LogOut, Loader2, 
  Play, Pause, Volume2, X, ChevronLeft, ChevronRight, Search,
  Clock, Mic, MessageSquare, Award, Calendar, Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

// Audio Player Component
const AudioPlayer = ({ url, label, duration }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
      <audio 
        ref={audioRef}
        src={url}
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onLoadedMetadata={(e) => setAudioDuration(e.target.duration)}
        onEnded={() => setIsPlaying(false)}
      />
      <button
        onClick={togglePlay}
        className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors"
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-700">{label}</div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{formatTime(currentTime)}</span>
          <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all" 
              style={{ width: `${(currentTime / audioDuration) * 100}%` }}
            />
          </div>
          <span>{formatTime(audioDuration)}</span>
        </div>
      </div>
    </div>
  );
};

// Interview Details Modal
const InterviewDetailsModal = ({ interview, onClose }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const loadDetails = async () => {
      try {
        const data = await api.getInterviewDetails(interview._id);
        setDetails(data);
      } catch (error) {
        console.error('Failed to load interview details:', error);
      } finally {
        setLoading(false);
      }
    };
    loadDetails();
  }, [interview._id]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Interview Details</h2>
            <p className="text-sm text-slate-500">
              {details?.interview?.user?.name} - {details?.interview?.role}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="flex border-b border-slate-200">
          {['overview', 'responses', 'recordings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Status</div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    details?.interview?.status === 'COMPLETED' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {details?.interview?.status}
                  </span>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Level</div>
                  <div className="text-sm font-medium text-slate-900">
                    {details?.interview?.level || 'N/A'}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Duration</div>
                  <div className="text-sm font-medium text-slate-900">
                    {Math.floor((details?.interview?.durationSeconds || 0) / 60)} mins
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Date</div>
                  <div className="text-sm font-medium text-slate-900">
                    {new Date(details?.interview?.date).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {details?.interview?.feedback && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Award className="text-amber-500" size={20} />
                    Performance Scores
                  </h3>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {details?.interview?.feedback?.overallScore || '-'}%
                      </div>
                      <div className="text-sm text-slate-500">Overall</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-600">
                        {details?.interview?.feedback?.technicalScore || '-'}%
                      </div>
                      <div className="text-sm text-slate-500">Technical</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-emerald-600">
                        {details?.interview?.feedback?.communicationScore || '-'}%
                      </div>
                      <div className="text-sm text-slate-500">Communication</div>
                    </div>
                  </div>
                </div>
              )}

              {details?.interview?.feedback && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-emerald-50 rounded-lg p-4">
                    <h4 className="font-semibold text-emerald-800 mb-2">Strengths</h4>
                    <ul className="space-y-1">
                      {details?.interview?.feedback?.strengths?.map((s, i) => (
                        <li key={i} className="text-sm text-emerald-700 flex items-start gap-2">
                          <span className="text-emerald-500">✓</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4">
                    <h4 className="font-semibold text-amber-800 mb-2">Areas to Improve</h4>
                    <ul className="space-y-1">
                      {details?.interview?.feedback?.weaknesses?.map((w, i) => (
                        <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                          <span className="text-amber-500">→</span> {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'responses' && (
            <div className="space-y-4">
              {details?.qaHistory?.length === 0 ? (
                <p className="text-center text-slate-400 py-8">No responses recorded</p>
              ) : (
                details?.qaHistory?.map((qa, index) => {
                  // Find matching audio recording for this question (index + 1 because questionIndex is 1-based)
                  const audioRecording = details?.audioRecordings?.find(
                    r => r.questionIndex === index + 1
                  );
                  
                  return (
                    <div key={index} className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded">
                            Q{index + 1}
                          </span>
                          <span className="text-sm font-medium text-slate-700">{qa.question}</span>
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        {qa.hasAudioData && audioRecording?.url ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                              <Mic size={12} />
                              <span>Audio Response</span>
                            </div>
                            <AudioPlayer 
                              url={audioRecording.url}
                              label={`Response ${index + 1}`}
                              duration={audioRecording.durationSeconds}
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                              <MessageSquare size={12} />
                              <span>Text Response</span>
                            </div>
                            <p className="text-sm text-slate-600">{qa.answer}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'recordings' && (
            <div className="space-y-4">
              {details?.audioRecordings?.length === 0 ? (
                <div className="text-center py-12">
                  <Mic className="mx-auto text-slate-300 mb-3" size={48} />
                  <p className="text-slate-400">No audio recordings for this interview</p>
                </div>
              ) : (
                details?.audioRecordings?.map((recording, index) => (
                  <AudioPlayer 
                    key={recording.id}
                    url={recording.url}
                    label={`Response ${recording.questionIndex}`}
                    duration={recording.durationSeconds}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [interviews, setInterviews] = useState([]);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('dashboard'); // 'dashboard' or 'interviews'
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

  useEffect(() => {
    if (view === 'interviews') {
      loadInterviews();
    }
  }, [view, page, statusFilter]);

  const loadInterviews = async () => {
    try {
      const data = await api.getAllInterviews(page, 20, statusFilter, searchTerm);
      setInterviews(data.interviews);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to load interviews:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadInterviews();
  };

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
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <div className="bg-blue-600 p-1.5 rounded-lg">
                 <BarChart3 size={20} />
               </div>
               <span className="font-bold text-xl">Zi MockMate Admin</span>
             </div>
             
             {/* Navigation Tabs */}
             <div className="hidden md:flex items-center gap-1 ml-8">
               <button 
                 onClick={() => setView('dashboard')}
                 className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                   view === 'dashboard' 
                     ? 'bg-slate-700 text-white' 
                     : 'text-slate-400 hover:text-white hover:bg-slate-800'
                 }`}
               >
                 Dashboard
               </button>
               <button 
                 onClick={() => setView('interviews')}
                 className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                   view === 'interviews' 
                     ? 'bg-slate-700 text-white' 
                     : 'text-slate-400 hover:text-white hover:bg-slate-800'
                 }`}
               >
                 All Interviews
               </button>
             </div>
           </div>
           
           <button 
             onClick={handleLogout} 
             className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-all shadow-sm"
           >
             <LogOut size={18} /> 
             <span className="hidden md:inline">Logout</span>
           </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        
        {view === 'dashboard' ? (
          <>
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
               <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                 <h2 className="text-lg font-bold text-slate-900">Recent Interviews</h2>
                 <button 
                   onClick={() => setView('interviews')}
                   className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                 >
                   View All →
                 </button>
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
                       <th className="px-6 py-3">Audio</th>
                       <th className="px-6 py-3"></th>
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
                         <td className="px-6 py-3">
                           {interview.audioCount > 0 ? (
                             <span className="flex items-center gap-1 text-blue-600">
                               <Mic size={14} />
                               <span className="text-xs">{interview.audioCount}</span>
                             </span>
                           ) : (
                             <span className="text-slate-300">-</span>
                           )}
                         </td>
                         <td className="px-6 py-3">
                           <button
                             onClick={() => setSelectedInterview(interview)}
                             className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                           >
                             View
                           </button>
                         </td>
                       </tr>
                     ))}
                     {stats?.recentInterviews.length === 0 && (
                       <tr>
                         <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                           No recent activity found.
                         </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
          </>
        ) : (
          /* All Interviews View */
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Filters */}
            <div className="p-6 border-b border-slate-100 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">All Interviews</h2>
              
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <form onSubmit={handleSearch} className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search by name, email, or role..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </form>
                
                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <Filter size={18} className="text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-900 font-medium">
                  <tr>
                    <th className="px-6 py-3">Candidate</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Questions</th>
                    <th className="px-6 py-3">Audio</th>
                    <th className="px-6 py-3">Score</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {interviews.map((interview) => (
                    <tr key={interview._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-900">
                        {interview.user?.name || 'Unknown'}
                        <div className="text-xs text-slate-400">{interview.user?.email}</div>
                      </td>
                      <td className="px-6 py-3">{interview.role}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold
                          ${interview.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 
                            interview.status === 'ARCHIVED' ? 'bg-slate-100 text-slate-700' :
                            'bg-blue-100 text-blue-700'}
                        `}>
                          {interview.status}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} className="text-slate-400" />
                          {new Date(interview.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1">
                          <MessageSquare size={14} className="text-slate-400" />
                          {interview.questionCount || 0}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        {interview.audioCount > 0 ? (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Volume2 size={14} />
                            <span className="text-xs font-medium">{interview.audioCount} recordings</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">No recordings</span>
                        )}
                      </td>
                      <td className="px-6 py-3 font-medium">
                        {interview.feedback?.overallScore ? (
                          <span className={`${
                            interview.feedback.overallScore >= 70 ? 'text-emerald-600' :
                            interview.feedback.overallScore >= 50 ? 'text-amber-600' :
                            'text-red-600'
                          }`}>
                            {interview.feedback.overallScore}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => setSelectedInterview(interview)}
                          className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {interviews.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                        No interviews found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Showing {(page - 1) * pagination.limit + 1} - {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-sm text-slate-600">
                    Page {page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="p-2 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interview Details Modal */}
      {selectedInterview && (
        <InterviewDetailsModal 
          interview={selectedInterview} 
          onClose={() => setSelectedInterview(null)} 
        />
      )}
    </div>
  );
};