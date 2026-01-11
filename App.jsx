import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { CandidateSession } from './components/CandidateSession';
import { AppState } from './types';
import { Code2, ArrowRight } from 'lucide-react';

const LandingPage = () => {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center p-6">
            <div className="p-4 bg-white rounded-2xl shadow-lg mb-6">
                <Code2 size={48} className="text-blue-600" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">MockMate AI</h1>
            <p className="text-lg text-slate-600 max-w-2xl mb-8">
                Master your interviews with AI-driven mock sessions, resume analysis, and real-time feedback.
            </p>
            <button 
                onClick={() => navigate('/mockmate/login')}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
            >
                Get Started <ArrowRight size={20} />
            </button>
        </div>
    );
};

const ProtectedCandidateRoute = ({ children }) => {
    const user = useAppStore(s => s.user);
    const token = localStorage.getItem('token');
    
    if (!user && !token) {
        return <Navigate to="/mockmate/login" replace />;
    }
    return <>{children}</>;
};

const ProtectedAdminRoute = ({ children }) => {
    const user = useAppStore(s => s.user);
    const token = localStorage.getItem('token');
    
    if ((!user && !token)) {
        return <Navigate to="/mockmate/login" replace />;
    }
    
    if (user && !user.isAdmin) {
        return <Navigate to="/mockmate/candidate/dashboard" replace />;
    }
    
    return <>{children}</>;
};

const DashboardWrapper = () => {
    const navigate = useNavigate();
    const { setActiveInterviewId, setAppState, setUser } = useAppStore();

    const handleStartNew = () => {
        setAppState(AppState.LANDING); 
        navigate('/mockmate/candidate/practice');
    };

    const handleResume = (interview) => {
        setActiveInterviewId(interview._id);
        navigate('/mockmate/candidate/practice');
    };

    const handleViewReport = (feedback) => {
        alert("Detailed report view is available at the end of the interview session.");
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        navigate('/mockmate/login');
    };

    return (
        <div className="relative">
            <button 
                onClick={handleLogout} 
                className="absolute top-6 right-6 text-sm text-slate-500 hover:text-red-600"
            >
                Logout
            </button>
            <Dashboard 
                onStartNew={handleStartNew} 
                onResume={handleResume} 
                onViewReport={handleViewReport} 
            />
        </div>
    );
};

export default function App() {
  const { setUser } = useAppStore();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
        if (!useAppStore.getState().user) {
             // Rehydrate user logic here if needed, for now stubbed
             setUser({ _id: 'loaded', name: 'User', email: '...', isAdmin: false });
        }
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/mockmate" replace />} />
        
        <Route path="/mockmate" element={<LandingPage />} />
        
        <Route path="/mockmate/login" element={
            <Auth onLoginSuccess={(u) => setUser(u)} />
        } />

        {/* Candidate Routes */}
        <Route path="/mockmate/candidate/dashboard" element={
            <ProtectedCandidateRoute>
                <DashboardWrapper />
            </ProtectedCandidateRoute>
        } />
        
        <Route path="/mockmate/candidate/practice" element={
            <ProtectedCandidateRoute>
                <CandidateSession />
            </ProtectedCandidateRoute>
        } />

        {/* Admin Routes */}
        <Route path="/mockmate/admin" element={
            <ProtectedAdminRoute>
                <AdminDashboard />
            </ProtectedAdminRoute>
        } />
        
      </Routes>
    </BrowserRouter>
  );
}