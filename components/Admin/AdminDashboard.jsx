import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../services/api";
import { DashboardHeader } from "../Dashboard";
import { SideDrawer } from "../SideDrawer";
import {
  Users,
  FileText,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  Zap,
  Coins,
  X,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import { useAppStore } from "../../store/useAppStore";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

const StatsCard = ({
  icon: Icon,
  label,
  value,
  bgColor,
  textColor,
  tooltip,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`p-3 ${bgColor} ${textColor} rounded-xl`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      </div>

      <div
        className={`absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg shadow-xl whitespace-nowrap z-50 transition-all duration-300 ease-out pointer-events-none transform ${
          showTooltip
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-2 scale-95"
        }`}
      >
        {tooltip}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/90"></div>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const { user, setUser, resetSession, setFeedbackData } = useAppStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [userGrowth, setUserGrowth] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedUserId = searchParams.get("userId");
  const viewMode = selectedUserId ? "user-details" : "dashboard";

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserInterviews, setSelectedUserInterviews] = useState([]);
  const [visiblePageStart, setVisiblePageStart] = useState(1);

  useEffect(() => {
    // only fetch stats/users if we are in dashboard mode
    if (viewMode === "dashboard") {
      fetchStats();
      fetchUsers();
      fetchUserGrowth();
    }
  }, [page, viewMode]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      // If searching, we likely want to be in dashboard mode or just update the list
      if (viewMode === "dashboard") {
        setPage(1);
        fetchUsers();
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // Handle User Details Fetching based on URL param
  useEffect(() => {
    if (selectedUserId) {
      const fetchUserDetails = async () => {
        setLoading(true);
        try {
          const data = await api.getAdminUserDetails(selectedUserId);
          setSelectedUser(data.user);
          setSelectedUserInterviews(data.interviews);
        } catch (error) {
          console.error("Failed to fetch user details", error);
        } finally {
          setLoading(false);
        }
      };

      fetchUserDetails();
    } else {
      setSelectedUser(null);
      setSelectedUserInterviews([]);
    }
  }, [selectedUserId]);

  // Auto-center pagination window when page changes
  useEffect(() => {
    if (totalPages > 0) {
      let newStart = page - 2;
      const maxStart = Math.max(1, totalPages - 4);
      newStart = Math.max(1, Math.min(newStart, maxStart));

      setVisiblePageStart(newStart);
    }
  }, [page, totalPages]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    resetSession();
    navigate("/mockmate/login");
  };

  const handleViewReport = (feedback) => {
    if (feedback) {
      setFeedbackData(feedback);
      navigate("/mockmate/candidate/report");
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.getAdminStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch admin stats", error);
    }
  };

  const fetchUserGrowth = async () => {
    try {
      const data = await api.getUserGrowth();
      setUserGrowth(data);
    } catch (error) {
      console.error("Failed to fetch user growth", error);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getAllUsers(page, 10, searchTerm);
      setUsers(data.users);
      setTotalPages(data.pages);
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserView = (userId) => {
    setSearchParams({ userId });
  };

  const renderStats = () => {
    if (!stats) return null;

    const pieData = Object.entries(stats.interviewsByStatus || {}).map(
      ([name, value]) => ({
        name: name.replace("_", " "),
        value,
      }),
    );

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatsCard
            icon={Users}
            label="Total Users"
            value={stats.totalUsers}
            bgColor="bg-blue-100"
            textColor="text-blue-600"
            tooltip="Total number of registered candidates on the platform, excluding test accounts."
          />

          <StatsCard
            icon={FileText}
            label="Total Interviews"
            value={stats.totalInterviews}
            bgColor="bg-purple-100"
            textColor="text-purple-600"
            tooltip="Total number of mock interviews taken by all users"
          />

          <StatsCard
            icon={Activity}
            label="Active Users"
            value={stats.activeUsersCount}
            bgColor="bg-emerald-100"
            textColor="text-emerald-600"
            tooltip="Number of unique users who have participated in at least one interview"
          />

          <StatsCard
            icon={BarChart3}
            label="Completion Rate"
            value={`${
              stats.totalInterviews
                ? Math.round(
                    ((stats.interviewsByStatus?.COMPLETED || 0) /
                      stats.totalInterviews) *
                      100,
                  )
                : 0
            }%`}
            bgColor="bg-orange-100"
            textColor="text-orange-600"
            tooltip="Percentage of started interviews that were successfully completed"
          />

          <StatsCard
            icon={Zap}
            label="Total Tokens"
            value={stats.tokenStats?.totalTokens?.toLocaleString() || "0"}
            bgColor="bg-yellow-100"
            textColor="text-yellow-600"
            tooltip={
              <div>
                <p>
                  Input tokens:{" "}
                  {stats.tokenStats?.totalInputTokens?.toLocaleString() || 0}
                </p>
                <p>
                  Output tokens:{" "}
                  {stats.tokenStats?.totalOutputTokens?.toLocaleString() || 0}
                </p>
              </div>
            }
          />

          <StatsCard
            icon={Coins}
            label="Est. Cost"
            value={`$${(stats.tokenStats?.totalCost || 0).toFixed(4)}`}
            bgColor="bg-green-100"
            textColor="text-green-600"
            tooltip="Total estimated cost based on token usage"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-slate-800">
              Interview Status Distribution
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold mb-1 text-slate-800">
              New User Registrations
            </h3>
            <p className="text-xs text-slate-400 mb-4">Last 7 days</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={userGrowth}
                  margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient
                      id="growthGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop
                        offset="95%"
                        stopColor="#8b5cf6"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15, 23, 42, 0.9)",
                      border: "none",
                      borderRadius: "10px",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                      padding: "10px 14px",
                    }}
                    itemStyle={{ color: "#e2e8f0", fontSize: 13 }}
                    labelStyle={{
                      color: "#94a3b8",
                      fontSize: 11,
                      marginBottom: 4,
                    }}
                    formatter={(value) => [
                      `${value} new user${value !== 1 ? "s" : ""}`,
                      "Registrations",
                    ]}
                    cursor={{
                      stroke: "#8b5cf6",
                      strokeWidth: 1,
                      strokeDasharray: "4 4",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    fill="url(#growthGradient)"
                    dot={{
                      r: 4,
                      fill: "#8b5cf6",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 6,
                      fill: "#7c3aed",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderUserList = () => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h3 className="text-lg font-bold text-slate-800">Registered Users</h3>
        <div className="relative w-full sm:w-64">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-sm font-semibold border-b border-slate-200">
              <th className="p-4">User</th>
              <th className="p-4">Email</th>
              <th className="p-4">Interviews</th>
              <th className="p-4">Joined</th>
              <th className="p-4">Resume</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan="6" className="p-8 text-center">
                  <Loader2 className="animate-spin text-blue-500 mx-auto" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-8 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user._id}
                  className="hover:bg-slate-50 transition-colors group"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-700">
                        {user.name}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 text-sm">{user.email}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                      {user.interviewCount}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500 text-sm">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    {user.resumeUrl ? (
                      <a
                        href={user.resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline text-sm flex items-center gap-1"
                      >
                        <FileText size={14} /> View
                      </a>
                    ) : (
                      <span className="text-slate-400 text-sm italic">
                        None
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleUserView(user._id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-xs font-medium ml-auto"
                    >
                      <Eye size={14} /> View History
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-slate-200 flex items-center justify-between">
        <button
          disabled={page === 1}
          onClick={() => {
            const newPage = page - 1;
            setPage(newPage);
            if (newPage < visiblePageStart) {
              setVisiblePageStart(Math.max(1, newPage - 4));
            }
          }}
          className="p-2 flex items-center gap-1 text-slate-500 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} /> Prev
        </button>

        <div className="flex items-center gap-2">
          {/* Scroll Left 5 */}
          <button
            disabled={visiblePageStart === 1}
            onClick={() =>
              setVisiblePageStart(Math.max(1, visiblePageStart - 5))
            }
            className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous 5 pages"
          >
            <ChevronsLeft size={16} />
          </button>

          {Array.from({ length: 5 }, (_, i) => {
            const p = visiblePageStart + i;

            if (p > 0 && p <= totalPages) {
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    page === p
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {p}
                </button>
              );
            }
            return null;
          })}

          {/* Scroll Right 5 */}
          <button
            disabled={visiblePageStart + 5 > totalPages}
            onClick={() =>
              setVisiblePageStart(Math.min(totalPages, visiblePageStart + 5))
            }
            className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next 5 pages"
          >
            <ChevronsRight size={16} />
          </button>
        </div>

        <button
          disabled={page === totalPages}
          onClick={() => {
            const newPage = page + 1;
            setPage(newPage);
            if (newPage >= visiblePageStart + 5) {
              setVisiblePageStart(visiblePageStart + 5);
            }
          }}
          className="p-2 flex items-center gap-1 text-slate-500 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  const renderUserDetails = () => {
    if (!selectedUser) return null;

    return (
      <div className="space-y-6">
        <button
          onClick={() => setSearchParams({})}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-4 transition-colors"
        >
          <ChevronLeft size={18} /> Back to Dashboard
        </button>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center text-2xl font-bold border-4 border-slate-50 shadow-sm">
                {selectedUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {selectedUser.name}
                </h2>
                <p className="text-slate-500">{selectedUser.email}</p>
              </div>
            </div>
            {selectedUser.resumeUrl && (
              <a
                href={selectedUser.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors font-medium"
              >
                <FileText size={18} /> Resume
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <p className="text-slate-500 mb-1">Experience</p>
              <p className="font-medium text-slate-800">
                {selectedUser.yearsOfExperience || 0} Years
              </p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Level</p>
              <p className="font-medium text-slate-800 capitalize">
                {selectedUser.experienceLevel || "-"}
              </p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Current Role</p>
              <p className="font-medium text-slate-800">
                {selectedUser.currentRole || "-"}
              </p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Target Role</p>
              <p className="font-medium text-slate-800">
                {selectedUser.targetRole || "-"}
              </p>
            </div>
          </div>
        </div>

        <h3 className="text-xl font-bold text-slate-900 mt-8">
          Interview History
        </h3>

        <div className="grid gap-4">
          {selectedUserInterviews.length === 0 ? (
            <p className="text-slate-500">No interviews found for this user.</p>
          ) : (
            selectedUserInterviews.map((interview) => (
              <div
                key={interview._id}
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between items-center gap-4"
              >
                <div>
                  <h4 className="font-bold text-lg text-slate-900">
                    {interview.role}
                  </h4>
                  <p className="text-sm text-slate-500">
                    {interview.focusArea} • {interview.level} •{" "}
                    {new Date(interview.date).toLocaleDateString()}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm text-slate-500 w-full">
                    <div>
                      <span className="block text-xs uppercase text-slate-400 font-semibold">
                        Language
                      </span>
                      {interview.language || "English"}
                    </div>
                    <div>
                      <span className="block text-xs uppercase text-slate-400 font-semibold">
                        Duration
                      </span>
                      {interview.durationSeconds
                        ? `${Math.round(interview.durationSeconds / 60)} mins`
                        : "-"}
                    </div>
                    <div>
                      <span className="block text-xs uppercase text-slate-400 font-semibold">
                        Questions
                      </span>
                      {interview.history
                        ? Math.floor(interview.history.length / 2)
                        : "-"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wide
                      ${interview.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}
                  >
                    {interview.status.replace("_", " ")}
                  </span>

                  {interview.status === "COMPLETED" && interview.feedback && (
                    <button
                      onClick={() => handleViewReport(interview.feedback)}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium"
                    >
                      <FileText size={16} /> View Report
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 relative">
      <SideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
      {/* Admin Header */}
      <DashboardHeader onMenuClick={() => setIsDrawerOpen(true)} />

      {/* Admin Portal Sub-Header */}
      <div className="bg-white/50 backdrop-blur-sm border-b border-slate-200 py-4 mb-6 shadow-sm">
        <h1 className="text-3xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight">
          Admin Portal
        </h1>
        <p className="text-center text-slate-500 text-sm mt-1">
          Manage users, interviews, and system insights
        </p>
      </div>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {viewMode === "dashboard" ? (
          <>
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-slate-900">
                Dashboard Overview
              </h1>
              <span className="text-sm text-slate-500">
                Last updated: {new Date().toLocaleTimeString()}
              </span>
            </div>
            {renderStats()}
            {renderUserList()}
          </>
        ) : (
          renderUserDetails()
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
