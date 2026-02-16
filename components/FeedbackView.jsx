import React from "react";
import {
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Award,
  MessageSquare,
  Download,
} from "lucide-react";
import { Button } from "./ui/Button";

import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";

export const FeedbackView = ({ data, onHome }) => {
  const navigate = useNavigate();
  const { user } = useAppStore();

  const ScoreBar = ({ label, score, colorClass }) => (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm font-semibold text-slate-900">{score}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full ${colorClass} transition-all duration-1000 ease-out`}
          style={{ width: `${score}%` }}
        ></div>
      </div>
    </div>
  );

  const handleDownload = () => {
    const reportContent = `
ZI MOCKMATE - INTERVIEW REPORT
------------------------------

OVERALL SCORE: ${data.overallScore}/100
- Communication: ${data.communicationScore}/100
- Technical/Domain: ${data.technicalScore}/100

STRENGTHS:
${data.strengths.map((s) => `- ${s}`).join("\n")}

AREAS FOR IMPROVEMENT:
${data.weaknesses.map((w) => `- ${w}`).join("\n")}

DETAILED FEEDBACK:
${data.suggestion}
    `;

    const blob = new Blob([reportContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Interview_Report_${new Date().toISOString().split("T")[0]}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex justify-center">
      <div className="max-w-4xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2 pt-8 relative">
          <div className="absolute right-0 top-8">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="gap-2"
            >
              <Download size={16} /> Download
            </Button>
          </div>
          <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-4">
            <Award size={40} className="text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Interview Performance Report
          </h1>
          <p className="text-slate-500">
            Here is a detailed breakdown of your mock interview session.
          </p>
        </div>

        {/* Scores Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Main Score Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
            <h3 className="text-lg font-medium text-slate-600 mb-4">
              Overall Score
            </h3>
            <div className="relative flex items-center justify-center w-32 h-32">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="text-blue-600"
                  strokeDasharray={`${data.overallScore}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
              </svg>
              <span className="absolute text-3xl font-bold text-slate-900">
                {data.overallScore}
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              {data.overallScore >= 80
                ? "Excellent work! You're ready."
                : data.overallScore >= 60
                  ? "Good job, but room for improvement."
                  : "Keep practicing to improve."}
            </p>
          </div>

          {/* Breakdown Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="text-slate-400" size={20} />
              <h3 className="text-lg font-medium text-slate-900">
                Skill Breakdown
              </h3>
            </div>
            <ScoreBar
              label="Communication & Clarity"
              score={data.communicationScore}
              colorClass="bg-emerald-500"
            />
            <ScoreBar
              label="Technical Skills"
              score={data.technicalScore}
              colorClass="bg-indigo-500"
            />
            {data.problemSolvingScore && (
              <ScoreBar
                label="Problem Solving"
                score={data.problemSolvingScore}
                colorClass="bg-purple-500"
              />
            )}
            {data.domainKnowledgeScore && (
              <ScoreBar
                label="Domain Knowledge"
                score={data.domainKnowledgeScore}
                colorClass="bg-amber-500"
              />
            )}
          </div>
        </div>

        {/* Qualitative Feedback */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="text-emerald-500" size={24} />
              <h3 className="text-lg font-bold text-slate-900">
                Key Strengths
              </h3>
            </div>
            <ul className="space-y-3">
              {data.strengths.map((str, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-slate-600 text-sm"
                >
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
                  {str}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="text-amber-500" size={24} />
              <h3 className="text-lg font-bold text-slate-900">
                Areas for Improvement
              </h3>
            </div>
            <ul className="space-y-3">
              {data.weaknesses.map((wk, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-slate-600 text-sm"
                >
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"></span>
                  {wk}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* AI Suggestion */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="text-blue-600" size={20} />
            <h3 className="font-semibold text-blue-900">
              Final Recommendation
            </h3>
          </div>
          <p className="text-blue-800 leading-relaxed text-sm md:text-base">
            {data.suggestion}
          </p>
        </div>

        <div className="flex justify-center pt-4 pb-12 gap-4">
          <Button
            onClick={onHome}
            size="lg"
            className="shadow-xl shadow-blue-500/10"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back to Dashboard
          </Button>

          {user?.isAdmin && (
            <Button
              variant="outline"
              onClick={() => navigate("/mockmate/admin")}
              size="lg"
              className="shadow-xl shadow-purple-500/10 border-slate-300 hover:bg-slate-50 text-slate-700"
            >
              <BarChart3 size={18} className="mr-2" />
              Admin Dashboard
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
