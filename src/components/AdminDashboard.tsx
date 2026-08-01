import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle,
  ClipboardList,
  Loader2,
  LogOut,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  Search,
  Pencil,
  Users,
  FileSpreadsheet,
} from 'lucide-react';
import {
  getAllSurveyResponses,
  getDashboardStats,
  getSystemLogs,
  logout,
  verifyDoctor,
} from '../lib/api';
import { formatApiError, getRiskZoneStyle } from '../lib/surveyUtils';
import type { DashboardStats, SurveyResponseOut } from '../types/api';
import type { UserProfile } from '../types';
import SurveyReport from './SurveyReport';
import SurveyAnalyticsPanel from './SurveyAnalyticsPanel';
import QuestionEditor from './QuestionEditor';
import ExcelAnalysisPanel from './ExcelAnalysisPanel';
import ApiStatusBanner from './ApiStatusBanner';
import { t } from '../lib/lang';
import { useApiHealth } from '../lib/useApiHealth';

interface AdminDashboardProps {
  adminUser: UserProfile;
  onLogout: () => void;
  language?: 'lotin' | 'kirill';
  onLanguageChange?: (lang: 'lotin' | 'kirill') => void;
}

export default function AdminDashboard({
  adminUser,
  onLogout,
  language = 'lotin',
  onLanguageChange,
}: AdminDashboardProps) {
  const { status: apiStatus, message: apiStatusMessage, retry: retryApiHealth } = useApiHealth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [surveys, setSurveys] = useState<SurveyResponseOut[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'dashboard' | 'analytics' | 'excel' | 'surveys' | 'questions' | 'doctors' | 'logs'>('dashboard');
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyResponseOut | null>(null);
  const [doctorIdInput, setDoctorIdInput] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [statsData, surveysData, logsData] = await Promise.all([
        getDashboardStats(),
        getAllSurveyResponses(),
        getSystemLogs(),
      ]);
      setStats(statsData);
      setSurveys(surveysData);
      setLogs(logsData);
    } catch (err) {
      setErrorMsg(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const handleVerifyDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorIdInput.trim()) return;
    setVerifyLoading(true);
    setVerifyMsg(null);
    try {
      const result = await verifyDoctor(doctorIdInput.trim());
      setVerifyMsg(result.message || 'Shifokor tasdiqlandi');
      setDoctorIdInput('');
      loadAll();
    } catch (err) {
      setVerifyMsg(formatApiError(err));
    } finally {
      setVerifyLoading(false);
    }
  };

  const tabs = [
    { id: 'dashboard' as const, label: 'Statistika', icon: Activity },
    { id: 'excel' as const, label: 'Excel tahlil', icon: FileSpreadsheet },
    { id: 'analytics' as const, label: "Qidiruv va Excel", icon: Search },
    { id: 'surveys' as const, label: "So'rovnomalar", icon: ClipboardList },
    { id: 'questions' as const, label: 'Anketa tahriri', icon: Pencil },
    { id: 'doctors' as const, label: 'Shifokorlar', icon: Users },
    { id: 'logs' as const, label: 'Loglar', icon: ScrollText },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <ApiStatusBanner status={apiStatus} message={apiStatusMessage} onRetry={retryApiHealth} />
      <header className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-amber-300 font-bold uppercase">Admin panel</p>
          <h1 className="text-lg font-black">{adminUser.ism}</h1>
        </div>
        <div className="flex items-center gap-2">
          {onLanguageChange && (
            <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
              {(['lotin', 'kirill'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onLanguageChange(lang)}
                  className={`px-2 py-1 text-[10px] rounded font-bold ${language === lang ? 'bg-emerald-600' : ''}`}
                >
                  {lang === 'lotin' ? 'Lotin' : 'Кирилл'}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={loadAll} className="p-2 rounded-lg bg-slate-800">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600/80 text-sm font-bold"
          >
            <LogOut className="w-4 h-4" />
            Chiqish
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setSelectedSurvey(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
                tab === id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(label, language)}
            </button>
          ))}
        </div>

        {errorMsg && tab !== 'excel' && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {errorMsg}
          </div>
        )}

        {tab === 'excel' ? (
          <ExcelAnalysisPanel language={language} />
        ) : loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <>
            {tab === 'dashboard' && stats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  title="Jami xodimlar"
                  value={String(stats.total_employees)}
                  color="text-indigo-600"
                />
                <StatCard
                  title="Yuqori xavf %"
                  value={`${stats.high_risk_percentage.toFixed(1)}%`}
                  color="text-orange-600"
                />
                <StatCard
                  title="Tasdiqlanmagan shifokorlar"
                  value={String(stats.pending_doctors)}
                  color="text-amber-600"
                />
              </div>
            )}

            {tab === 'analytics' && (
              <SurveyAnalyticsPanel
                surveys={surveys}
                onSelectSurvey={(s) => {
                  setSelectedSurvey(s);
                  setTab('surveys');
                }}
              />
            )}

            {tab === 'questions' && <QuestionEditor />}

            {tab === 'surveys' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b font-bold text-slate-800">
                    Barcha so'rovnomalar ({surveys.length})
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto divide-y">
                    {surveys.map((s) => {
                      const style = getRiskZoneStyle(s.risk_zonasi);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSurvey(s)}
                          className={`w-full text-left p-4 hover:bg-slate-50 ${
                            selectedSurvey?.id === s.id ? 'bg-emerald-50' : ''
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-mono text-slate-500">
                              {new Date(s.created_at).toLocaleString('uz-UZ')}
                            </span>
                            <span
                              className="text-[9px] font-bold px-2 py-0.5 rounded text-white"
                              style={{ backgroundColor: style.color }}
                            >
                              {s.risk_zonasi || '—'}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-slate-800 mt-1">
                            Ball: {s.score_total} · {s.answered_count} javob
                          </p>
                        </button>
                      );
                    })}
                    {surveys.length === 0 && (
                      <p className="p-6 text-center text-slate-500 text-sm">So'rovnomalar yo'q</p>
                    )}
                  </div>
                </div>
                <div>
                  {selectedSurvey ? (
                    <SurveyReport survey={selectedSurvey} tahlil={selectedSurvey.ai_response} language={language} />
                  ) : (
                    <div className="bg-white rounded-2xl border p-12 text-center text-slate-500">
                      So'rovnomani tanlang
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'doctors' && (
              <div className="max-w-lg bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-8 h-8 text-amber-500" />
                  <div>
                    <h3 className="font-bold text-slate-800">Shifokorni tasdiqlash</h3>
                    <p className="text-xs text-slate-500">
                      Kutilayotgan: {stats?.pending_doctors ?? 0} ta shifokor
                    </p>
                  </div>
                </div>
                <form onSubmit={handleVerifyDoctor} className="space-y-3">
                  <input
                    type="text"
                    value={doctorIdInput}
                    onChange={(e) => setDoctorIdInput(e.target.value)}
                    placeholder="Shifokor UUID (doctor_id)"
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm font-mono"
                  />
                  <button
                    type="submit"
                    disabled={verifyLoading}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2"
                  >
                    {verifyLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Tasdiqlash
                  </button>
                </form>
                {verifyMsg && (
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl">{verifyMsg}</p>
                )}
                <p className="text-[10px] text-slate-400">
                  SQLAdmin panel: {import.meta.env.VITE_API_URL || 'https://api.energohealth-predict.uz'}/admin
                </p>
              </div>
            )}

            {tab === 'logs' && (
              <div className="bg-slate-900 rounded-2xl p-4 max-h-[70vh] overflow-y-auto font-mono text-xs text-emerald-400 space-y-1">
                {logs.map((line, i) => (
                  <div key={i} className="border-b border-slate-800 pb-1">
                    {line}
                  </div>
                ))}
                {logs.length === 0 && <p className="text-slate-500">Loglar yo'q</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">{title}</p>
      <p className={`text-3xl font-black mt-2 ${color}`}>{value}</p>
    </div>
  );
}
