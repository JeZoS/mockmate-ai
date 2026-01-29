import React from "react";
import { Briefcase, UserCircle, Code2, FileText, Globe } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { AppState } from "../types";
import { useNavigate } from "react-router-dom";

const LANGUAGES = ["English", "Spanish", "French", "German", "Hindi", "Mandarin", "Japanese", "Portuguese"];

export const Landing = ({ onSelectMode, totalQuestions, onTotalQuestionsChange }) => {
    const { language, setLanguage, user, setAppState } = useAppStore();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-900 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-200 rounded-full blur-[128px] opacity-40"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-200 rounded-full blur-[128px] opacity-40"></div>
            </div>

            <div className="z-10 max-w-5xl w-full space-y-12 text-center">
                <div className="space-y-4">
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="p-3 bg-white shadow-md rounded-xl ring-1 ring-slate-100">
                            <Code2
                                size={40}
                                className="text-blue-600"
                            />
                        </div>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900">
                        Zi MockMate
                    </h1>
                    <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                        Master your next technical interview with a personalized AI interviewer. Practice
                        realistic scenarios tailored to your target role.
                    </p>

                    {/* Settings Row: Language & Question Count */}
                    <div className="flex flex-wrap items-center justify-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                            <Globe
                                size={18}
                                className="text-slate-400"
                            />
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                            >
                                {LANGUAGES.map((lang) => (
                                    <option
                                        key={lang}
                                        value={lang}
                                    >
                                        {lang}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {onTotalQuestionsChange && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-600">Questions:</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={totalQuestions || 7}
                                    onChange={(e) => onTotalQuestionsChange(parseInt(e.target.value) || 10)}
                                    className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-center"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6 w-full mx-auto">
                    {/* Option 1: Job Description */}
                    <button
                        onClick={() => onSelectMode("jd")}
                        className="group relative flex flex-col items-center p-8 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-400 rounded-2xl transition-all shadow-sm hover:shadow-xl hover:shadow-blue-500/10 text-left"
                    >
                        <div className="p-4 bg-blue-50 rounded-full mb-6 group-hover:bg-blue-100 group-hover:text-blue-600 text-blue-500 transition-colors">
                            <Briefcase size={32} />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-slate-900">Interview Based On Job Description</h3>
                        <p className="text-sm text-slate-500 text-center">
                            Paste a JD and let the AI extract requirements to grill you on specifics.
                        </p>
                    </button>

                    {/* Option 2: Resume Upload */}
                    <button
                        onClick={() => onSelectMode("resume")}
                        className="group relative flex flex-col items-center p-8 bg-white hover:bg-slate-50 border border-slate-200 hover:border-purple-400 rounded-2xl transition-all shadow-sm hover:shadow-xl hover:shadow-purple-500/10 text-left"
                    >
                        <div className="p-4 bg-purple-50 rounded-full mb-6 group-hover:bg-purple-100 group-hover:text-purple-600 text-purple-500 transition-colors">
                            <FileText size={32} />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-slate-900">Based On Resume</h3>
                        <p className="text-sm text-slate-500 text-center">
                            Upload your resume. The AI will suggest roles and skills to practice based on your
                            profile.
                        </p>
                    </button>

                    {/* Option 3: General Role */}
                    <button
                        onClick={() => onSelectMode("role")}
                        className="group relative flex flex-col items-center p-8 bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-400 rounded-2xl transition-all shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 text-left"
                    >
                        <div className="p-4 bg-emerald-50 rounded-full mb-6 group-hover:bg-emerald-100 group-hover:text-emerald-600 text-emerald-500 transition-colors">
                            <UserCircle size={32} />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-slate-900">Practice for a Role</h3>
                        <p className="text-sm text-slate-500 text-center">
                            Mention a role (e.g. "Full Stack") and the AI will customize the session for you.
                        </p>
                    </button>
                </div>
            </div>

            {/* <footer className="absolute bottom-6 text-slate-400 text-sm">Powered by Gemini</footer> */}
        </div>
    );
};
