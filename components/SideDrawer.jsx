import React from 'react';
import { X, LogOut, User, LayoutDashboard, PlayCircle, FileText, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

export const SideDrawer = ({ isOpen, onClose }) => {
  const { user, setUser, resetSession } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isOpen) return null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    resetSession();
    navigate('/mockmate/login');
  };

  const handleNavigation = (path) => {
    navigate(path);
    onClose();
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/mockmate/candidate/dashboard' },
    { icon: PlayCircle, label: 'Practice Interview', path: '/mockmate/candidate/practice' },
    { icon: Settings, label: 'Profile Settings', path: '/mockmate/candidate/profile' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="relative w-80 bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 pr-14 border-b border-slate-100">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0">
              <User size={24} />
            </div>
            <div className="overflow-hidden min-w-0">
              <h3 className="font-semibold text-slate-900 truncate">{user?.name || user?.email.split('@')[0]}</h3>
              <p className="text-xs text-slate-500 truncate">{user?.email || 'user@example.com'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
             const isActive = location.pathname === item.path;
             return (
              <button 
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all text-left ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm' 
                    : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left font-medium"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
