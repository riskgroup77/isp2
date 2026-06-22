import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import {
  doctorAdviceDraft,
  getAllSurveyResponses,
  getDoctorPatients,
  logout,
  submitDoctorAdvice,
} from '../lib/api';
import { formatApiError, getRiskZoneStyle } from '../lib/surveyUtils';
import type { PatientListItem, SurveyResponseOut } from '../types/api';
import type { UserProfile } from '../types';
import SurveyReport from './SurveyReport';
import { t } from '../lib/lang';

interface DoctorDashboardProps {
  doctorUser: UserProfile;
  onLogout: () => void;
  language?: 'lotin' | 'kirill';
  onLanguageChange?: (lang: 'lotin' | 'kirill') => void;
}

export default function DoctorDashboard({
  doctorUser,
  onLogout,
  language = 'lotin',
  onLanguageChange,
}: DoctorDashboardProps) {
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [allSurveys, setAllSurveys] = useState<SurveyResponseOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('barchasi');
  const [activePatient, setActivePatient] = useState<PatientListItem | null>(null);
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyResponseOut | null>(null);
  const [newAdviceText, setNewAdviceText] = useState('');
  const [recipeJson, setRecipeJson] = useState('');
  const [submittingAdvice, setSubmittingAdvice] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [patientList, surveys] = await Promise.all([
        getDoctorPatients({
          search: searchTerm || undefined,
          risk_zone_filter: riskFilter !== 'barchasi' ? riskFilter : undefined,
        }),
        getAllSurveyResponses(),
      ]);
      setPatients(patientList);
      setAllSurveys(surveys);
    } catch (err) {
      setErrorMsg(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [riskFilter]);

  const filteredPatients = useMemo(() => {
    if (!searchTerm.trim()) return patients;
    const q = searchTerm.toLowerCase();
    return patients.filter(
      (p) => p.ism.toLowerCase().includes(q) || p.login.toLowerCase().includes(q)
    );
  }, [patients, searchTerm]);

  const patientSurveys = useMemo(() => {
    if (!activePatient) return [];
    return allSurveys
      .filter((s) => s.user_id === activePatient.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [activePatient, allSurveys]);

  useEffect(() => {
    if (patientSurveys.length > 0) {
      setSelectedSurvey(patientSurveys[0]);
    } else {
      setSelectedSurvey(null);
    }
  }, [patientSurveys]);

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const handleAiDraft = async () => {
    if (!activePatient || !doctorUser.tasdiqlangan) return;
    setDraftLoading(true);
    try {
      const draft = await doctorAdviceDraft(activePatient.id);
      setNewAdviceText(draft.advice_text);
      if (draft.recipe_json) {
        setRecipeJson(JSON.stringify(draft.recipe_json, null, 2));
      }
    } catch (err) {
      alert(formatApiError(err));
    } finally {
      setDraftLoading(false);
    }
  };

  const handlePostAdvice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient || !newAdviceText.trim()) return;
    if (!doctorUser.tasdiqlangan) {
      alert("Shifokorlik hisobingiz hali tasdiqlanmagan!");
      return;
    }
    setSubmittingAdvice(true);
    try {
      let recipe: Record<string, unknown> | undefined;
      if (recipeJson.trim()) {
        recipe = JSON.parse(recipeJson);
      }
      await submitDoctorAdvice({
        patient_id: activePatient.id,
        advice_text: newAdviceText.trim(),
        recipe_json: recipe,
      });
      alert('Tavsiya muvaffaqiyatli yuborildi!');
      setNewAdviceText('');
      setRecipeJson('');
    } catch (err) {
      alert(formatApiError(err));
    } finally {
      setSubmittingAdvice(false);
    }
  };

  if (!doctorUser.tasdiqlangan) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-2xl border border-amber-200 p-8 text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto animate-pulse" />
          <h2 className="text-xl font-bold text-slate-800">Tasdiqlanish kutilmoqda</h2>
          <p className="text-sm text-slate-600">
            Shifokor hisobingiz administrator tomonidan tasdiqlanguncha tizimga kirish cheklangan.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-bold"
          >
            Chiqish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <User className="w-8 h-8 text-indigo-300" />
          <div>
            <p className="text-xs text-indigo-300 font-bold uppercase">Shifokor kabineti</p>
            <h1 className="text-lg font-black">{doctorUser.ism}</h1>
          </div>
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
          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700"
            title="Yangilash"
          >
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

      <div className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              {t('Bemorlar', language)} ({filteredPatients.length})
            </h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Ism yoki login..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-200 text-sm"
            >
              <option value="barchasi">Barcha xavf zonalar</option>
              <option value="yashil">Yashil</option>
              <option value="sariq">Sariq</option>
              <option value="sargish">Sarg'ish</option>
              <option value="qizil">Qizil</option>
            </select>
            {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {filteredPatients.map((p) => {
                  const zone = p.latest_risk_zone;
                  const style = getRiskZoneStyle(zone);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActivePatient(p)}
                      className={`w-full text-left p-3 rounded-xl border transition ${
                        activePatient?.id === p.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-sm text-slate-800">{p.ism}</span>
                        {zone && (
                          <span
                            className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: style.color }}
                          >
                            {zone}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {p.yosh} yosh · {p.jins} · {p.login}
                      </p>
                      {p.latest_risk_score != null && (
                        <p className="text-[10px] font-mono text-indigo-600 mt-0.5">
                          Risk: {p.latest_risk_score}%
                        </p>
                      )}
                    </button>
                  );
                })}
                {filteredPatients.length === 0 && (
                  <p className="text-center text-sm text-slate-500 py-6">Bemorlar topilmadi</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {!activePatient ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">Chapdan bemorni tanlang</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h2 className="text-xl font-black text-slate-900">{activePatient.ism}</h2>
                <p className="text-sm text-slate-500">
                  {activePatient.yosh} yosh · {activePatient.jins} · @{activePatient.login}
                </p>
                {patientSurveys.length > 1 && (
                  <select
                    className="mt-3 w-full p-2 rounded-xl border text-sm"
                    value={selectedSurvey?.id || ''}
                    onChange={(e) => {
                      const s = patientSurveys.find((x) => x.id === e.target.value);
                      setSelectedSurvey(s || null);
                    }}
                  >
                    {patientSurveys.map((s) => (
                      <option key={s.id} value={s.id}>
                        {new Date(s.created_at).toLocaleString('uz-UZ')} — {s.risk_zonasi || '—'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedSurvey ? (
                <SurveyReport
                  survey={selectedSurvey}
                  tahlil={selectedSurvey.ai_response}
                  language={language}
                  onUpdated={(result) => {
                    setAllSurveys((prev) =>
                      prev.map((s) => (s.id === result.response.id ? result.response : s))
                    );
                    setSelectedSurvey(result.response);
                  }}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
                  Bu bemorda so'rovnoma natijalari yo'q
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Tavsiya yozish</h3>
                  <button
                    type="button"
                    onClick={handleAiDraft}
                    disabled={draftLoading}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-100 text-violet-800 text-xs font-bold"
                  >
                    {draftLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    AI draft
                  </button>
                </div>
                <form onSubmit={handlePostAdvice} className="space-y-3">
                  <textarea
                    value={newAdviceText}
                    onChange={(e) => setNewAdviceText(e.target.value)}
                    rows={5}
                    placeholder="Klinik tavsiya matni..."
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm"
                    required
                  />
                  <textarea
                    value={recipeJson}
                    onChange={(e) => setRecipeJson(e.target.value)}
                    rows={3}
                    placeholder='Retsept JSON (ixtiyoriy): {"preparatlar":["..."]}'
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm font-mono text-xs"
                  />
                  <button
                    type="submit"
                    disabled={submittingAdvice}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold flex items-center gap-2"
                  >
                    {submittingAdvice ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Yuborish
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
