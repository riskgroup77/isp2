import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  ClipboardList,
  FileSpreadsheet,
  FolderArchive,
  FlaskConical,
  Loader2,
  LogOut,
  Menu,
  Pencil,
  Play,
  RefreshCw,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  getAdminUsers,
  getAllSurveyResponses,
  getDashboardStats,
  getSurveyQuestions,
  getSystemLogs,
  logout,
  verifyDoctor,
  API_BASE_URL,
} from '../lib/api';
import { formatApiError, getRiskZoneStyle, RISK_ZONE_CONFIG } from '../lib/surveyUtils';
import type { DashboardStats, PersonInfo, Questionnaire, SurveyResponseOut } from '../types/api';
import type { UserProfile } from '../types';
import SurveyReport from './SurveyReport';
import SurveyAnalyticsPanel from './SurveyAnalyticsPanel';
import QuestionEditor from './QuestionEditor';
import ExcelAnalysisPanel from './ExcelAnalysisPanel';
import AdminBulkSurveyPanel from './AdminBulkSurveyPanel';
import AdminReportsPanel from './AdminReportsPanel';
import AdminReportBuilder from './AdminReportBuilder';
const MorbidityHygienePanel = lazy(() => import('./MorbidityHygienePanel'));
import ApiStatusBanner from './ApiStatusBanner';
import { t } from '../lib/lang';
import { APP_BRAND } from '../lib/branding';
import { useApiHealth } from '../lib/useApiHealth';

interface AdminDashboardProps {
  adminUser: UserProfile;
  onLogout: () => void;
  language?: 'lotin' | 'kirill';
  onLanguageChange?: (lang: 'lotin' | 'kirill') => void;
}

type TabId =
  | 'dashboard'
  | 'builder'
  | 'analytics'
  | 'surveys'
  | 'reports'
  | 'excel'
  | 'medimport'
  | 'questions'
  | 'bulk'
  | 'doctors'
  | 'logs';

interface NavItem {
  id: TabId;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Umumiy',
    items: [{ id: 'dashboard', label: 'Boshqaruv paneli', hint: 'Asosiy ko\'rsatkichlar', icon: Activity }],
  },
  {
    title: "Ma'lumotlar va hisobotlar",
    items: [
      { id: 'builder', label: 'Hisobot konstruktori', hint: 'Formulalar, filtr, Excel', icon: Wand2 },
      { id: 'analytics', label: 'Qidiruv va tahlil', hint: 'Tez filtrlar', icon: Search },
      { id: 'surveys', label: "So'rovnomalar", hint: 'Har bir anketa', icon: ClipboardList },
      { id: 'reports', label: 'Hisobotlar N=400', hint: 'Jonli dissertatsiya jadvallari', icon: FolderArchive },
      { id: 'medimport', label: 'Kasallanish va gigiyena', hint: "5 yillik kartalar, o'lchovlar (import)", icon: FlaskConical },
      { id: 'excel', label: 'Excel AI tahlil', hint: 'Fayl yuklash', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'Boshqaruv',
    items: [
      { id: 'questions', label: 'Anketa tahriri', hint: 'Savol matnlari', icon: Pencil },
      { id: 'bulk', label: 'Ommaviy anketa', hint: 'CSV orqali', icon: Play },
      { id: 'doctors', label: 'Shifokorlar', hint: 'Tasdiqlash', icon: Stethoscope },
      { id: 'logs', label: 'Tizim loglari', hint: 'Server', icon: ScrollText },
    ],
  },
];

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
  const [people, setPeople] = useState<Map<string, PersonInfo>>(new Map());
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('dashboard');
  const [navOpen, setNavOpen] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyResponseOut | null>(null);
  const [surveySearch, setSurveySearch] = useState('');
  const [doctorIdInput, setDoctorIdInput] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setErrorMsg(null);
    const [statsR, surveysR, logsR, usersR] = await Promise.allSettled([
      getDashboardStats(),
      getAllSurveyResponses(),
      getSystemLogs(),
      getAdminUsers(),
    ]);
    if (usersR.status === 'fulfilled') {
      setPeople(new Map(usersR.value.map((u) => [u.id, { id: u.id, ism: u.ism, login: u.login }])));
      setPeopleError(null);
    } else {
      setPeopleError(formatApiError(usersR.reason));
    }
    const problems: string[] = [];
    if (statsR.status === 'fulfilled') setStats(statsR.value);
    else problems.push(`Statistika: ${formatApiError(statsR.reason)}`);
    if (surveysR.status === 'fulfilled') {
      setSurveys(
        [...surveysR.value].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      );
    } else problems.push(`So'rovnomalar: ${formatApiError(surveysR.reason)}`);
    if (logsR.status === 'fulfilled') setLogs(logsR.value);
    else problems.push(`Loglar: ${formatApiError(logsR.reason)}`);
    if (problems.length) setErrorMsg(problems.join(' · '));
    setLastLoaded(new Date());
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    getSurveyQuestions().then(setQuestionnaire).catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      onLogout();
    }
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

  // ── Boshqaruv paneli uchun hisoblangan ko'rsatkichlar ──
  const overview = useMemo(() => {
    const zones: Record<string, number> = { yashil: 0, sariq: 0, sargish: 0, qizil: 0 };
    let riskSum = 0;
    let riskN = 0;
    let aiErrors = 0;
    const byDay = new Map<string, number>();
    const now = Date.now();
    surveys.forEach((s) => {
      const z = (s.risk_zonasi || (s.ai_response?.zona as string) || '').toLowerCase();
      if (z in zones) zones[z] += 1;
      const r = s.ai_response?.riskFoizi ?? s.score_total;
      if (typeof r === 'number' && Number.isFinite(r)) {
        riskSum += r;
        riskN += 1;
      }
      if (s.ai_xato) aiErrors += 1;
      const d = new Date(s.created_at);
      if (!Number.isNaN(d.getTime()) && now - d.getTime() < 14 * 86400000) {
        const key = d.toISOString().slice(0, 10);
        byDay.set(key, (byDay.get(key) || 0) + 1);
      }
    });
    const days: { day: string; soni: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      days.push({ day: key.slice(5).replace('-', '/'), soni: byDay.get(key) || 0 });
    }
    const last7 = days.slice(-7).reduce((a, b) => a + b.soni, 0);
    return {
      zones,
      avgRisk: riskN ? riskSum / riskN : null,
      aiErrors,
      days,
      last7,
      uniqueUsers: new Set(surveys.map((s) => s.user_id)).size,
    };
  }, [surveys]);

  const filteredSurveys = useMemo(() => {
    const q = surveySearch.trim().toLowerCase();
    if (!q) return surveys;
    return surveys.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.user_id.toLowerCase().includes(q) ||
        (people.get(s.user_id)?.ism || '').toLowerCase().includes(q) ||
        (people.get(s.user_id)?.login || '').toLowerCase().includes(q) ||
        (s.risk_zonasi || '').toLowerCase().includes(q) ||
        String(s.score_total).includes(q) ||
        new Date(s.created_at).toLocaleDateString('uz-UZ').includes(q)
    );
  }, [surveys, surveySearch, people]);

  const activeNav = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === tab);

  const selectTab = (id: TabId) => {
    setTab(id);
    setSelectedSurvey(null);
    setNavOpen(false);
  };

  const navContent = (
    <nav className="space-y-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
            {t(group.title, language)}
          </p>
          <div className="space-y-0.5">
            {group.items.map(({ id, label, hint, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectTab(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                    active
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight truncate">{t(label, language)}</span>
                    <span className={`block text-[10px] leading-tight truncate ${active ? 'text-emerald-100' : 'text-slate-400'}`}>
                      {t(hint, language)}
                    </span>
                  </span>
                  {id === 'surveys' && surveys.length > 0 && (
                    <span
                      className={`ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                        active ? 'bg-white/20' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {surveys.length}
                    </span>
                  )}
                  {id === 'doctors' && (stats?.pending_doctors ?? 0) > 0 && (
                    <span className="ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950">
                      {stats?.pending_doctors}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <ApiStatusBanner status={apiStatus} message={apiStatusMessage} onRetry={retryApiHealth} />

      {/* Yuqori panel */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800">
        <div className="px-4 md:px-6 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setNavOpen((s) => !s)}
            className="lg:hidden p-2 rounded-lg bg-slate-800 hover:bg-slate-700"
            aria-label="Menyu"
          >
            {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider leading-snug truncate">
              {t(APP_BRAND, language)}
            </p>
            <h1 className="text-sm md:text-base font-black leading-tight truncate">
              {t('Administrator paneli', language)}
              <span className="hidden sm:inline text-slate-400 font-semibold"> · {adminUser.ism}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {onLanguageChange && (
              <div className="flex gap-0.5 bg-slate-800 rounded-lg p-0.5">
                {(['lotin', 'kirill'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => onLanguageChange(lang)}
                    className={`px-2.5 py-1.5 text-[11px] rounded-md font-bold transition ${
                      language === lang ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {lang === 'lotin' ? 'Lotin' : 'Кирилл'}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={loadAll}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
              title="Yangilash"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t('Chiqish', language)}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Yon menyu (desktop) */}
        <aside className="hidden lg:block w-72 shrink-0 sticky top-[61px] h-[calc(100vh-61px)] overflow-y-auto bg-white border-r border-slate-200 p-4">
          {navContent}
          <div className="mt-6 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1">
            <p className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500' : apiStatus === 'checking' ? 'bg-amber-400' : 'bg-red-500'}`} />
              API: {apiStatus === 'online' ? 'ishlayapti' : apiStatus === 'checking' ? 'tekshirilmoqda' : 'aloqa yo\'q'}
            </p>
            {lastLoaded && <p>Yangilandi: {lastLoaded.toLocaleTimeString('uz-UZ')}</p>}
            <a
              href={`${API_BASE_URL}/admin`}
              target="_blank"
              rel="noreferrer"
              className="block text-emerald-700 font-semibold hover:underline"
            >
              SQLAdmin panel →
            </a>
          </div>
        </aside>

        {/* Yon menyu (mobil) */}
        {navOpen && (
          <div className="lg:hidden fixed inset-0 z-20 flex">
            <div className="w-72 max-w-[85vw] bg-white p-4 pt-20 overflow-y-auto shadow-2xl">{navContent}</div>
            <button type="button" className="flex-1 bg-slate-900/50" onClick={() => setNavOpen(false)} aria-label="Yopish" />
          </div>
        )}

        {/* Asosiy kontent */}
        <main className="flex-1 min-w-0 p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                {activeNav && <activeNav.icon className="w-6 h-6 text-emerald-600" />}
                {t(activeNav?.label ?? '', language)}
              </h2>
              <p className="text-xs text-slate-500">{t(activeNav?.hint ?? '', language)}</p>
            </div>
          </div>

          {errorMsg && tab !== 'excel' && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {tab === 'excel' && <ExcelAnalysisPanel language={language} />}
          {tab === 'reports' && (
            <AdminReportsPanel
              language={language}
              surveys={surveys}
              questionnaire={questionnaire}
              loading={loading}
              onReload={loadAll}
            />
          )}
          {tab === 'bulk' && <AdminBulkSurveyPanel questionnaire={questionnaire} onComplete={loadAll} />}
          {tab === 'questions' && <QuestionEditor />}
          {tab === 'medimport' && (
            <Suspense
              fallback={
                <div className="flex justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>
              }
            >
              <MorbidityHygienePanel />
            </Suspense>
          )}

          {loading && !['excel', 'reports', 'bulk', 'questions', 'medimport'].includes(tab) ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-sm">{t("Ma'lumotlar yuklanmoqda...", language)}</p>
            </div>
          ) : (
            <>
              {tab === 'dashboard' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                    <StatCard
                      title="Jami xodimlar"
                      value={stats ? String(stats.total_employees) : '—'}
                      sub={`${overview.uniqueUsers} nafari anketa to'ldirgan`}
                      icon={Users}
                      tone="indigo"
                    />
                    <StatCard
                      title="So'rovnomalar"
                      value={String(surveys.length)}
                      sub={`So'nggi 7 kunda: ${overview.last7}`}
                      icon={ClipboardList}
                      tone="emerald"
                    />
                    <StatCard
                      title="O'rtacha xavf"
                      value={overview.avgRisk === null ? '—' : `${overview.avgRisk.toFixed(1)}%`}
                      sub={stats ? `Yuqori xavf: ${stats.high_risk_percentage.toFixed(1)}%` : ''}
                      icon={TrendingUp}
                      tone="orange"
                    />
                    <StatCard
                      title="Kutilayotgan shifokorlar"
                      value={stats ? String(stats.pending_doctors) : '—'}
                      sub={overview.aiErrors ? `AI xatosi: ${overview.aiErrors} ta anketa` : 'AI xatolari yo\'q'}
                      icon={ShieldAlert}
                      tone="amber"
                      onClick={() => selectTab('doctors')}
                    />
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    {/* Zona taqsimoti */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-600" />
                        {t('Xavf zonalari taqsimoti', language)}
                      </h3>
                      <div className="mt-4 space-y-3">
                        {(['yashil', 'sariq', 'sargish', 'qizil'] as const).map((z) => {
                          const n = overview.zones[z];
                          const pct = surveys.length ? (n / surveys.length) * 100 : 0;
                          const cfg = RISK_ZONE_CONFIG[z];
                          return (
                            <div key={z}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-semibold text-slate-700">{t(cfg.label, language)}</span>
                                <span className="font-mono text-slate-500">
                                  {n} · {pct.toFixed(1)}%
                                </span>
                              </div>
                              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                              </div>
                            </div>
                          );
                        })}
                        {surveys.length === 0 && <p className="text-xs text-slate-500">So'rovnomalar hali yo'q.</p>}
                      </div>
                    </div>

                    {/* Kunlik dinamika */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 xl:col-span-2">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-600" />
                        {t("So'nggi 14 kunda to'ldirilgan anketalar", language)}
                      </h3>
                      <div className="h-56 mt-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={overview.days} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="day" fontSize={10} tickLine={false} axisLine={false} stroke="#94a3b8" />
                            <YAxis fontSize={10} tickLine={false} axisLine={false} stroke="#94a3b8" allowDecimals={false} />
                            <Tooltip
                              cursor={{ fill: '#f1f5f9' }}
                              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                              formatter={(v) => [`${v} ta`, 'Anketa']}
                            />
                            <Bar dataKey="soni" fill="#059669" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    {/* So'nggi anketalar */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden xl:col-span-2">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800">{t("So'nggi so'rovnomalar", language)}</h3>
                        <button type="button" onClick={() => selectTab('surveys')} className="text-xs font-bold text-emerald-700 hover:underline">
                          Barchasi →
                        </button>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {surveys.slice(0, 6).map((s) => {
                          const style = getRiskZoneStyle(s.risk_zonasi);
                          const risk = s.ai_response?.riskFoizi ?? s.score_total;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setTab('surveys');
                                setSelectedSurvey(s);
                              }}
                              className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 text-left"
                            >
                              <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0" style={{ backgroundColor: style.color }}>
                                {risk}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-slate-800 truncate">
                                  {people.get(s.user_id)?.ism || s.ai_response?.klinikXulosa || s.klinik_xulosa || `Ball: ${s.score_total}`}
                                </span>
                                <span className="block text-[11px] text-slate-500 font-mono">
                                  {new Date(s.created_at).toLocaleString('uz-UZ')} · {s.answered_count} javob
                                </span>
                              </span>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white shrink-0" style={{ backgroundColor: style.color }}>
                                {s.risk_zonasi || '—'}
                              </span>
                            </button>
                          );
                        })}
                        {surveys.length === 0 && <p className="p-6 text-sm text-slate-500 text-center">So'rovnomalar yo'q</p>}
                      </div>
                    </div>

                    {/* Tez harakatlar */}
                    <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-sm p-5 space-y-3">
                      <h3 className="font-bold flex items-center gap-2">
                        <Wand2 className="w-4 h-4" />
                        {t('Tez harakatlar', language)}
                      </h3>
                      <QuickAction label="Hisobot konstruktori" hint="Istalgan kesimda Excel hisobot" onClick={() => selectTab('builder')} />
                      <QuickAction label="Qidiruv va tahlil" hint="Tayyor filtrlar bilan" onClick={() => selectTab('analytics')} />
                      <QuickAction label="Excel AI tahlil" hint="Fayl yuklab xulosa olish" onClick={() => selectTab('excel')} />
                      <QuickAction label="Hisobotlar N=400" hint="Jonli dissertatsiya jadvallari" onClick={() => selectTab('reports')} />
                    </div>
                  </div>
                </div>
              )}

              {tab === 'builder' && (
                <AdminReportBuilder
                  surveys={surveys}
                  questionnaire={questionnaire}
                  people={people}
                  peopleError={peopleError}
                  language={language}
                />
              )}

              {tab === 'analytics' && (
                <SurveyAnalyticsPanel
                  surveys={surveys}
                  language={language}
                  onSelectSurvey={(s) => {
                    setSelectedSurvey(s);
                    setTab('surveys');
                  }}
                />
              )}

              {tab === 'surveys' && (
                <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-4 items-start">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden lg:sticky lg:top-20">
                    <div className="p-3 border-b border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-sm">
                          {t("Barcha so'rovnomalar", language)} ({filteredSurveys.length})
                        </span>
                      </div>
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={surveySearch}
                          onChange={(e) => setSurveySearch(e.target.value)}
                          placeholder="Ism, login, zona, sana..."
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="max-h-[65vh] overflow-y-auto divide-y divide-slate-100">
                      {filteredSurveys.map((s) => {
                        const style = getRiskZoneStyle(s.risk_zonasi);
                        const active = selectedSurvey?.id === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedSurvey(s)}
                            className={`w-full text-left p-3 flex items-center gap-3 transition ${
                              active ? 'bg-emerald-50 border-l-4 border-emerald-600' : 'hover:bg-slate-50 border-l-4 border-transparent'
                            }`}
                          >
                            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0" style={{ backgroundColor: style.color }}>
                              {s.ai_response?.riskFoizi ?? s.score_total}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-mono text-slate-500">{new Date(s.created_at).toLocaleString('uz-UZ')}</span>
                              <span className="block text-sm font-bold text-slate-800">
                                {people.get(s.user_id)?.ism || `Ball: ${s.score_total} · ${s.answered_count} javob`}
                              </span>
                            </span>
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded text-white" style={{ backgroundColor: style.color }}>
                              {s.risk_zonasi || '—'}
                            </span>
                          </button>
                        );
                      })}
                      {filteredSurveys.length === 0 && <p className="p-6 text-center text-slate-500 text-sm">So'rovnomalar topilmadi</p>}
                    </div>
                  </div>
                  <div className="min-w-0">
                    {selectedSurvey ? (
                      <SurveyReport
                        key={selectedSurvey.id}
                        survey={selectedSurvey}
                        tahlil={selectedSurvey.ai_response}
                        questionnaire={questionnaire}
                        user={
                          people.get(selectedSurvey.user_id)
                            ? {
                                id: selectedSurvey.user_id,
                                login: people.get(selectedSurvey.user_id)!.login,
                                ism: people.get(selectedSurvey.user_id)!.ism,
                                rol: 'xodim',
                                yaratilganSana: '',
                              }
                            : null
                        }
                        language={language}
                        onUpdated={(r) => {
                          setSurveys((prev) => prev.map((s) => (s.id === r.response.id ? r.response : s)));
                          setSelectedSurvey(r.response);
                        }}
                      />
                    ) : (
                      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center text-slate-500">
                        <ClipboardList className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                        {t("Ro'yxatdan so'rovnomani tanlang", language)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'doctors' && (
                <div className="max-w-xl bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                      <ShieldAlert className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{t('Shifokorni tasdiqlash', language)}</h3>
                      <p className="text-xs text-slate-500">Kutilayotgan: {stats?.pending_doctors ?? 0} ta shifokor</p>
                    </div>
                  </div>
                  <form onSubmit={handleVerifyDoctor} className="space-y-3">
                    <input
                      type="text"
                      value={doctorIdInput}
                      onChange={(e) => setDoctorIdInput(e.target.value)}
                      placeholder="Shifokor UUID (doctor_id)"
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={verifyLoading || !doctorIdInput.trim()}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {verifyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      {t('Tasdiqlash', language)}
                    </button>
                  </form>
                  {verifyMsg && <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">{verifyMsg}</p>}
                  <p className="text-[11px] text-slate-400">
                    Shifokor ID'sini SQLAdmin paneldan oling:{' '}
                    <a href={`${API_BASE_URL}/admin`} target="_blank" rel="noreferrer" className="text-emerald-700 font-semibold hover:underline">
                      {API_BASE_URL}/admin
                    </a>
                  </p>
                </div>
              )}

              {tab === 'logs' && (
                <div className="bg-slate-900 rounded-2xl p-4 max-h-[70vh] overflow-y-auto font-mono text-xs text-emerald-400 space-y-1 shadow-inner">
                  {logs.map((line, i) => (
                    <div key={i} className="border-b border-slate-800 pb-1 whitespace-pre-wrap break-all">
                      {line}
                    </div>
                  ))}
                  {logs.length === 0 && <p className="text-slate-500">Loglar yo'q</p>}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

const TONES = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  orange: 'bg-orange-50 text-orange-600',
  amber: 'bg-amber-50 text-amber-600',
} as const;

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  tone,
  onClick,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONES;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 text-left flex items-start gap-3 ${
        onClick ? 'hover:border-emerald-300 hover:shadow-md transition cursor-pointer' : ''
      }`}
    >
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${TONES[tone]}`}>
        <Icon className="w-5 h-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider truncate">{title}</span>
        <span className="block text-2xl md:text-3xl font-black text-slate-900 leading-tight mt-0.5">{value}</span>
        {sub && <span className="block text-[11px] text-slate-500 mt-0.5 truncate">{sub}</span>}
      </span>
    </Tag>
  );
}

function QuickAction({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 transition"
    >
      <span className="block text-sm font-bold">{label}</span>
      <span className="block text-[11px] text-emerald-100">{hint}</span>
    </button>
  );
}
