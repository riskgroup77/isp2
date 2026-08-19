/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Activity, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  User, 
  MapPin, 
  TrendingDown, 
  Printer, 
  BookOpen, 
  Award, 
  Percent, 
  Clock, 
  ArrowRight, 
  ArrowLeft,
  Check,
  Globe, 
  RefreshCw, 
  FileDown, 
  Search, 
  Building2, 
  Sparkles, 
  Plus, 
  Trash2,
  AlertCircle,
  Bell,
  Volume2,
  Pencil,
  ShieldAlert,
  X
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { QuestionnaireData, RiskAnalysisResult, TextAnalysisResponse, HealthJournalEntry, UserProfile, PatientAdvice, MedicationAlarm, CorporateSurvey } from './types';
import AuthScreen from './components/AuthScreen';
import DoctorDashboard from './components/DoctorDashboard';
import AdminDashboard from './components/AdminDashboard';
import SurveyWizard from './components/SurveyWizard';
import SurveyReport from './components/SurveyReport';
import DiseaseRiskPrognosis from './components/DiseaseRiskPrognosis';
import ApiStatusBanner from './components/ApiStatusBanner';
import { t } from './lib/lang';
import { APP_BRAND, APP_DISCLAIMER, APP_FOOTER_COPY } from './lib/branding';
import {
  advisorChat,
  analyzeComplaint,
  apiProfileToUser,
  clearTokens,
  getMySurveys,
  getProfile,
  hasToken,
  logout as apiLogout,
  predictRisk,
} from './lib/api';
import { formatApiError, getRiskZoneStyle } from './lib/surveyUtils';
import { exportJournalToExcel } from './lib/excelExport';
import { apiReportToRiskAnalysisResult, questionnaireToPredictRiskPayload } from './lib/riskMapping';
import { useApiHealth } from './lib/useApiHealth';
import type { AIReport, SurveyResponseOut, SurveySubmitResponse } from './types/api';

// Default initial state
const defaultQuestionnaire: QuestionnaireData = {
  yosh: 35,
  jins: 'erkak',
  boy: 172,
  vazn: 74,
  sistolik: 122,
  diastolik: 78,
  glyukoza: '',
  xolesterin: '',
  tuzIstemi: 'ortacha',
  shakarVaXamir: 'ortacha',
  sabzavotMeva: 'har_kuni',
  jismoniyFaollik: 'ortacha',
  chekish: 'yoq',
  nosvoy: 'yoq',
  oiladaKasallik: [],
  tibbiyotXodimi: false,
  nazariyBilimDarajasi: 'yaxshi',
  realKomplayens: 'ortacha',
  shaharTuman: "Farg'ona shahri",
  erkinShikoyat: ''
};

const FERGANA_REGIONS = [
  "Farg'ona shahri",
  "Marg'ilon shahri",
  "Qo'qon shahri",
  "Quva tumani",
  "Rishton tumani",
  "Oltiariq tumani",
  "Beshariq tumani",
  "Bag'dod tumani",
  "Buvayda tumani",
  "Dang'ara tumani",
  "Uchko'prik tumani",
  "Toshloq tumani",
  "Yozyovon tumani",
  "Quvasoy shahri",
  "Farg'ona tumani"
];

const AVAILABLE_DISEASES = [
  { id: 'gipertoniya', label: 'Arterial Gipertoniya' },
  { id: 'diabet', label: 'Qandli Diabet' },
  { id: 'yurak_xastaligi', label: 'Yurak ishemik kasalligi' },
  { id: 'insult', label: 'Insult va Infarkt' }
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-slate-100 p-3 rounded-xl shadow-xl border border-slate-700/80 text-xs space-y-1.5 font-sans">
        <p className="font-extrabold text-slate-400 border-b border-slate-700 pb-1 mb-1 font-mono">{label}</p>
        {payload.map((item: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.stroke || item.color }} />
              {item.name}:
            </span>
            <span className="font-mono font-extrabold" style={{ color: item.stroke || item.color }}>
              {item.value} {item.name.toLowerCase().includes('puls') ? 'zarba/min' : 'mmHg'}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function App() {
  const [language, setLanguage] = useState<'lotin' | 'kirill'>('lotin');
  const { status: apiStatus, message: apiStatusMessage, retry: retryApiHealth } = useApiHealth();
  
  // Authentication — faqat JWT orqali sessiya tiklanadi
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState(hasToken());

  const [patientAdvices, setPatientAdvices] = useState<PatientAdvice[]>([]);
  const [apiSurveys, setApiSurveys] = useState<SurveyResponseOut[]>([]);
  const [selectedSurveyResult, setSelectedSurveyResult] = useState<SurveyResponseOut | null>(null);
  const [lastSubmitResult, setLastSubmitResult] = useState<SurveySubmitResponse | null>(null);
  const [historyViewId, setHistoryViewId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'screening' | 'innovations' | 'outcomes' | 'history' | 'journal' | 'advices'>('screening');
  
  // Health Journal states
  const [journalEntries, setJournalEntries] = useState<HealthJournalEntry[]>([]);
  const [journalForm, setJournalForm] = useState({
    sana: new Date().toISOString().split('T')[0],
    vaqt: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false }),
    sistolik: 120,
    diastolik: 80,
    puls: 72,
    glyukoza: '' as number | '',
    vazn: '' as number | '',
    uyqu: 'yaxshi' as 'yaxshi' | 'ortacha' | 'yomon',
    stress: 'past' as 'past' | 'ortacha' | 'yuqori',
    alomatlar: [] as string[],
    dorilar: [
      { nomi: 'Lisinopril', doza: '10 mg', ichildi: false },
      { nomi: 'Amlodipin', doza: '5 mg', ichildi: false }
    ] as { nomi: string; doza: string; ichildi: boolean }[],
    qaydlar: '',
    yurilganMetr: '' as number | '',
    ichilganSuvMl: '' as number | '',
    uxquSoati: '' as number | '',
  });
  
  const [newMedNomi, setNewMedNomi] = useState('');
  const [newMedDoza, setNewMedDoza] = useState('');

  // Medication alarms for reminders (stored in localStorage)
  const [medAlarms, setMedAlarms] = useState<MedicationAlarm[]>(() => {
    try {
      const stored = localStorage.getItem('soglik_dori_reminders');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse med alarms:", e);
    }
    return [
      { id: 'al-1', nomi: 'Lozap H', doza: '50 mg', vaqt: '08:00', faol: true, ichildiBugun: false, oxirgiIchilganSana: '' },
      { id: 'al-2', nomi: 'Cardiomagnyl', doza: '75 mg', vaqt: '14:00', faol: true, ichildiBugun: false, oxirgiIchilganSana: '' },
      { id: 'al-3', nomi: 'Bisoprolol', doza: '5 mg', vaqt: '20:00', faol: true, ichildiBugun: false, oxirgiIchilganSana: '' }
    ];
  });

  const [activeNotification, setActiveNotification] = useState<MedicationAlarm | null>(null);
  const [editingAlarm, setEditingAlarm] = useState<MedicationAlarm | null>(null);

  // Play a beautiful soft medical alert chime via Web Audio API
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
      
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
      gain2.gain.setValueAtTime(0.10, audioCtx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
      
      osc1.start();
      osc1.stop(audioCtx.currentTime + 1.5);
      osc2.start(audioCtx.currentTime + 0.15);
      osc2.stop(audioCtx.currentTime + 1.8);
    } catch (e) {
      console.warn("Audio Context could not play chime:", e);
    }
  };

  // Keep track of which alarms were triggered at which exact hour/minute today
  // to prevent double trigger within the same minute.
  const [triggeredAlarmsThisMin, setTriggeredAlarmsThisMin] = useState<{ [key: string]: string }>({});

  // Sync alarms back to localStorage
  useEffect(() => {
    localStorage.setItem('soglik_dori_reminders', JSON.stringify(medAlarms));
  }, [medAlarms]);

  // Real-time interval checker for medication times
  useEffect(() => {
    if (!currentUser || currentUser.rol !== 'xodim') return;

    const interval = setInterval(() => {
      const hozir = new Date();
      const bugunSana = hozir.toISOString().split('T')[0];
      const joriyVaqt = hozir.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false });

      setMedAlarms(prev => {
        let isChanged = false;
        const updated = prev.map(al => {
          // Reset ichildi status if date has changed
          if (al.oxirgiIchilganSana && al.oxirgiIchilganSana !== bugunSana && al.ichildiBugun) {
            isChanged = true;
            return { ...al, ichildiBugun: false };
          }
          return al;
        });
        return isChanged ? updated : prev;
      });

      // Filter active alarms for current time
      medAlarms.forEach(alarm => {
        if (alarm.faol && alarm.vaqt === joriyVaqt) {
          const triggerKey = `${alarm.id}-${bugunSana}-${joriyVaqt}`;
          if (!triggeredAlarmsThisMin[triggerKey] && alarm.oxirgiIchilganSana !== bugunSana) {
            // Trigger!
            setTriggeredAlarmsThisMin(prev => ({ ...prev, [triggerKey]: 'triggered' }));
            setActiveNotification(alarm);
            playChime();
          }
        }
      });
    }, 12000); // Check every 12 seconds

    return () => clearInterval(interval);
  }, [medAlarms, triggeredAlarmsThisMin, currentUser]);

  // Load journal entries from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('soglik_kundaligi');
      if (stored) {
        setJournalEntries(JSON.parse(stored));
      } else {
        const initialSamples: HealthJournalEntry[] = [
          {
            id: 'sample-1',
            sana: '2026-06-09',
            vaqt: '08:30',
            sistolik: 135,
            diastolik: 87,
            puls: 78,
            glyukoza: 5.6,
            vazn: 74,
            uyqu: 'ortacha',
            stress: 'ortacha',
            alomatlar: ['holsizlik'],
            dorilar: [
              { nomi: 'Lisinopril', doza: '10 mg', ichildi: true },
              { nomi: 'Amlodipin', doza: '5 mg', ichildi: false }
            ],
            qaydlar: 'Ertalab biroz bosh aylanishi his qilindi. Oliy ma\'lumotli pedagog xodim bo\'lganligim sababli dori ichish tartibiga rioya qilishim kerak.'
          },
          {
            id: 'sample-2',
            sana: '2026-06-10',
            vaqt: '10:15',
            sistolik: 124,
            diastolik: 80,
            puls: 72,
            glyukoza: 5.2,
            vazn: 73.8,
            uyqu: 'yaxshi',
            stress: 'past',
            alomatlar: [],
            dorilar: [
              { nomi: 'Lisinopril', doza: '10 mg', ichildi: true },
              { nomi: 'Amlodipin', doza: '5 mg', ichildi: true }
            ],
            qaydlar: 'Bugun o\'zimni juda yaxshi his qilyapman. Milliy taomlardagi tuz va paxta yog\'ini chekladim. Kunlik 8000 qadam piyoda yurish bajarildi!'
          }
        ];
        setJournalEntries(initialSamples);
        localStorage.setItem('soglik_kundaligi', JSON.stringify(initialSamples));
      }
    } catch (e) {
      console.error("Failed to load journal entries:", e);
    }
  }, []);

  // Form mode: standardized vs AI Complaint vs Corporate
  const [intakeMode, setIntakeMode] = useState<'standard' | 'complaint' | 'corporate'>('corporate');
  const [showDoctorReport, setShowDoctorReport] = useState<boolean>(false);
  
  // State for forms
  const [formData, setFormData] = useState<QuestionnaireData>({ ...defaultQuestionnaire });
  const [complaintText, setComplaintText] = useState<string>('');
  const [isAnalyzingComplaint, setIsAnalyzingComplaint] = useState<boolean>(false);
  const [aiTextResult, setAiTextResult] = useState<TextAnalysisResponse | null>(null);
  
  // Prediction result
  const [riskResult, setRiskResult] = useState<RiskAnalysisResult | null>(null);
  const [isCalculatingRisk, setIsCalculatingRisk] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // History list
  const [historyList, setHistoryList] = useState<{ id: string; date: string; data: QuestionnaireData; result: RiskAnalysisResult }[]>([]);
  
  // Corporate Surveys list state
  const [corporateSurveys, setCorporateSurveys] = useState<CorporateSurvey[]>([]);

  const loadApiSurveys = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const surveys = await getMySurveys();
      const sorted = [...surveys].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setApiSurveys(sorted);
    } catch (e) {
      console.error('Failed to load surveys:', e);
      setHistoryError(formatApiError(e));
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history' && currentUser?.rol === 'xodim') {
      loadApiSurveys();
    }
  }, [activeTab, currentUser?.id]);

  // Restore session from JWT on load — localStorage cache ishlatilmaydi
  useEffect(() => {
    const restore = async () => {
      if (!hasToken()) {
        setAuthChecking(false);
        return;
      }
      try {
        const profile = await getProfile();
        const user = apiProfileToUser(profile) as UserProfile;
        setCurrentUser(user);
        localStorage.setItem('soglik_portal_user', JSON.stringify(user));
      } catch {
        clearTokens();
        localStorage.removeItem('soglik_portal_user');
        setCurrentUser(null);
      } finally {
        setAuthChecking(false);
      }
    };
    restore();
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setCurrentUser(null);
      localStorage.removeItem('soglik_portal_user');
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  // Backend synchronizer — eski Express server o'rniga API surveys
  const syncDataWithServer = async (_user: UserProfile) => {
    await loadApiSurveys();
  };

  const fetchPatientAdvices = async (_userId: string) => {
    // Backend hozircha xodim uchun maslahatlar ro'yxatini bermaydi
    setPatientAdvices([]);
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch {
      /* ignore */
    }
    localStorage.removeItem('soglik_portal_user');
    localStorage.removeItem('soglik_skrining_tarixi');
    localStorage.removeItem('soglik_kundaligi');
    setCurrentUser(null);
    setHistoryList([]);
    setJournalEntries([]);
    setApiSurveys([]);
    setSelectedSurveyResult(null);
    setLastSubmitResult(null);
    setActiveTab('screening');
  };

  // User hydration effect
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('soglik_portal_user', JSON.stringify(currentUser));
      if (currentUser.rol === 'xodim') {
        fetchPatientAdvices(currentUser.id);
        loadApiSurveys();
        
        // Hydrate from back-end if local storage is blank
        const localHist = localStorage.getItem('soglik_skrining_tarixi');
        const localJour = localStorage.getItem('soglik_kundaligi');
        const localCorp = localStorage.getItem('corporate_surveys');

        if ((!localHist || JSON.parse(localHist).length === 0) && currentUser.soglik_skrining_tarixi && currentUser.soglik_skrining_tarixi.length > 0) {
          const normalized = currentUser.soglik_skrining_tarixi.map((item: any, idx: number) => ({
            id: item.id || `hist-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            date: item.date || item.sana || new Date().toLocaleString('uz-UZ', { hour12: false }),
            data: item.data,
            result: item.result || item.riskResult
          }));
          setHistoryList(normalized);
          localStorage.setItem('soglik_skrining_tarixi', JSON.stringify(normalized));
        }
        if ((!localJour || JSON.parse(localJour).length === 0) && currentUser.soglik_kundaligi && currentUser.soglik_kundaligi.length > 0) {
          setJournalEntries(currentUser.soglik_kundaligi);
          localStorage.setItem('soglik_kundaligi', JSON.stringify(currentUser.soglik_kundaligi));
        }
        if ((!localCorp || JSON.parse(localCorp).length === 0) && currentUser.corporate_surveys && currentUser.corporate_surveys.length > 0) {
          setCorporateSurveys(currentUser.corporate_surveys);
          localStorage.setItem('corporate_surveys', JSON.stringify(currentUser.corporate_surveys));
        }
      }
    } else {
      localStorage.removeItem('soglik_portal_user');
    }
  }, [currentUser]);

  // Simulation modifications state (for "What-If" prediction models)
  const [simulatedWeight, setSimulatedWeight] = useState<number | null>(null);
  const [simulatedSalt, setSimulatedSalt] = useState<'past' | 'ortacha' | 'yuqori' | null>(null);
  const [simulatedActivity, setSimulatedActivity] = useState<'kam' | 'ortacha' | 'yuqori' | null>(null);
  const [simulatedTobacco, setSimulatedTobacco] = useState<'yoq' | 'ha' | null>(null);
  const [simulatedNosvoy, setSimulatedNosvoy] = useState<'yoq' | 'ha' | null>(null);
  const [simulatedResult, setSimulatedResult] = useState<number | null>(null);

  // AI Advisor Chat states
  const [chatMessages, setChatMessages] = useState<{ id: string; role: 'user' | 'model'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isSendingToChat, setIsSendingToChat] = useState<boolean>(false);

  // Whenever riskResult changes, restart chat with personalized welcome message
  useEffect(() => {
    if (riskResult) {
      setChatMessages([
        {
          id: 'welcome',
          role: 'model',
          text: `Assalomu alaykum! Men sizning shaxsiy salomatlik va kardiologik profilaktika maslahatchingizman. Sizning risk ko'rsatkickingiz ${riskResult.riskFoizi}% deb hisoblandi va siz ${riskResult.zona === 'yashil' ? 'xavf darajasi past yashil' : (riskResult.zona === 'sariq' ? 'xavf darajasi o\'rtacha sariq' : 'yuqori xavfli qizil')} zonadasiz. Farg'ona vodiysi aholisi uchun maxsus ishlab chiqilgan parhez oshyo'rig'i, jismoniy mashg'ulotlar yoki nosvoyni bekor qilish sirlari haqida qanday savolingiz bor?`
        }
      ]);
    } else {
      setChatMessages([]);
    }
  }, [riskResult]);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingToChat || !riskResult) return;

    const userMsg = {
      id: Math.random().toString(),
      role: 'user' as const,
      text: chatInput.trim()
    };

    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setIsSendingToChat(true);

    try {
      const chatHistory = updatedMessages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text,
        }));

      const resData = await advisorChat(userMsg.text, chatHistory);

      setChatMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: 'model',
          text: resData.javob,
        },
      ]);
    } catch (err: unknown) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: 'model',
          text: `Kechirasiz, xatolik: ${formatApiError(err)}`,
        },
      ]);
    } finally {
      setIsSendingToChat(false);
    }
  };

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('soglik_skrining_tarixi');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((item: any, idx: number) => ({
            id: item.id || `hist-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            date: item.date || item.sana || new Date().toLocaleString('uz-UZ', { hour12: false }),
            data: item.data,
            result: item.result || item.riskResult
          }));
          setHistoryList(normalized);
        }
      }
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  }, []);

  // Load corporate surveys from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('corporate_surveys');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCorporateSurveys(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load corporate surveys:", e);
    }
  }, []);

  const handleSurveyComplete = (result: SurveySubmitResponse) => {
    setLastSubmitResult(result);
    setSelectedSurveyResult(result.response);
    setApiSurveys((prev) => [result.response, ...prev.filter((s) => s.id !== result.response.id)]);
    if (result.tahlil) {
      setRiskResult(apiReportToRiskAnalysisResult(result.tahlil, result.bmi));
    }
    loadApiSurveys();
    // Skrining sahifasida qoladi — arxivga avtomatik o'tmaydi
  };

  const saveCorporateSurvey = (_survey: CorporateSurvey, _questionnaireData?: QuestionnaireData, _riskResult?: RiskAnalysisResult) => {
    loadApiSurveys();
  };

  // Save history helper
  const saveToHistory = (dataRecord: QuestionnaireData, resultRecord: RiskAnalysisResult) => {
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toLocaleString('uz-UZ', { hour12: false }),
      data: { ...dataRecord },
      result: { ...resultRecord }
    };
    const updated = [newItem, ...historyList].slice(0, 30); // limit to 30 items
    setHistoryList(updated);
    localStorage.setItem('soglik_skrining_tarixi', JSON.stringify(updated));
    if (currentUser) {
      syncDataWithServer(currentUser);
    }
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = historyList.filter(item => item.id !== id);
    setHistoryList(updated);
    localStorage.setItem('soglik_skrining_tarixi', JSON.stringify(updated));
    if (currentUser) {
      syncDataWithServer(currentUser);
    }
  };

  const handleAddJournalEntry = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newEntry: HealthJournalEntry = {
      id: Math.random().toString(36).substr(2, 9),
      sana: journalForm.sana,
      vaqt: journalForm.vaqt,
      sistolik: Number(journalForm.sistolik) || 120,
      diastolik: Number(journalForm.diastolik) || 80,
      puls: Number(journalForm.puls) || 72,
      glyukoza: journalForm.glyukoza !== '' ? Number(journalForm.glyukoza) : '',
      vazn: journalForm.vazn !== '' ? Number(journalForm.vazn) : '',
      uyqu: journalForm.uyqu,
      stress: journalForm.stress,
      alomatlar: [...journalForm.alomatlar],
      dorilar: journalForm.dorilar.map(d => ({ ...d })),
      qaydlar: journalForm.qaydlar,
      yurilganMetr: journalForm.yurilganMetr !== '' ? Number(journalForm.yurilganMetr) : '',
      ichilganSuvMl: journalForm.ichilganSuvMl !== '' ? Number(journalForm.ichilganSuvMl) : '',
      uxquSoati: journalForm.uxquSoati !== '' ? Number(journalForm.uxquSoati) : '',
    };

    const updated = [newEntry, ...journalEntries];
    setJournalEntries(updated);
    localStorage.setItem('soglik_kundaligi', JSON.stringify(updated));
    if (currentUser) {
      syncDataWithServer(currentUser);
    }

    // Reset part of form
    setJournalForm(prev => ({
      ...prev,
      sana: new Date().toISOString().split('T')[0],
      vaqt: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false }),
      glyukoza: '',
      vazn: '',
      alomatlar: [],
      dorilar: prev.dorilar.map(d => ({ ...d, ichildi: false })),
      qaydlar: '',
      yurilganMetr: '',
      ichilganSuvMl: '',
      uxquSoati: '',
    }));
  };

  const handleDeleteJournalEntry = (id: string) => {
    const updated = journalEntries.filter(e => e.id !== id);
    setJournalEntries(updated);
    localStorage.setItem('soglik_kundaligi', JSON.stringify(updated));
    if (currentUser) {
      syncDataWithServer(currentUser);
    }
  };

  const downloadJournalCSV = () => {
    if (journalEntries.length === 0) {
      alert("Hozircha kundalikka yozuvlar kiritilmagan.");
      return;
    }
    
    const headers = [
      "Sana",
      "Vaqt",
      "Sistolik qon bosimi (mmHg)",
      "Diastolik qon bosimi (mmHg)",
      "Puls (zarba/min)",
      "Qondagi qand miqdori (mmol/l)",
      "Vazn (kg)",
      "Yurilgan masofa (metr)",
      "Ichilgan suyuqlik (ml)",
      "Uxlash vaqti (soat)",
      "Uyqu sifati",
      "Stress darajasi",
      "Alomatlar",
      "Qabul qilingan dorilar",
      "Qaydlar"
    ];
    
    const rows = journalEntries.map(e => {
      const alomatlarStr = e.alomatlar.length > 0 
        ? e.alomatlar.map(a => {
            if (a === 'ogriq') return "Ko'krak og'rig'i";
            if (a === 'nafas_qisilishi') return "Nafas qisilishi";
            if (a === 'bosh_aylanishi') return "Bosh aylanishi";
            if (a === 'yurak_oynashi') return "Yurak o'ynashi";
            if (a === 'shishlar') return "Oyoqlarda shishlar";
            if (a === 'holsizlik') return "Holsizlik";
            return a;
          }).join(', ')
        : "Yo'q";
        
      const dorilarStr = e.dorilar.length > 0
        ? e.dorilar.map(d => `${d.nomi} (${d.doza}) - ${d.ichildi ? 'Ichildi' : 'Ichilmadi'}`).join(' | ')
        : "Yo'qtir";
        
      return [
        e.sana,
        e.vaqt,
        e.sistolik,
        e.diastolik,
        e.puls,
        e.glyukoza !== '' ? e.glyukoza : "Kiritilmagan",
        e.vazn !== '' ? e.vazn : "Kiritilmagan",
        e.yurilganMetr !== '' && e.yurilganMetr != null ? e.yurilganMetr : "Kiritilmagan",
        e.ichilganSuvMl !== '' && e.ichilganSuvMl != null ? e.ichilganSuvMl : "Kiritilmagan",
        e.uxquSoati !== '' && e.uxquSoati != null ? e.uxquSoati : "Kiritilmagan",
        e.uyqu === 'yaxshi' ? 'Yaxshi' : (e.uyqu === 'ortacha' ? 'O\'rtacha' : 'Yomon'),
        e.stress === 'past' ? 'Past' : (e.stress === 'ortacha' ? 'O\'rtacha' : 'Yuqori'),
        `"${alomatlarStr}"`,
        `"${dorilarStr}"`,
        `"${(e.qaydlar || "").replace(/"/g, '""')}"`
      ];
    });
    
    // Create CSV content with UTF-8 BOM
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Kardiologik_Salomatlik_Kundaligi_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadJournalExcel = () => {
    if (journalEntries.length === 0) {
      alert("Hozircha kundalikka yozuvlar kiritilmagan.");
      return;
    }
    try {
      exportJournalToExcel(
        journalEntries.map((e) => ({
          Sana: e.sana,
          Vaqt: e.vaqt,
          'Sistolik (mmHg)': e.sistolik,
          'Diastolik (mmHg)': e.diastolik,
          'Puls (/min)': e.puls,
          'Glyukoza (mmol/l)': e.glyukoza !== '' ? e.glyukoza : '',
          'Vazn (kg)': e.vazn !== '' ? e.vazn : '',
          'Yurilgan (metr)': e.yurilganMetr !== '' && e.yurilganMetr != null ? e.yurilganMetr : '',
          'Suv (ml)': e.ichilganSuvMl !== '' && e.ichilganSuvMl != null ? e.ichilganSuvMl : '',
          'Uxqu (soat)': e.uxquSoati !== '' && e.uxquSoati != null ? e.uxquSoati : '',
          'Uyqu sifati': e.uyqu,
          Stress: e.stress,
          Alomatlar: e.alomatlar.join(', '),
          Qaydlar: e.qaydlar,
        }))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Excel yuklab olishda xatolik.');
    }
  };

  const handleAddMedication = () => {
    if (!newMedNomi.trim()) return;
    const nomi = newMedNomi.trim();
    const doza = newMedDoza.trim() || 'me\'yorda';
    
    setJournalForm(prev => {
      const exists = prev.dorilar.some(d => d.nomi.toLowerCase() === nomi.toLowerCase());
      if (exists) return prev;
      return {
        ...prev,
        dorilar: [...prev.dorilar, { nomi, doza, ichildi: false }]
      };
    });
    setNewMedNomi('');
    setNewMedDoza('');
  };

  const handleRemoveMedication = (nomi: string) => {
    setJournalForm(prev => ({
      ...prev,
      dorilar: prev.dorilar.filter(d => d.nomi !== nomi)
    }));
  };

  const toggleMedicationIchildi = (nomi: string) => {
    setJournalForm(prev => ({
      ...prev,
      dorilar: prev.dorilar.map(d => d.nomi === nomi ? { ...d, ichildi: !d.ichildi } : d)
    }));
  };

  // Trigger Local/AI Risk Calculations
  const handleCalculateRisk = async (e?: React.FormEvent, customData?: QuestionnaireData) => {
    if (e) e.preventDefault();
    setIsCalculatingRisk(true);
    setErrorMsg(null);
    
    // Reset simulation overrides
    setSimulatedWeight(null);
    setSimulatedSalt(null);
    setSimulatedActivity(null);
    setSimulatedTobacco(null);
    setSimulatedNosvoy(null);
    setSimulatedResult(null);

    const dataToSubmit = customData || formData;

    try {
      const payload = questionnaireToPredictRiskPayload(dataToSubmit, currentUser);
      const data = await predictRisk(payload);
      const mapped = apiReportToRiskAnalysisResult(data as AIReport, (data as AIReport).tmi ?? null);
      setRiskResult(mapped);
      saveToHistory(dataToSubmit, mapped);
    } catch (err: unknown) {
      setErrorMsg(formatApiError(err));
    } finally {
      setIsCalculatingRisk(false);
    }
  };

  // Run What-If Simulation
  useEffect(() => {
    if (!riskResult) return;
    
    // Quick local simulation approximation logic based on backend formula offsets
    let simPointsOffset = 0;
    const baseWeight = simulatedWeight !== null ? simulatedWeight : formData.vazn;
    const baseSalt = simulatedSalt !== null ? simulatedSalt : formData.tuzIstemi;
    const baseActivity = simulatedActivity !== null ? simulatedActivity : formData.jismoniyFaollik;
    const baseTob = simulatedTobacco !== null ? simulatedTobacco : formData.chekish;
    const baseNos = simulatedNosvoy !== null ? simulatedNosvoy : formData.nosvoy;

    // BMI simulation offset
    const originalTmi = formData.vazn / Math.pow(formData.boy / 100, 2);
    const newTmi = baseWeight / Math.pow(formData.boy / 100, 2);
    
    // rough points calculations delta
    let origTmiPts = originalTmi >= 30 ? 5 : (originalTmi >= 25 ? 2 : 0);
    let newTmiPts = newTmi >= 30 ? 5 : (newTmi >= 25 ? 2 : 0);
    simPointsOffset += (newTmiPts - origTmiPts);

    // Salt adjustment
    let origSaltPts = formData.tuzIstemi === 'yuqori' ? 4 : (formData.tuzIstemi === 'ortacha' ? 1 : 0);
    let newSaltPts = baseSalt === 'yuqori' ? 4 : (baseSalt === 'ortacha' ? 1 : 0);
    simPointsOffset += (newSaltPts - origSaltPts);

    // Activity
    let origActPts = formData.jismoniyFaollik === 'kam' ? 4 : (formData.jismoniyFaollik === 'ortacha' ? 1 : 0);
    let newActPts = baseActivity === 'kam' ? 4 : (baseActivity === 'ortacha' ? 1 : 0);
    simPointsOffset += (newActPts - origActPts);

    // Tobacco
    let origTobPts = formData.chekish === 'ha' ? 4 : (formData.chekish === 'chekar_edi' ? 1 : 0);
    let newTobPts = baseTob === 'ha' ? 4 : (baseTob === 'chekar_edi' ? 1 : 0);
    simPointsOffset += (newTobPts - origTobPts);

    // Nosvoy
    let origNosPts = formData.nosvoy === 'ha' ? 3 : 0;
    let newNosPts = baseNos === 'ha' ? 3 : 0;
    simPointsOffset += (newNosPts - origNosPts);

    // Project points translation
    // Retrieve approximate points used for base prediction
    let estOriginalPoints = 0;
    if (riskResult.riskFoizi <= 24) {
      estOriginalPoints = riskResult.riskFoizi / 3;
    } else if (riskResult.riskFoizi > 24 && riskResult.riskFoizi <= 67) {
      estOriginalPoints = 8 + (riskResult.riskFoizi - 25) / 3;
    } else {
      estOriginalPoints = 22 + (riskResult.riskFoizi - 68) / 1.8;
    }

    let simPoints = estOriginalPoints + simPointsOffset;
    let simPct = 5;
    if (simPoints <= 8) {
      simPct = Math.round(simPoints * 3);
    } else if (simPoints > 8 && simPoints <= 22) {
      simPct = Math.round(25 + (simPoints - 8) * 3);
    } else {
      simPct = Math.round(Math.min(99, 68 + (simPoints - 22) * 1.8));
    }
    
    setSimulatedResult(Math.max(3, simPct));

  }, [simulatedWeight, simulatedSalt, simulatedActivity, simulatedTobacco, simulatedNosvoy, riskResult]);

  // Handle complaint parsing
  const handleAnalyzeComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintText.trim()) return;

    setIsAnalyzingComplaint(true);
    setErrorMsg(null);
    setAiTextResult(null);

    try {
      const data = await analyzeComplaint(complaintText);
      const mapped: TextAnalysisResponse = {
        muvaffaqiyatli: true,
        aniqlanganParametrlar: data.aniqlanganParametrlar as Partial<QuestionnaireData>,
        tahlilMatni: data.tahlilMatni,
        tavsiyalar: data.tavsiyalar,
        yanaMalumotKerakmi: data.yanaMalumotKerakmi,
        aniqlashtiruvchiSavollar: data.aniqlashtiruvchiSavollar,
      };
      setAiTextResult(mapped);

      if (mapped.aniqlanganParametrlar) {
        setFormData((prev) => ({
          ...prev,
          ...mapped.aniqlanganParametrlar,
        }));
      }
    } catch (err: unknown) {
      setErrorMsg(formatApiError(err));
    } finally {
      setIsAnalyzingComplaint(false);
    }
  };

  const applyExtractedParamsAndCalculate = () => {
    if (!aiTextResult) return;
    setIntakeMode('standard');
    // Scroll or open risk calculations
    handleCalculateRisk(undefined, formData);
  };

  const handleDiseaseCheck = (id: string) => {
    setFormData(prev => {
      const active = prev.oiladaKasallik.includes(id)
        ? prev.oiladaKasallik.filter(item => item !== id)
        : [...prev.oiladaKasallik, id];
      return { ...prev, oiladaKasallik: active };
    });
  };

  const printReport = () => {
    window.print();
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-600">Sessiya tekshirilmoqda...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <ApiStatusBanner status={apiStatus} message={apiStatusMessage} onRetry={retryApiHealth} />
        <AuthScreen onAuthSuccess={(user) => setCurrentUser(user)} language={language} onLanguageChange={setLanguage} />
      </>
    );
  }

  if (currentUser.rol === 'shifokor') {
    return <DoctorDashboard doctorUser={currentUser} onLogout={handleLogout} language={language} onLanguageChange={setLanguage} />;
  }

  if (currentUser.rol === 'admin') {
    return <AdminDashboard adminUser={currentUser} onLogout={handleLogout} language={language} onLanguageChange={setLanguage} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased flex flex-col lg:flex-row print:flex-col">
      <ApiStatusBanner status={apiStatus} message={apiStatusMessage} onRetry={retryApiHealth} />
      
      {/* PUSH NOTIFICATION STYLE REMINDER MODAL */}
      {activeNotification && (
        <div className="fixed bottom-5 right-5 sm:top-5 sm:bottom-auto z-[9999] max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl border-4 border-indigo-500 overflow-hidden animate-bounce p-5 space-y-4" id="medication-alert-toast">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Bell className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-red-400 uppercase tracking-widest block font-mono">💊 DORI VAQTI BO'LDI!</span>
                <h4 className="font-extrabold text-base text-slate-50">{activeNotification.nomi}</h4>
              </div>
            </div>
            <button 
              onClick={() => setActiveNotification(null)}
              className="text-slate-400 hover:text-white font-black text-2xl leading-none transition"
              title="Yopish"
            >
              ×
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Siz oilaviy shifokoringiz belgilagan dori qabul qilish jadvaliga muvofiq, hozir (soat <b className="text-white bg-slate-800 px-1 py-0.5 rounded font-mono">{activeNotification.vaqt}</b> da) dorini qabul qilishingiz va uni tasdiqlashingiz kerak!
          </p>

          <div className="bg-slate-800 p-3 rounded-xl border border-slate-700/60 text-xs flex justify-between items-center">
            <span className="text-slate-400">Dozirovka / Miqdori:</span>
            <span className="font-extrabold text-indigo-300 bg-indigo-950/50 px-2.5 py-0.5 rounded-full border border-indigo-500/30 text-[11px]">{activeNotification.doza}</span>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                const alarmId = activeNotification.id;
                const bugunSana = new Date().toISOString().split('T')[0];
                
                setMedAlarms(prev => prev.map(al => {
                  if (al.id === alarmId) {
                    return { ...al, ichildiBugun: true, oxirgiIchilganSana: bugunSana };
                  }
                  return al;
                }));

                // Auto-register inside today's diary to encourage compliance
                const vaqtStr = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false });
                setJournalEntries(prev => {
                  const exists = prev.find(e => e.sana === bugunSana);
                  if (exists) {
                    return prev.map(e => e.sana === bugunSana ? {
                      ...e,
                      dorilar: e.dorilar.some(d => d.nomi === activeNotification.nomi)
                        ? e.dorilar.map(d => d.nomi === activeNotification.nomi ? { ...d, ichildi: true } : d)
                        : [...e.dorilar, { nomi: activeNotification.nomi, doza: activeNotification.doza, ichildi: true }]
                    } : e);
                  } else {
                    return [{
                      id: 'j-' + Math.random().toString(36).substr(2, 9),
                      sana: bugunSana,
                      vaqt: vaqtStr,
                      sistolik: 120,
                      diastolik: 80,
                      puls: 72,
                      glyukoza: '',
                      vazn: '',
                      uyqu: 'yaxshi',
                      stress: 'past',
                      alomatlar: [],
                      dorilar: [{ nomi: activeNotification.nomi, doza: activeNotification.doza, ichildi: true }],
                      qaydlar: `Eslatma tizimi yordamida "${activeNotification.nomi}" dorisi muvaffaqiyatli qabul qilindi.`
                    }, ...prev];
                  }
                });

                setActiveNotification(null);
                alert(`Muvaffaqiyatli! "${activeNotification.nomi} (${activeNotification.doza})" dori qabul qilinganligi Salomatlik Kundaligiga va statistikaga avtomatik kiritildi.`);
              }}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 rounded-xl text-center cursor-pointer transition shadow hover:scale-[1.02] active:scale-95"
            >
              ✓ Ichdim (Tasdiqlash)
            </button>
            <button
              onClick={() => {
                setActiveNotification(null);
                alert("Eslatuvchi vaqtinchalik keyinga surildi. Iltimos, doringizni o'z vaqtida ichishni unutmang!");
              }}
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs py-2.5 px-3 rounded-xl text-center cursor-pointer transition"
            >
              Keyinroq ⏰
            </button>
          </div>
        </div>
      )}
      
      {/* SHIFOKOR UCHUN KARDIOLOGIK HISOBOT MODAL (PDF / PRINT TAYYoR) */}
      {showDoctorReport && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:absolute print:inset-0">
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body {
                background: white !important;
                color: black !important;
              }
              header, footer, nav, button, aside, .print\\:hidden, #medication-alert-toast {
                display: none !important;
              }
              #doctor-report-print-area {
                display: block !important;
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                padding: 0 !important;
                margin: 0 !important;
                overflow: visible !important;
              }
            }
          `}} />
          
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh] print:max-h-full print:shadow-none print:rounded-none">
            
            {/* Header Controls (Hidden on Print) */}
            <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 print:hidden shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-50">Shifokor uchun Kardiologik Hisobot</h3>
                  <p className="text-[10px] text-slate-400">Salomatlik kundaligingizning rasmiy shifokorbop xulosasi</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  PDF / Chop Etish
                </button>
                <button
                  type="button"
                  onClick={() => setShowDoctorReport(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  Yopish
                </button>
              </div>
            </div>

            {/* Printable Content Body */}
            <div className="p-8 space-y-6 overflow-y-auto print:overflow-visible print:p-0" id="doctor-report-print-area">
              
              {/* Report Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] tracking-widest font-extrabold text-slate-500 uppercase">Respublika Ixtisoslashtirilgan Kardiologiya Ilmiy-Amaliy Tibbiyot Markazi ko'magida</div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight uppercase font-serif">Kardiologik Skrining & Nazorat Hisoboti</h1>
                  <p className="text-xs text-slate-500">Salomatlik Kundaligi tizimidagi ma'lumotlar tahlili</p>
                </div>
                
                {/* Stamp/Date */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-right shrink-0">
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase font-bold">Hisobot Sanasi</div>
                  <div className="font-mono text-sm font-bold text-slate-800">{new Date().toLocaleDateString('uz-UZ')}</div>
                  <div className="text-[10px] text-indigo-700 font-bold mt-1">Sog'lom Yurak Platformasi</div>
                </div>
              </div>

              {/* Patient details & summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase font-bold">Foydalanuvchi profile</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{currentUser.ism || "Bemor Kiritilmagan"}</div>
                  <div className="text-slate-500 mt-0.5">Murojaat id: <span className="font-mono font-bold text-slate-700">{currentUser.id}</span></div>
                </div>
                <div>
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase font-bold">Birlamchi Skrining</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">
                    Kardiologik Xavf: <span className="text-red-650 font-black">{currentUser.skriningXavfBalli !== undefined ? `${currentUser.skriningXavfBalli}%` : 'Surgun qilingan'}</span>
                  </div>
                  <div className="text-slate-500 mt-0.5">Yashash joyi: {currentUser.manzil || "Fergana Vodiyi, O'zbekiston"}</div>
                </div>
                <div>
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase font-bold text-xs">Yozuvlar Oralig'i</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{journalEntries.length} ta qayd mavjud</div>
                  <div className="text-slate-500 mt-0.5">So'nggi yozuv: {journalEntries[0]?.sana || "Yo'q"}</div>
                </div>
              </div>

              {/* Core metrics / averages */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-slate-950 uppercase tracking-wider border-b pb-1">Tibbiy Ko'rsatkichlar O'rtacha Qiymatlari</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="border border-slate-200 p-3 rounded-lg bg-white shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">O'rtacha qon bosimi</span>
                    <span className="font-black text-sm sm:text-base text-slate-800">
                      {journalEntries.length > 0
                        ? `${Math.round(journalEntries.reduce((sum, e) => sum + e.sistolik, 0) / journalEntries.length)} / ${Math.round(journalEntries.reduce((sum, e) => sum + e.diastolik, 0) / journalEntries.length)}`
                        : 'N/A'
                      } <span className="text-[10px] font-normal text-slate-500 font-sans">mmHg</span>
                    </span>
                  </div>
                  <div className="border border-slate-200 p-3 rounded-lg bg-white shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">O'rtacha Puls</span>
                    <span className="font-black text-sm sm:text-base text-slate-800">
                      {journalEntries.length > 0
                        ? Math.round(journalEntries.reduce((sum, e) => sum + e.puls, 0) / journalEntries.length)
                        : 'N/A'
                      } <span className="text-[10px] font-normal text-slate-500 font-sans">zarba/min</span>
                    </span>
                  </div>
                  <div className="border border-slate-200 p-3 rounded-lg bg-white shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Dori Qabul Intizomi</span>
                    <span className="font-black text-sm sm:text-base text-slate-800">
                      {(() => {
                        let totalMeds = 0;
                        let takenMeds = 0;
                        journalEntries.forEach(entry => {
                          entry.dorilar.forEach(d => {
                            totalMeds++;
                            if (d.ichildi) takenMeds++;
                          });
                        });
                        return totalMeds > 0 ? `${Math.round((takenMeds / totalMeds) * 100)}%` : 'N/A';
                      })()}
                    </span>
                  </div>
                  <div className="border border-slate-200 p-3 rounded-lg bg-white shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Ogohlantirishlar</span>
                    <span className="font-black text-sm sm:text-base text-amber-600">
                      {journalEntries.filter(e => e.sistolik >= 140 || e.diastolik >= 90 || e.alomatlar.length > 0).length} marotaba
                    </span>
                  </div>
                </div>
              </div>

              {/* Primary logs table */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-slate-955 uppercase tracking-wider border-b pb-1">Barcha qayd etilgan ma'lumotlar tarixi</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 text-slate-700 font-extrabold uppercase text-[9px] border-b border-slate-300">
                        <th className="py-2 px-3">Sana & Vaqt</th>
                        <th className="py-2 px-3">Qon bosimi</th>
                        <th className="py-2 px-3">Puls (/min)</th>
                        <th className="py-2 px-3">Shakar (mmol/l)</th>
                        <th className="py-2 px-3">Alomatlar</th>
                        <th className="py-2 px-3">Dorilar</th>
                        <th className="py-2 px-3">Izoh/Qaydlar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {journalEntries.map((e) => {
                        const alertState = e.sistolik >= 140 || e.diastolik >= 90 || e.alomatlar.length > 0;
                        return (
                          <tr key={e.id} className={`${alertState ? "bg-red-50/40" : "bg-white"} hover:bg-slate-50`}>
                            <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">{e.sana} ({e.vaqt})</td>
                            <td className="py-2.5 px-3">
                              <span className={`font-black text-xs sm:text-sm ${alertState ? 'text-red-700 font-extrabold' : 'text-slate-800'}`}>
                                {e.sistolik} / {e.diastolik} <span className="text-[9px] font-normal text-slate-400">mmHg</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold">{e.puls}</td>
                            <td className="py-2.5 px-3 font-mono">{e.glyukoza !== '' ? `${e.glyukoza}` : '—'}</td>
                            <td className="py-2.5 px-3">
                              {e.alomatlar.length > 0 ? (
                                <span className="bg-red-100 border border-red-200 text-red-800 font-extrabold text-[9px] px-1.5 py-0.5 rounded uppercase">
                                  {e.alomatlar.map(id => {
                                    if (id === 'ogriq') return "Ko'krak og'rig'i";
                                    if (id === 'nafas_qisilishi') return "Nafas qisilishi";
                                    if (id === 'bosh_aylanishi') return "Bosh aylanishi";
                                    if (id === 'yurak_oynashi') return "Yurak o'ynashi";
                                    return id;
                                  }).join(', ')}
                                </span>
                              ) : (
                                <span className="text-slate-400">Yo'q</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {e.dorilar.length > 0 ? (
                                <div className="space-y-0.5">
                                  {e.dorilar.map(d => (
                                    <div key={d.nomi} className="text-[10px] leading-tight flex items-center gap-1">
                                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${d.ichildi ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                      <span className={d.ichildi ? 'text-slate-700 font-semibold' : 'text-slate-450 line-through'}>{d.nomi}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 italic max-w-xs truncate" title={e.qaydlar}>{e.qaydlar || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Standard Disclaimers / Sign-off area */}
              <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-1 sm:grid-cols-2 gap-6 text-[10px] text-slate-550 leading-relaxed">
                <div>
                  <h4 className="font-extrabold text-slate-800 uppercase mb-1">{t("Yuridik ogohlantirish (Medical Disclaimer)", language)} / {t("DIAGNOSTIK BILDIRISHNOMA", language)}:</h4>
                  <p className="font-semibold text-slate-900 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1">
                    {t(APP_DISCLAIMER, language)}
                  </p>
                </div>
                <div className="flex flex-col justify-end items-end space-y-2 mt-4 sm:mt-0">
                  <div className="text-right">
                    <p className="font-extrabold text-slate-800">Sog'lom Yurak Akademik Platformasi</p>
                    <p className="text-[9px] text-slate-400 uppercase font-mono">Dasturiy tahlil kodi: 3d3c6054-VODIYa</p>
                  </div>
                  <div className="h-10 w-24 border border-dashed border-slate-300 rounded flex items-center justify-center p-1 text-[9px] text-slate-400 font-mono">
                    MUHR VA IMZO
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
      
      {/* DORINI TAHRIRLASH MODAL OYNASI */}
      {editingAlarm && (
        <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-indigo-950 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-400" />
                <h3 className="font-extrabold text-sm text-slate-50 uppercase">Eslatmani Tahrirlash</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAlarm(null)}
                className="text-slate-400 hover:text-white font-black text-2xl transition leading-none cursor-pointer"
                title="Yopish"
              >
                &times;
              </button>
            </div>

            {/* Modal Content / Form */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingAlarm.nomi.trim()) {
                  alert("Iltimos, dori nomini kiriting!");
                  return;
                }
                setMedAlarms(prev => prev.map(al => al.id === editingAlarm.id ? editingAlarm : al));
                setEditingAlarm(null);
                alert("Dori eslatmasi muvaffaqiyatli yangilandi!");
              }}
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                  Dori Vositasi Nomi
                </label>
                <input
                  type="text"
                  value={editingAlarm.nomi}
                  onChange={(e) => setEditingAlarm(prev => prev ? { ...prev, nomi: e.target.value } : null)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="masalan: Lozap, Enap"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                    Dozasi (Miqdori)
                  </label>
                  <input
                    type="text"
                    value={editingAlarm.doza}
                    onChange={(e) => setEditingAlarm(prev => prev ? { ...prev, doza: e.target.value } : null)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="masalan: 50 mg, 1 tabletka"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                    Ichish Vaqti
                  </label>
                  <input
                    type="time"
                    value={editingAlarm.vaqt}
                    onChange={(e) => setEditingAlarm(prev => prev ? { ...prev, vaqt: e.target.value } : null)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white text-slate-800 font-mono font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Status information warning */}
              <div className="bg-amber-50 rounded-lg border border-amber-100 p-3 flex gap-2.5 text-amber-900 leading-relaxed text-[10px] font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Eslatma tahrirlangandan so'ng, yangilangan dori nomi, miqdori va vaqtiga muvofiq o'zbekona push-alert xabarnomalari beriladi.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingAlarm(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-center cursor-pointer transition text-xs"
                >
                  Bekor Qilish
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-xl text-center cursor-pointer transition text-xs shadow"
                >
                  Saqlash ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* SIDEBAR NAVIGATION - Left persistent drawer in desktop */}
      <aside className="w-full lg:w-72 bg-[#f1f5f9] text-slate-800 flex-shrink-0 flex flex-col border-r border-[#cbd5e1] print:hidden shrink-0 pb-6">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500">
              <Heart className="w-4 h-4 fill-red-500 text-red-500" />
            </div>
            <span className="font-extrabold text-xs text-slate-800 truncate pr-1 max-w-[140px] uppercase">
              {APP_BRAND}
            </span>
          </div>
          <button className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition border border-slate-200">
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Navigation Tabs - VERTICAL LIST */}
        <nav className="flex-1 p-4 space-y-2.5 flex flex-col justify-start mt-2" aria-label="Tabs">
          <button
            onClick={() => { setActiveTab('screening'); }}
            className={`w-full text-left py-2.5 px-3.5 rounded-xl font-bold text-xs transition-all flex items-center gap-3 cursor-pointer ${
              activeTab === 'screening'
                ? 'bg-[#dbeafe] text-[#2563eb] shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <Activity className={`w-4 h-4 shrink-0 ${activeTab === 'screening' ? 'text-[#2563eb]' : 'text-slate-400'}`} />
            <span>{t("Salomatlik Skriningi", language)}</span>
          </button>

          <button
            onClick={() => { setActiveTab('history'); setHistoryViewId(null); }}
            className={`w-full text-left py-2.5 px-3.5 rounded-xl font-bold text-xs transition-all flex items-center gap-3 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#dbeafe] text-[#2563eb] shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <Clock className={`w-4 h-4 shrink-0 ${activeTab === 'history' ? 'text-[#2563eb]' : 'text-slate-400'}`} />
            <span>{t("Arxiv Tarixi", language)}</span>
            <span className="ml-auto text-[9px] bg-white border border-slate-200 text-slate-500 font-bold px-1.5 py-0.5 rounded-full font-mono shadow-sm shrink-0 min-w-[20px] text-center">
              {apiSurveys.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('journal'); }}
            className={`w-full text-left py-2.5 px-3.5 rounded-xl font-bold text-xs transition-all flex items-center gap-3 cursor-pointer ${
              activeTab === 'journal'
                ? 'bg-[#dbeafe] text-[#2563eb] shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <BookOpen className={`w-4 h-4 shrink-0 ${activeTab === 'journal' ? 'text-[#2563eb]' : 'text-slate-400'}`} />
            <span>{t("Salomatlik Kundaligi", language)}</span>
            <span className="ml-auto text-[9px] bg-white border border-slate-200 text-slate-500 font-bold px-1.5 py-0.5 rounded-full font-mono shadow-sm shrink-0 min-w-[20px] text-center">
              {journalEntries.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('advices'); }}
            className={`w-full text-left py-2.5 px-3.5 rounded-xl font-bold text-xs transition-all flex items-center gap-3 cursor-pointer ${
              activeTab === 'advices'
                ? 'bg-[#dbeafe] text-[#2563eb] shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <Award className={`w-4 h-4 shrink-0 ${activeTab === 'advices' ? 'text-[#2563eb]' : 'text-slate-400'}`} />
            <span>{t("Shifokor Maslahati", language)}</span>
            <span className="ml-auto text-[9px] bg-white border border-slate-200 text-slate-500 font-bold px-1.5 py-0.5 rounded-full font-mono shadow-sm shrink-0 min-w-[20px] text-center">
              {patientAdvices.length}
            </span>
          </button>
        </nav>

        {/* Persistent bottom disclaimer box */}
        <div className="p-3.5 mx-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 shadow-sm">
          <div className="flex items-center gap-1.5 text-amber-800 font-black text-[9px] uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>{t("Yuridik Ogohlantirish", language)}</span>
          </div>
          <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
            {t(APP_DISCLAIMER, language)}
          </p>
        </div>

      </aside>

      {/* MAIN CONTENT WORKSPACE AREA */}
      <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-6 overflow-y-auto bg-slate-50">

        {/* TOP HEADER BAR IN MAIN AREA */}
        <div className="flex flex-col sm:flex-row items-center justify-between pb-4 border-b border-slate-200 mb-6 gap-4 print:hidden">
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
            {APP_BRAND}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* Dynamic Alphabet Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setLanguage('lotin')}
                className={`px-3 py-1 text-[10px] rounded-lg font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  language === 'lotin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Lotin
              </button>
              <button
                type="button"
                onClick={() => setLanguage('kirill')}
                className={`px-3 py-1 text-[10px] rounded-lg font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  language === 'kirill'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Кирилл
              </button>
            </div>

            {/* Bemor Account Block (Pill design as screenshot) */}
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-200/80 shadow-sm">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center font-bold text-[10px] text-blue-600 uppercase shrink-0">
                {currentUser.ism.split(' ').map(n=>n[0]).slice(0, 1).join('') || "B"}
              </div>
              <div className="text-left min-w-[50px] leading-tight">
                <span className="block text-[7px] font-black text-[#2563eb] uppercase tracking-widest leading-none">Bemor</span>
                <span className="block font-bold text-[10px] text-slate-700 truncate max-w-[80px] mt-0.5">{currentUser.ism}</span>
              </div>
            </div>

            {/* Chiqish Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-extrabold text-xs rounded-xl shadow-sm cursor-pointer transition-all duration-150"
            >
              Chiqish
            </button>
          </div>
        </div>

        {/* PRINT BANNER & INFO CONTROLLER */}
        <div className="hidden print:block bg-white p-6 border-b-2 border-slate-950 mb-6 text-black">
          <div className="flex justify-between items-start border-b pb-4">
            <div>
              <h2 className="text-xl font-bold uppercase">{t("INTELLEKTUAL SALOMATLIK PORTALI - KARTASI", language)}</h2>
              <p className="text-xs">{t("Farg'ona viloyati XNIZ erta aniqlash va profilaktik yo'riqnomalar model tizimi", language)}</p>
              <p className="text-xs text-slate-500">{t("Dissertatsiya amaliy tadbiq etilish natijasi", language)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{t("Sana", language)}: {new Date().toLocaleDateString()}</p>
              <p className="text-xs text-slate-600">{t("Hudud", language)}: {formData.shaharTuman}</p>
            </div>
          </div>
          <div className="mt-3 bg-amber-50 p-3 rounded-lg border border-amber-300 text-xs text-amber-950">
            <b>{t("Yuridik ogohlantirish (Medical Disclaimer)", language)}:</b> {t(APP_DISCLAIMER, language)}
          </div>
        </div>

        {/* CORE WORKSPACE LIMITS CONTAINER */}
        <main className="max-w-7xl mx-auto px-4 mt-2">
        {errorMsg && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-4 rounded-r-lg mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Xatolik yuz berdi</p>
              <p className="text-sm">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* TAB 1: SCREENING & ASSESSMENT ENGINE */}
        {activeTab === 'screening' && (
          <div className="w-full space-y-6">
            
            {!riskResult ? (
              /* SCREENING INPUT STATE - FULL-WIDTH */
              <div className="space-y-6">
                
                {/* TWO CHANNEL SWITCHER CONTAINER (Wide full-page tabs switcher layout) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-1.5 flex gap-1 print:hidden">
                  <button
                    type="button"
                    onClick={() => setIntakeMode('corporate')}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs md:text-sm text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      intakeMode === 'corporate'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                    id="btn-intake-corporate"
                  >
                    <Building2 className="w-4 h-4 text-emerald-500" />
                    <span className="font-extrabold text-xs">{language === 'lotin' ? 'Xodimlar so‘rovnomasi' : 'Ходимлар сўровномаси'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIntakeMode('complaint')}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs md:text-sm text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      intakeMode === 'complaint'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                    id="btn-intake-complaint"
                  >
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span>{t("AI Erkin Shikoyat", language)}</span>
                  </button>
                </div>

                {/* CORPORATE SURVEY FORM */}
                {intakeMode === 'corporate' && currentUser && (
                  <>
                    <SurveyWizard
                      currentUser={currentUser}
                      language={language}
                      onComplete={handleSurveyComplete}
                    />
                    {lastSubmitResult && (
                      <div className="mt-6">
                        <SurveyReport
                          survey={lastSubmitResult.response}
                          tahlil={lastSubmitResult.tahlil}
                          user={currentUser}
                          language={language}
                          onUpdated={(r) => {
                            setLastSubmitResult(r);
                            setSelectedSurveyResult(r.response);
                          }}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* AI COMPLAINT INTAKE MODE */}
                {intakeMode === 'complaint' && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50/50 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                        <Sparkles className="w-5 h-5 animate-spin" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-slate-800 tracking-tight">
                          {t("AI Erkin Shikoyat Tahlili", language)}
                        </h3>
                        <p className="text-xs text-slate-500 font-semibold">
                          {t("Tabiiy tilni semantik tahlil qilish algoritmi", language)}
                        </p>
                      </div>
                    </div>

                    <div className="p-6 md:p-8 space-y-6">
                      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200/50">
                        <button type="button" className="font-bold text-xs uppercase tracking-wider text-blue-800 flex items-center gap-1 text-left w-full cursor-default">
                          <Sparkles className="w-3.5 h-3.5 shrink-0" />
                          {t("Tabiiy Tilni Semantik Tahlil Qilish (NLP)", language)}
                        </button>
                        <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                          {t("Siz o'z salomatligingiz bo'yicha his qilayotgan muammolar, charchoqlar, qon bosimi yoki odatlaringizni milliy so'zlar bilan erkin yozing (masalan, \"boshim tez-tez og'riydi, choyxonada ko'p osh yeymiz, qon bosimim 140 ga chiqadi\"). Sun'iy Intellekt buni tahlil qilib, so'rovnomadagi maydonlarni avtomatik to'ldiradi!", language)}
                        </p>
                      </div>

                      <form onSubmit={handleAnalyzeComplaint} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                            {t("Shikoyat va alomatlar matnini yozing", language)}
                          </label>
                          <textarea
                            rows={6}
                            value={complaintText}
                            onChange={(e) => setComplaintText(e.target.value)}
                            placeholder={t("Foydalanuvchi shikoyatini kiriting: masalan: Yoshi 54 da. Toshloq tumanidan. Bosh og'riydi va ko'krak qisib siqadi. Oxirgi marta qon bosimi 145/95 bo'lgan edi, sho'r ovqatlarni juda yaxshi ko'radi, nosvoy otadi...", language)}
                            className="w-full text-sm rounded-xl border border-slate-300 p-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-slate-50 focus:bg-white transition"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isAnalyzingComplaint || complaintText.trim().length < 5}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm cursor-pointer"
                          id="btn-submit-complaint"
                        >
                          {isAnalyzingComplaint ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              {t("AI Tahlil qilmoqda...", language)}
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-emerald-400 font-sans" />
                              {t("Matnni Semantik Tahlil Qilish →", language)}
                            </>
                          )}
                        </button>
                      </form>

                      {aiTextResult && (
                        <div className="p-5 border border-slate-200 rounded-xl bg-slate-50 space-y-4">
                          <div className="flex items-center justify-between border-b pb-2">
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {t("Matn Muvaffaqiyatli Tahlil qilindi", language)}
                            </span>
                            <span className="text-[10px] text-slate-500">Heuristic + Gemini AI</span>
                          </div>

                          <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                            {aiTextResult.tahlilMatni}
                          </p>

                          {aiTextResult.yanaMalumotKerakmi && (
                            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                              <h5 className="text-[11px] font-bold text-amber-900 uppercase">{t("Qo'shimcha ma'lumotlar zarur:", language)}</h5>
                              <ul className="list-disc pl-4 text-[11px] text-amber-800 space-y-1 mt-1">
                                {aiTextResult.aniqlashtiruvchiSavollar.map((q, idx) => (
                                  <li key={idx}>{q}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="pt-2">
                            <h5 className="text-xs font-bold text-slate-800 mb-1">{t("Dastlabki maslahatlar:", language)}</h5>
                            <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
                              {aiTextResult.tavsiyalar.map((t, idx) => (
                                <li key={idx}>{t}</li>
                              ))}
                            </ul>
                          </div>

                          <button
                            type="button"
                            onClick={applyExtractedParamsAndCalculate}
                            className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            {t("Tahlil maydonlariga o'tkazish & Riskni Hisoblash", language)} <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STANDARD INTAKE MODEL FORM */}
                {intakeMode === 'standard' && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    
                    {/* Header bar matching user's screenshot layout */}
                    <div className="p-5 md:p-6 border-b border-slate-150 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base text-slate-800 tracking-tight">
                            {t("Anketa", language)}
                          </h3>
                          <p className="text-xs text-slate-500 font-semibold mt-0.5">
                            {t("Umumiy sog'lom turmush tarzi so'rovnomasi", language)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-xs font-black text-slate-700">
                            {t("Javoblar", language)}: {
                              [
                                formData.yosh, formData.boy, formData.vazn,
                                formData.sistolik, formData.diastolik,
                                formData.glyukoza !== '', formData.xolesterin !== '',
                                formData.tuzIstemi, formData.shakarVaXamir,
                                formData.jismoniyFaollik, formData.chekish,
                                formData.nosvoy, formData.oiladaKasallik.length > 0
                              ].filter(Boolean).length
                            } / 12
                          </div>
                          <span className="text-[10px] text-slate-400 font-extrabold">{t("Bo'lim 1 / 13", language)}</span>
                        </div>
                        {/* Dot array indicator and percent indicator */}
                        <div className="flex items-center gap-1.5">
                          {Array.from({ length: 12 }).map((_, i) => {
                            const val = [
                              formData.yosh, formData.boy, formData.vazn,
                              formData.sistolik, formData.diastolik,
                              formData.glyukoza !== '', formData.xolesterin !== '',
                              formData.tuzIstemi, formData.shakarVaXamir,
                              formData.jismoniyFaollik, formData.chekish,
                              formData.nosvoy, formData.oiladaKasallik.length > 0
                            ].filter(Boolean).length;
                            return (
                              <div
                                key={i}
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                  i < val ? 'bg-blue-600 scale-110 shadow-sm' : 'bg-slate-200'
                                }`}
                              />
                            );
                          })}
                          <span className="text-[10px] font-black text-blue-600 ml-1">
                            {Math.round(([
                              formData.yosh, formData.boy, formData.vazn,
                              formData.sistolik, formData.diastolik,
                              formData.glyukoza !== '', formData.xolesterin !== '',
                              formData.tuzIstemi, formData.shakarVaXamir,
                              formData.jismoniyFaollik, formData.chekish,
                              formData.nosvoy, formData.oiladaKasallik.length > 0
                            ].filter(Boolean).length / 12) * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleCalculateRisk} className="p-6 md:p-8 space-y-8">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* CARD 1: JINSI */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-blue-300/60 transition-all shadow-sm flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 font-mono">
                                1
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-800">
                                {t("Jinsingiz", language)}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">
                              {t("Farg'ona aholisi kardiologik risk ko'rsatkichlari jinsga ko'ra sezilarli farqlanadi.", language)}
                            </p>
                          </div>
                          <div className="flex gap-4 pt-1">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, jins: 'erkak' })}
                              className={`flex-1 py-3 px-5 rounded-xl border font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                formData.jins === 'erkak'
                                  ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-sm ring-1 ring-blue-600'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                              }`}
                            >
                              <User className="w-4 h-4 text-blue-600" />
                              {t("Erkak", language)}
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, jins: 'ayol' })}
                              className={`flex-1 py-3 px-5 rounded-xl border font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                formData.jins === 'ayol'
                                  ? 'bg-pink-50/50 border-pink-500 text-pink-700 shadow-sm ring-1 ring-pink-500'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                              }`}
                            >
                              <User className="w-4 h-4 text-pink-500" />
                              {t("Ayol", language)}
                            </button>
                          </div>
                        </div>

                        {/* CARD 2: YOSH */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-blue-300/60 transition-all shadow-sm flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 font-mono">
                                2
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-800">
                                {t("Yoshingiz", language)}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">
                              {t("Erta kardiologik xavfli guruhlar 35 yoshdan yuqorida kuchaya boshlaydi.", language)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <div className="relative flex-1">
                              <input
                                type="number"
                                min="15"
                                max="110"
                                required
                                value={formData.yosh}
                                onChange={(e) => setFormData({ ...formData, yosh: parseInt(e.target.value) || 35 })}
                                className="w-full text-sm font-bold rounded-xl border border-slate-300 p-3 pl-4 pr-16 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase tracking-wider">{t("yosh", language)}</span>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, yosh: Math.min(110, formData.yosh + 1) })}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 text-xs font-bold cursor-pointer transition"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, yosh: Math.max(15, formData.yosh - 1) })}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 text-xs font-bold cursor-pointer transition"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* CARD 3: BO'YI */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-blue-300/60 transition-all shadow-sm flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 font-mono">
                                3
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-800">
                                {t("Bo'yingiz", language)} (sm)
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">
                              {t("Tana vazni indeksi (TMI) hisoblash uchun bo'y o'lchovi zarur.", language)}
                            </p>
                          </div>
                          <div className="relative pt-1">
                            <input
                              type="number"
                              min="100"
                              max="230"
                              required
                              value={formData.boy}
                              onChange={(e) => setFormData({ ...formData, boy: parseInt(e.target.value) || 170 })}
                              className="w-full text-sm font-bold rounded-xl border border-slate-300 p-3 pr-16 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase mt-0.5">sm</span>
                          </div>
                        </div>

                        {/* CARD 4: VAZNI */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-blue-300/60 transition-all shadow-sm flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 font-mono">
                                4
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-800">
                                {t("Vazningiz", language)} (kg)
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">
                              {t("Ortiqcha vazn va semizlik kardiologik patologiyaning asosiy katalizatoridir.", language)}
                            </p>
                          </div>
                          <div className="relative pt-1">
                            <input
                              type="number"
                              min="30"
                              max="250"
                              required
                              value={formData.vazn}
                              onChange={(e) => setFormData({ ...formData, vazn: parseInt(e.target.value) || 70 })}
                              className="w-full text-sm font-bold rounded-xl border border-slate-300 p-3 pr-16 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase mt-0.5">kg</span>
                          </div>
                        </div>

                        {/* CARD 5: HUDUD */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-blue-300/60 transition-all shadow-sm flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 font-mono">
                                5
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-800">
                                {t("Yashash hududingiz", language)}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">
                              {t("Farg'ona viloyati hududlari bo'yicha endemik kardiologik korrelyatsiyalar integratsiyasi.", language)}
                            </p>
                          </div>
                          <div className="relative pt-1">
                            <select
                              value={formData.shaharTuman}
                              onChange={(e) => setFormData({ ...formData, shaharTuman: e.target.value })}
                              className="w-full text-sm font-bold rounded-xl border border-slate-300 p-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition appearance-none cursor-pointer"
                            >
                              {FERGANA_REGIONS.map((reg) => (
                                <option key={reg} value={reg}>{reg}</option>
                              ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                              ▼
                            </div>
                          </div>
                        </div>

                        {/* CARD 6: ARTERIAL BOSIM */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-blue-300/60 transition-all shadow-sm flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 font-mono">
                                6
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-800">
                                {t("Arterial Qon Bosimi", language)} (mmHg)
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">
                              {t("Xalqaro miqyosda sistolik 140 dan, diastolik 90 dan oshganda xavf keskin ortadi.", language)}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-3 pt-1">
                            <div className="relative">
                              <input
                                type="number"
                                min="80"
                                max="240"
                                required
                                value={formData.sistolik}
                                onChange={(e) => setFormData({ ...formData, sistolik: parseInt(e.target.value) || 120 })}
                                className="w-full text-sm font-bold rounded-xl border border-slate-300 p-2.5 pr-10 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">SYS</span>
                            </div>
                            <div className="relative">
                              <input
                                type="number"
                                min="40"
                                max="140"
                                required
                                value={formData.diastolik}
                                onChange={(e) => setFormData({ ...formData, diastolik: parseInt(e.target.value) || 80 })}
                                className="w-full text-sm font-bold rounded-xl border border-slate-300 p-2.5 pr-10 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">DIA</span>
                            </div>
                          </div>
                        </div>

                        {/* CARD 7: QONDAGI GLYUKOZA */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-blue-300/60 transition-all shadow-sm flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 font-mono">
                                7
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-800">
                                {t("Qondagi Glyukoza", language)} (mmol/l)
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">
                              {t("Diabetik patologiyalarni tahlil qilish uchun ixtiyoriy ko'rsatkich.", language)}
                            </p>
                          </div>
                          <div className="relative pt-1">
                            <input
                              type="number"
                              step="0.1"
                              min="1.0"
                              max="30.0"
                              placeholder={t("Ixtiyoriy (masalan: 5.2)", language)}
                              value={formData.glyukoza}
                              onChange={(e) => setFormData({ ...formData, glyukoza: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                              className="w-full text-sm font-bold rounded-xl border border-slate-300 p-3 pr-14 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 mt-0.5">mmol</span>
                          </div>
                        </div>

                        {/* CARD 8: XOLESTERIN */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-blue-300/60 transition-all shadow-sm flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 font-mono">
                                8
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-800">
                                {t("Umumiy Xolesterin", language)} (mmol/l)
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">
                              {t("Aterosklerotik va tomir tiqilish risklarini tahlillash uchun muhim ko'rsatkich.", language)}
                            </p>
                          </div>
                          <div className="relative pt-1">
                            <input
                              type="number"
                              step="0.1"
                              min="1.0"
                              max="20.0"
                              placeholder={t("Ixtiyoriy (masalan: 4.8)", language)}
                              value={formData.xolesterin}
                              onChange={(e) => setFormData({ ...formData, xolesterin: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                              className="w-full text-sm font-bold rounded-xl border border-slate-300 p-3 pr-14 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 mt-0.5">mmol</span>
                          </div>
                        </div>

                        {/* CARD 9: TUZ ISTEMOLI */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-blue-300/60 transition-all shadow-sm flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 font-mono">
                                9
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-800">
                                {t("Tuz va sho'r ovqatlar ist'emoli", language)}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">
                              {t("Sho'r taomlar va doimiy tuz namakoni qon bosimini orttishida kritik omildir.", language)}
                            </p>
                          </div>
                          <div className="relative pt-1">
                            <select
                              value={formData.tuzIstemi}
                              onChange={(e) => setFormData({ ...formData, tuzIstemi: e.target.value as 'past' | 'ortacha' | 'yuqori' })}
                              className="w-full text-xs font-bold rounded-xl border border-slate-300 p-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition appearance-none cursor-pointer"
                            >
                              <option value="past">{t("Kam tuzli (Tuz qo'shmaydi)", language)}</option>
                              <option value="ortacha">{t("O'rtacha me'yorda", language)}</option>
                              <option value="yuqori">{t("Sho'r, doimiy qo'shimcha tuz soladi (Yuqori xavf)", language)}</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                              ▼
                            </div>
                          </div>
                        </div>

                        {/* CARD 10: SHAKAR VA XAMIR */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-blue-300/60 transition-all shadow-sm flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 font-mono">
                                10
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-800">
                                {t("Xamir taomlar va uglevodlar", language)}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">
                              {t("Oq non, shirinliklar, guruch va xamirli vodiycha menyu metabolizmni buzishi mumkin.", language)}
                            </p>
                          </div>
                          <div className="relative pt-1">
                            <select
                              value={formData.shakarVaXamir}
                              onChange={(e) => setFormData({ ...formData, shakarVaXamir: e.target.value as 'kam' | 'ortacha' | 'kop' })}
                              className="w-full text-xs font-bold rounded-xl border border-slate-300 p-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition appearance-none cursor-pointer"
                            >
                              <option value="kam">{t("Kamroq (xamir va konfet minimal)", language)}</option>
                              <option value="ortacha">{t("O'rtacha vodiycha parhezda (non, choyxona oshi)", language)}</option>
                              <option value="kop">{t("Ko'p (shakarli choylar, xamir taomlar, oq non)", language)}</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                              ▼
                            </div>
                          </div>
                        </div>

                        {/* CARD 11: JISMONIY FAOLLIK */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-blue-300/60 transition-all shadow-sm flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 font-mono">
                                11
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-800">
                                {t("Jismoniy faollik", language)}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">
                              {t("Gipodinamiya va kam harakatlilik kardiologik klirensni keskin kamaytiradi.", language)}
                            </p>
                          </div>
                          <div className="relative pt-1">
                            <select
                              value={formData.jismoniyFaollik}
                              onChange={(e) => setFormData({ ...formData, jismoniyFaollik: e.target.value as 'kam' | 'ortacha' | 'yuqori' })}
                              className="w-full text-xs font-bold rounded-xl border border-slate-300 p-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition appearance-none cursor-pointer"
                            >
                              <option value="kam">{t("Kam (asosan o'tirib ishlaydi/gipodinamiya)", language)}</option>
                              <option value="ortacha">{t("O'rtacha (har kuni bir oz yuradi)", language)}</option>
                              <option value="yuqori">{t("Faol (jadal sport, uzoq jismoniy mehnat)", language)}</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                              ▼
                            </div>
                          </div>
                        </div>

                        {/* CARD 12: CHEKISH */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-blue-300/60 transition-all shadow-sm flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 font-mono">
                                12
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-800">
                                {t("Chekish odati", language)}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">
                              {t("Tamaki mahsulotlari ichki qon-tomir elastikligini yemirib, tromblar hosil qiladi.", language)}
                            </p>
                          </div>
                          <div className="relative pt-1">
                            <select
                              value={formData.chekish}
                              onChange={(e) => setFormData({ ...formData, chekish: e.target.value as 'yoq' | 'chekar_edi' | 'ha' })}
                              className="w-full text-xs font-bold rounded-xl border border-slate-300 p-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition appearance-none cursor-pointer"
                            >
                              <option value="yoq">{t("Hech qachon", language)}</option>
                              <option value="chekar_edi">{t("Tashlagan", language)}</option>
                              <option value="ha">{t("Faol chekuvchi", language)}</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                              ▼
                            </div>
                          </div>
                        </div>

                        {/* CARD 13: NOSVOY */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-blue-300/60 transition-all shadow-sm flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 font-mono">
                                13
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-800">
                                {t("Nosvoy chekish (tashlash)", language)}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">
                              {t("Farg'ona vodiysida nosvoy kardiologik bosimga o'ta kuchli ta'sir qiluvchi xususiy omildir.", language)}
                            </p>
                          </div>
                          <div className="relative pt-1">
                            <select
                              value={formData.nosvoy}
                              onChange={(e) => setFormData({ ...formData, nosvoy: e.target.value as 'yoq' | 'ha' })}
                              className="w-full text-xs font-bold rounded-xl border border-slate-300 p-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition appearance-none cursor-pointer"
                            >
                              <option value="yoq">{t("Yo'q", language)}</option>
                              <option value="ha">{t("Ha (O'ta faol)", language)}</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                              ▼
                            </div>
                          </div>
                        </div>

                        {/* CARD 14: NASLIY MOYILLIK */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-blue-300/60 transition-all shadow-sm flex flex-col justify-between md:col-span-2">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 font-mono">
                                14
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-800">
                                {t("Oilangizda dori yo patologik nasliy moyilliklar", language)}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-normal">
                              {t("Oilangizdagi yaqin qarindoshlaringizda kuzatilgan arterial va metabolik patologiyalarni belgilang.", language)}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs text-left">
                            {AVAILABLE_DISEASES.map((dis) => (
                              <label key={dis.id} className="flex items-center gap-1.5 cursor-pointer bg-slate-50 p-2 rounded-xl border border-slate-150 hover:bg-slate-100Select transition select-none">
                                <input
                                  type="checkbox"
                                  checked={formData.oiladaKasallik.includes(dis.id)}
                                  onChange={() => handleDiseaseCheck(dis.id)}
                                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                                <span className="font-bold text-slate-600">{t(dis.label, language)}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                      </div>

                      {/* SECTION 15: Sun'iy Intellekt Erkin Shikoyat Qismi inside standard form */}
                      <div className="bg-blue-50/20 p-6 rounded-2xl border border-blue-100 space-y-3 mt-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">
                            ✍️
                          </div>
                          <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                            {t("Shaxsiy erkin shikoyat va bezovtaliklar (AI tahlili uchun)", language)}
                          </h4>
                        </div>
                        <div className="text-xs space-y-2 text-left">
                          <label className="block font-semibold text-slate-600 leading-normal">
                            {t("Sizda qanday jismoniy, asabiy yoki kardiologik bezovtaliklar yoki dori ta'sirlari bor? Shifokor va AI bularni tizimli tahlil qiladi.", language)}
                          </label>
                          <textarea
                            rows={3}
                            placeholder={t("Masalan: Boshim va vaqti-vaqti bilan ensa soham qattiq og'riyapti, nafas olganimda ko'kragim siqilyapti, kechalari uyqum yaxshi emas...", language)}
                            value={formData.erkinShikoyat || ''}
                            onChange={(e) => setFormData({ ...formData, erkinShikoyat: e.target.value })}
                            className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:ring-2 focus:ring-blue-500 focus:outline-[#3b82f6] transition shadow-sm bg-white font-medium"
                          />
                        </div>
                      </div>

                      {/* SUBMIT BUTTON */}
                      <button
                        type="submit"
                        disabled={isCalculatingRisk}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-4 px-6 rounded-2xl shadow-lg text-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
                        id="btn-calculate-risk"
                      >
                        {isCalculatingRisk ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            {t("Hisoblanmoqda...", language)}
                          </>
                        ) : (
                          <>
                            <Heart className="w-5 h-5 text-red-100 animate-pulse" />
                            {t("SALOMATLIKNI VA AI RISKINI BAHOLASH →", language)}
                          </>
                        )}
                      </button>

                    </form>
                  </div>
                )}
                
                {/* REGIONAL GINI & STATS AT THE BOTTOM OF THE INTAKE INSTEAD OF STRIP */}
                <div className="bg-slate-900 text-slate-300 p-6 md:p-8 rounded-2xl border border-slate-800 space-y-4">
                  <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                    <Globe className="w-4 h-4 text-teal-400" />
                    {t("Regional Gini ko'rsatkichlari & Somatik Skrining Modellari", language)}
                  </h4>
                  <p className="text-xs leading-relaxed text-slate-400 font-medium">
                    {t("Ushbu tizim Farg'ona vodiysi hududidagi poliklinikalar, tibbiy ko'rik jarayonlari va pedagog xodimlarning somatik tahlillari asosida optimallashtirilgan ilmiy-tashkiliy algoritmlar bo'yicha integratsiya qilingan.", language)}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 text-xs">
                    <div className="border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-500 block uppercase text-[10px] tracking-wider font-extrabold">O'rtacha tizimli xato:</span>
                      <span className="text-emerald-400 font-extrabold text-sm font-mono">~0.08 (Model Gini)</span>
                    </div>
                    <div className="border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-500 block uppercase text-[10px] tracking-wider font-extrabold">Skrining etalon bosim:</span>
                      <span className="text-emerald-400 font-extrabold text-sm font-mono">120/80 mmHg</span>
                    </div>
                    <div className="border border-slate-800 p-4 rounded-xl space-y-1">
                      <span className="text-slate-500 block uppercase text-[10px] tracking-wider font-extrabold">Model isbot kuchi (R):</span>
                      <span className="text-emerald-400 font-extrabold text-sm font-mono">0.89 (Random Forest)</span>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              /* ACTIVE OUTCOME RESULTS SHOWN FULL WIDTH */
              <div className="space-y-6">
                
                {/* BACK BUTTON TO INTAKE */}
                <button
                  type="button"
                  onClick={() => setRiskResult(null)}
                  className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-black rounded-xl border border-slate-200 shadow-sm transition-all flex items-center gap-2 cursor-pointer print:hidden"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-500" />
                  {t("Orqaga (Anketa ma'lumotlarini o'zgartirish)", language)}
                </button>

                {/* THE RESULTS LAYOUT */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                  
                  {/* Left Column: Read-only summary of patient inputs so it's transparent! */}
                  <div className="xl:col-span-4 space-y-6 print:hidden">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                        <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">{t("Kiritilgan ko'rsatkichlar", language)}</h4>
                        <h3 className="text-base font-black text-slate-800 tracking-tight mt-0.5">{t("Anketa Xulosasi", language)}</h3>
                      </div>
                      <div className="p-5 space-y-3 text-xs">
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-semibold">{t("Jinsi", language)}:</span>
                          <span className="font-extrabold text-slate-800">{formData.jins === 'erkak' ? t("Erkak", language) : t("Ayol", language)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-semibold">{t("Yoshingiz", language)}:</span>
                          <span className="font-extrabold text-slate-800">{formData.yosh} {t("yosh", language)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-semibold">{t("Bo'yi & Vazni", language)}:</span>
                          <span className="font-extrabold text-slate-800">{formData.boy} sm / {formData.vazn} kg</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-semibold">{t("Qon bosimi", language)}:</span>
                          <span className="font-extrabold text-red-600 font-sans">{formData.sistolik}/{formData.diastolik} mmHg</span>
                        </div>
                        {formData.glyukoza && (
                          <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                            <span className="text-slate-500 font-semibold">{t("Qondagi glyukoza", language)}:</span>
                            <span className="font-extrabold text-slate-800">{formData.glyukoza} mmol/l</span>
                          </div>
                        )}
                        {formData.xolesterin && (
                          <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                            <span className="text-slate-500 font-semibold">{t("Umumiy xolesterin", language)}:</span>
                            <span className="font-extrabold text-slate-800">{formData.xolesterin} mmol/l</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-semibold">{t("Tuz ist'emoli", language)}:</span>
                          <span className="font-extrabold text-slate-800">
                            {formData.tuzIstemi === 'past' ? t("Kam tuzli", language) : (formData.tuzIstemi === 'ortacha' ? t("O'rtacha", language) : t("Yuqori sho'r", language))}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-semibold">{t("Jismoniy faollik", language)}:</span>
                          <span className="font-extrabold text-slate-800">
                            {formData.jismoniyFaollik === 'kam' ? t("Kam (Gipodinamiya)", language) : (formData.jismoniyFaollik === 'ortacha' ? t("O'rtacha", language) : t("Yuqori jismoniy faol", language))}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-semibold">{t("Chekish & Nosvoy", language)}:</span>
                          <span className="font-extrabold text-slate-800">
                            {formData.chekish === 'ha' ? t("Faol chekuvchi", language) : t("Chekmaydi", language)} / {formData.nosvoy === 'ha' ? t("Nosvoy otadi", language) : t("Nosvoy otmaydi", language)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1.5">
                          <span className="text-slate-500 font-semibold">{t("Hududingiz", language)}:</span>
                          <span className="font-extrabold text-slate-800">{formData.shaharTuman}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Original results outputs and recommendations! */}
                  <div className="xl:col-span-8 space-y-6">
                    <div className="space-y-6">
                  
                  {/* TRAFFIC LIGHT & KEY METRICS HERO */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
                    
                    {/* Top zone band */}
                    <div className={`h-3 w-full ${
                      riskResult.zona === 'yashil' ? 'bg-emerald-500' : (riskResult.zona === 'sariq' ? 'bg-amber-500' : 'bg-red-500')
                    }`} />

                    <div className="p-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold uppercase">
                              Skrining ID: #{Math.floor(riskResult.tmi * 1354)}
                            </span>
                            <span className="text-[10px] text-slate-500">Fergana Population Index</span>
                          </div>
                          <h2 className="text-2xl font-black text-slate-900 mt-1">Sizning Salomatlik Risk Hisobotingiz</h2>
                        </div>
                        
                        <button
                          onClick={printReport}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 transition-all flex items-center gap-1.5 hidden sm:flex shrink-0 print:hidden"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Chop etish / PDF yuklash
                        </button>
                      </div>

                      {/* Score Board Layout */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6 items-center">
                        
                        {/* Dynamic risk percentage wheel */}
                        <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-150 relative">
                          
                          {/* Semicircle display mock */}
                          <div className="relative w-36 h-36 flex items-center justify-center">
                            
                            {/* Radial background representing traffic zones */}
                            <svg className="w-full h-full transform -rotate-90">
                              <circle
                                cx="72"
                                cy="72"
                                r="55"
                                stroke="#f1f5f9"
                                strokeWidth="12"
                                fill="transparent"
                              />
                              <circle
                                cx="72"
                                cy="72"
                                r="55"
                                stroke={riskResult.zona === 'yashil' ? '#10b981' : (riskResult.zona === 'sariq' ? '#f59e0b' : '#ef4444')}
                                strokeWidth="12"
                                fill="transparent"
                                strokeDasharray={345}
                                strokeDashoffset={345 - (345 * riskResult.riskFoizi) / 100}
                                strokeLinecap="round"
                              />
                            </svg>

                            <div className="absolute text-center">
                              <span className="text-4xl font-extrabold tracking-tight text-slate-900">{riskResult.riskFoizi}%</span>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Xavf Darajasi</p>
                            </div>
                          </div>

                          <div className={`mt-3 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest text-center ${
                            riskResult.zona === 'yashil' 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                              : (riskResult.zona === 'sariq' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-red-100 text-red-800 border border-red-300')
                          }`}>
                            {riskResult.zona === 'yashil' ? 'Yashil Zona' : (riskResult.zona === 'sariq' ? 'Sariq Zona' : 'Qizil Zona')}
                          </div>
                        </div>

                        {/* Text summary & BMI status */}
                        <div className="md:col-span-8 space-y-4">
                          <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Shifokor-Profilaktika Klinikasining Xulosasi</span>
                            <p className="text-sm font-semibold text-slate-900 mt-1.5 leading-relaxed">
                              {riskResult.klinikXulosa}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="bg-slate-100 p-2.5 rounded-lg">
                              <span className="text-slate-500 uppercase text-[9px] font-bold">Sizning TMI ko'rsatkichingiz</span>
                              <p className="text-base font-extrabold text-slate-800 mt-0.5">{riskResult.tmi.toFixed(1)} kg/m²</p>
                              <span className="text-[10px] text-indigo-700 font-medium">{riskResult.tmiKategoriya}</span>
                            </div>
                            <div className="bg-slate-100 p-2.5 rounded-lg flex flex-col justify-between">
                              <div>
                                <span className="text-slate-500 uppercase text-[9px] font-bold">Farg'ona Aholi Statistikasi</span>
                                <p className="text-sm font-extrabold text-slate-800 mt-0.5">Xavf darajasi: {riskResult.hududiyStatistika.hududXavfi}%</p>
                              </div>
                              <span className="text-[9px] text-slate-500">Me'yor: &lt; 30%</span>
                            </div>
                          </div>
                        </div>

                      </div>

                    </div>
                  </div>

                  <DiseaseRiskPrognosis
                    input={{
                      riskFoizi: riskResult.riskFoizi,
                      tmi: riskResult.tmi,
                      sistolik: formData.sistolik,
                      diastolik: formData.diastolik,
                      glyukoza: formData.glyukoza !== '' ? Number(formData.glyukoza) : undefined,
                      chekish: formData.chekish === 'ha',
                      yosh: formData.yosh,
                      jins: formData.jins,
                    }}
                  />

                  {/* CLINICAL COMPLIANCE ANALYSIS (INNOVATION 4 DETAILED REPORT) */}
                  {riskResult.shaxsiyTavsiyalar.komplayensTahlili.nomutanosiblikKuzatildimi && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-300 shadow-sm relative overflow-hidden">
                      <div className="absolute right-0 top-0 transform translate-x-3 -translate-y-3 bg-amber-500 text-white font-mono font-bold text-[9px] px-3 py-1 rounded-full uppercase tracking-wider">
                        Pedagog-Somatik Ziddiyat
                      </div>
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-extrabold text-xs uppercase tracking-wider text-amber-900">
                            Tibbiyot pedagog va shifokorlar uchun Komplayens tahlili (4-Yangilik)
                          </h4>
                          <p className="text-sm text-amber-950 font-bold mt-1.5 leading-relaxed bg-white/60 p-3 rounded border border-amber-200">
                            {riskResult.shaxsiyTavsiyalar.komplayensTahlili.maslahat}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FACTOR GINI BAR DIAGRAM (Gini Importance & Dynamic Features) */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <div className="border-b pb-3 flex items-center justify-between">
                      <div>
                        <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-900">Tahlil qilingan xavf omillari (Gini ahamiyati)</h3>
                        <p className="text-xs text-slate-500">Har bir omilning kasallik rivojlanishidagi nisbiy ta'sir koeffitsiyenti (0 - 10)</p>
                      </div>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-mono font-bold">100 pretsedent</span>
                    </div>

                    <div className="space-y-3.5">
                      {riskResult.faktorlar.map((factor, index) => (
                        <div key={index} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-800">{factor.nomi}</span>
                            <div className="flex items-center gap-1.5">
                              {factor.boshqariladimi ? (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded-full font-semibold uppercase tracking-wider">Boshqariladigan omil</span>
                              ) : (
                                <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded-full font-semibold uppercase tracking-wider">Nasliy omil</span>
                              )}
                              <span className="font-mono font-black text-slate-900">{factor.tasirKuchi.toFixed(1)} / 10</span>
                            </div>
                          </div>
                          
                          {/* Elegant HTML dynamic progress bar */}
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden relative border border-slate-200/50">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${
                                factor.tasirKuchi >= 7.5 ? 'bg-red-500' : (factor.tasirKuchi >= 5 ? 'bg-amber-500' : 'bg-emerald-500')
                              }`} 
                              style={{ width: `${factor.tasirKuchi * 10}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-slate-500 italic mt-0.5">{factor.tafsilot}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SHAXSIYLASHTIRILGAN PROFILAKTIK MASLAHAT QURILMASI */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
                    <div className="border-b pb-3">
                      <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <CheckCircle className="w-4.5 h-4.5 text-emerald-600" />
                        Shaxsiylashtirilgan tibbiy-profilaktik va parhez rejasi
                      </h3>
                      <p className="text-xs text-slate-500">Fergana Valley nutritiv mezonlari (3-ilmiy yangilik) asosidagi tavsiyalar to'plami</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Ovqatlanish & Jismoniy parhez */}
                      <div className="space-y-4">
                        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
                          <h4 className="text-xs font-extrabold uppercase text-emerald-900 tracking-wider mb-2">Nutritiv & Parhez (Tuz/Yog'/Non)</h4>
                          <ul className="space-y-2.5 text-xs text-emerald-950">
                            {riskResult.shaxsiyTavsiyalar.ovqatlanish.map((o, idx) => (
                              <li key={idx} className="flex gap-1.5 items-start">
                                <span className="text-emerald-600 shrink-0 font-bold">•</span>
                                <span>{o}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200">
                          <h4 className="text-xs font-extrabold uppercase text-indigo-900 tracking-wider mb-2">Jismoniy harakat va kardiomashqlar</h4>
                          <ul className="space-y-2.5 text-xs text-indigo-950">
                            {riskResult.shaxsiyTavsiyalar.jismoniyMashq.map((jm, idx) => (
                              <li key={idx} className="flex gap-1.5 items-start">
                                <span className="text-indigo-600 shrink-0 font-bold">•</span>
                                <span>{jm}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Tibbiy nazorat, Dori-darmon & Monitoring */}
                      <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <h4 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider mb-2">Klinik tekshiruvlar va uchrashuv rejasi</h4>
                          <ul className="space-y-2.5 text-xs text-slate-700">
                            {riskResult.shaxsiyTavsiyalar.tibbiyReja.map((tr, idx) => (
                              <li key={idx} className="flex gap-1.5 items-start">
                                <span className="text-indigo-600 shrink-0 font-bold">✓</span>
                                <span>{tr}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* NEXT RE-SCREENING CARD */}
                        <div className="bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-teal-400 font-bold uppercase tracking-widest">Keyingi profilaktik ko'rik</span>
                            <p className="text-lg font-black mt-0.5">{riskResult.hududiyStatistika.tavsiyaEtilganSkriningKuni}</p>
                            <p className="text-[10px] text-slate-400">Yarim yillik kardiomonitoring majburiyati</p>
                          </div>
                          <Clock className="w-10 h-10 text-teal-400 opacity-80" />
                        </div>
                      </div>

                    </div>

                    {/* INTERACTIVE WHAT-IF RISK ELIMINATION CALCULATOR - Dissertation Outcome */}
                    <div className="bg-slate-100 p-5 rounded-xl border border-slate-200/80 space-y-4 print:hidden">
                      <div className="border-b pb-2">
                        <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold uppercase shrink-0">Dissertatsiya Amaliyoti</span>
                        <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider mt-1">
                          Interaktiv Harakatlarni Prognozlash Simulyatori ("Nima Bo'lardi-Agar" model)
                        </h4>
                        <p className="text-xs text-slate-500">
                          Hayot tarzingizdagi boshqariladigan omillarni dinamik tarzda o'zgartiring va oilaviy o'rtacha xavf ehtimolingiz o'yinda qanchaga kamayishini darhol ko'ring!
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        
                        {/* Sim 1: Lose weight if obese */}
                        {formData.vazn >= 78 && (
                          <div className="bg-white p-2.5 rounded border border-slate-200">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Vaznni kamaytirish</label>
                            <select
                              value={simulatedWeight !== null ? simulatedWeight : formData.vazn}
                              onChange={(e) => setSimulatedWeight(Number(e.target.value))}
                              className="w-full text-xs rounded border border-slate-300 p-1"
                            >
                              <option value={formData.vazn}>Hozirgi ({formData.vazn} kg)</option>
                              <option value={formData.vazn - 5}>5 kg kamaytirilsa</option>
                              <option value={formData.vazn - 10}>10 kg kamaytirilsa</option>
                              <option value={formData.vazn - 15}>15 kg kamaytirilsa</option>
                            </select>
                          </div>
                        )}

                        {/* Sim 2: Salt custom reduction */}
                        <div className="bg-white p-2.5 rounded border border-slate-200">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Tuz Ist'emoli</label>
                          <select
                            value={simulatedSalt !== null ? simulatedSalt : formData.tuzIstemi}
                            onChange={(e) => setSimulatedSalt(e.target.value as 'past' | 'ortacha' | 'yuqori')}
                            className="w-full text-xs rounded border border-slate-300 p-1"
                          >
                            <option value="yuqori">Sho'r (Yuqori xavf)</option>
                            <option value="ortacha">O'rtacha me'yor</option>
                            <option value="past">Kam tuz (Yaxshi)</option>
                          </select>
                        </div>

                        {/* Sim 3: Physical Activity increase */}
                        <div className="bg-white p-2.5 rounded border border-slate-200">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Jismoniy Harakat</label>
                          <select
                            value={simulatedActivity !== null ? simulatedActivity : formData.jismoniyFaollik}
                            onChange={(e) => setSimulatedActivity(e.target.value as 'kam' | 'ortacha' | 'yuqori')}
                            className="w-full text-xs rounded border border-slate-300 p-1"
                          >
                            <option value="kam">Kam (Sedentary)</option>
                            <option value="ortacha">Me'yorli piyoda jurish</option>
                            <option value="yuqori">Kunlik faol jadal sport</option>
                          </select>
                        </div>

                        {/* Sim 4: Quit tobacco */}
                        {formData.chekish === 'ha' && (
                          <div className="bg-white p-2.5 rounded border border-slate-200">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Tamaki kashandaligi</label>
                            <select
                              value={simulatedTobacco !== null ? simulatedTobacco : formData.chekish}
                              onChange={(e) => setSimulatedTobacco(e.target.value as 'yoq' | 'ha')}
                              className="w-full text-xs rounded border border-slate-300 p-1"
                            >
                              <option value="ha">Chekishni davom etaman</option>
                              <option value="yoq">Chekishni butunlay tashlash</option>
                            </select>
                          </div>
                        )}

                        {/* Sim 5: Nosvoy */}
                        {formData.nosvoy === 'ha' && (
                          <div className="bg-white p-2.5 rounded border border-slate-200">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nosvoy iste'moli</label>
                            <select
                              value={simulatedNosvoy !== null ? simulatedNosvoy : formData.nosvoy}
                              onChange={(e) => setSimulatedNosvoy(e.target.value as 'yoq' | 'ha')}
                              className="w-full text-xs rounded border border-slate-300 p-1"
                            >
                              <option value="ha">Nosvoy otishda davom etish</option>
                              <option value="yoq">Nosvoydan butunlay voz kechish</option>
                            </select>
                          </div>
                        )}

                      </div>

                      {/* Simulation result metrics */}
                      {simulatedResult !== null && (
                        <div className="bg-indigo-600 text-white p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-200">Simulyatsiya qilingan natija</span>
                            <h5 className="text-sm font-bold mt-0.5 leading-relaxed">
                              Ushbu o'zgarishlar va shaxsiy intizom natijasida sizning jami xavfingiz qariyb <span className="text-emerald-300 font-extrabold italic text-lg">{(riskResult.riskFoizi - simulatedResult) > 0 ? (riskResult.riskFoizi - simulatedResult) : 0}% ga</span> pasayadi!
                            </h5>
                          </div>
                          <div className="bg-slate-900/40 py-2 px-4 rounded-lg border border-white/20 text-center shrink-0">
                            <span className="text-[9px] uppercase font-bold text-slate-200 block">Yangi xavf zanjiri</span>
                            <span className="text-3xl font-black text-emerald-300 font-mono">{simulatedResult}%</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* PERSONALIZED HEALTH ADVISOR CHAT (Innovation 3 & 4 Extended Dynamic AI Intervention) */}
                    <div className="bg-slate-900 text-slate-100 rounded-xl p-6 border border-slate-800 space-y-4 print:hidden animate-fadeIn shadow-lg">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-emerald-600 rounded-lg text-white">
                            <Sparkles className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-xs uppercase tracking-wide text-slate-200">
                              Sun'iy Intellekt Shaxsiy Kardiolog Maslahatchisi
                            </h4>
                            <p className="text-[10px] text-slate-400">
                              Dissertatsiya ommaviy profilaktika modeliga asoslangan tezkor muloqot
                            </p>
                          </div>
                        </div>
                        <span className="text-[9px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-900 border-dashed font-bold font-mono">
                          ONLINE & AKTIV
                        </span>
                      </div>

                      {/* Messages body */}
                      <div className="max-h-[350px] overflow-y-auto space-y-3.5 pr-1 md:max-h-[400px]">
                        {chatMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                          >
                            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs font-sans leading-relaxed ${
                              msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                : 'bg-slate-800 text-slate-200 border border-slate-700/50 rounded-tl-none'
                            }`}>
                              <p className="whitespace-pre-line">{msg.text}</p>
                            </div>
                          </div>
                        ))}

                        {isSendingToChat && (
                          <div className="flex justify-start animate-pulse">
                            <div className="bg-slate-800 text-slate-400 border border-slate-700/50 rounded-xl rounded-tl-none px-3.5 py-2.5 text-xs flex items-center gap-2">
                              <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                              <span>AI maslahatchi tahlil qilib javob yozmoqda...</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Quick Option suggestion chips */}
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800">
                        <span className="text-[9px] font-bold text-slate-500 uppercase self-center mr-1">Tezkor savollar:</span>
                        <button
                          type="button"
                          onClick={() => { setChatInput("Farg'ona oshi (palov) ni qanday qilib sog'lomlashtirish mumkin?"); }}
                          className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700 transition cursor-pointer"
                        >
                          Palovni parhez qilish 🍲
                        </button>
                        <button
                          type="button"
                          onClick={() => { setChatInput("Nosvoyning yurak xurujiga va arterial qon tomir spazmiga bog'liqligini isbotlab bering."); }}
                          className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700 transition cursor-pointer"
                        >
                          Nosvoy biologik zarari 🚭
                        </button>
                        <button
                          type="button"
                          onClick={() => { setChatInput("Kunda 5g dan kam tuz iste'mol qilishni qanday o'rgansam bo'ladi?"); }}
                          className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700 transition cursor-pointer"
                        >
                          Tuzdan kamaytirish siri 🧂
                        </button>
                        <button
                          type="button"
                          onClick={() => { setChatInput("Salomatlik komplayensimni va dori ichish intizomini qanday yaxshilayman?"); }}
                          className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700 transition cursor-pointer"
                        >
                          Shifokor Komplayensi 🩺
                        </button>
                      </div>

                      {/* Chat text input */}
                      <form onSubmit={handleSendChatMessage} className="flex gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          disabled={isSendingToChat}
                          placeholder="AI kardiolog maslahatchiga o'zbek tilida savol bering (masalan: piyoda yurish qoidasi)..."
                          className="flex-1 text-xs rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-500"
                        />
                        <button
                          type="submit"
                          disabled={isSendingToChat || !chatInput.trim()}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs px-4 rounded-lg transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                          id="btn-send-chat"
                        >
                          <span>Yuborish</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </div>

                  </div>

                </div>

              </div>
            </div>
          </div>
            )}
          </div>
        )}

        {/* TAB 4: ARCHIVE HISTORY (API) */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6">
            <div className="border-b pb-4 flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 uppercase">Salomatlik Skrininglari Arxiv Tarixi</h2>
                <p className="text-xs text-slate-500">Serverda saqlangan so'rovnoma natijalari (EnergoHealth-Predict)</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded font-bold font-mono">
                  Jami arxiv: {apiSurveys.length} ta
                </span>
                <button
                  type="button"
                  onClick={loadApiSurveys}
                  disabled={historyLoading}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                  title="Yangilash"
                >
                  <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {historyError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Arxiv yuklanmadi</p>
                  <p className="text-xs mt-0.5">{historyError}</p>
                </div>
              </div>
            )}

            {historyLoading ? (
              <div className="flex justify-center py-16">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : apiSurveys.length > 0 ? (
              <div className="space-y-4">
                {apiSurveys.map((survey) => {
                  const zoneStyle = getRiskZoneStyle(survey.risk_zonasi);
                  const tahlil = survey.ai_response;
                  const riskPct = tahlil?.riskFoizi ?? survey.score_total;
                  const isOpen = historyViewId === survey.id;
                  return (
                    <div key={survey.id} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div
                        onClick={() => setHistoryViewId(isOpen ? null : survey.id)}
                        className="p-4 bg-slate-50 hover:bg-emerald-50/20 transition-all cursor-pointer flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-slate-500">
                              {new Date(survey.created_at).toLocaleString('uz-UZ', { hour12: false })}
                            </span>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded text-white uppercase"
                              style={{ backgroundColor: zoneStyle.color }}
                            >
                              {survey.risk_zonasi || '—'}
                            </span>
                            <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">
                              {survey.answered_count} javob
                            </span>
                          </div>
                          <p className="text-sm font-bold text-slate-800">
                            Risk balli: {riskPct}% · TMI: {tahlil?.tmi ?? '—'}
                          </p>
                          <p className="text-xs text-slate-500 line-clamp-2">
                            {tahlil?.klinikXulosa || survey.klinik_xulosa || 'Klinik xulosa mavjud emas'}
                          </p>
                          {survey.ai_xato && (
                            <p className="text-[10px] text-amber-700 font-semibold">AI xato: {survey.ai_xato}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 justify-between sm:justify-end shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-bold text-slate-500">Xavf darajasi</div>
                            <div className="text-xl font-black" style={{ color: zoneStyle.color }}>
                              {riskPct}%
                            </div>
                          </div>
                          <ArrowRight className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                      {isOpen && (
                        <div className="p-4 border-t border-slate-200 bg-white">
                          <SurveyReport
                            survey={survey}
                            tahlil={tahlil}
                            user={currentUser}
                            language={language}
                            onClose={() => setHistoryViewId(null)}
                            onUpdated={(result) => {
                              setApiSurveys((prev) =>
                                prev.map((s) => (s.id === result.response.id ? result.response : s))
                              );
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 space-y-3">
                <Clock className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="font-extrabold text-slate-700">Hozircha arxiv tarixi topilmadi</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Korporativ so'rovnomani to'ldirib yuborganingizdan keyin natijalar shu yerda saqlanadi.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('screening')}
                  className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                >
                  So'rovnomaga o'tish
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: HEALTH JOURNAL (Salomatlik Kundaligi) */}
        {activeTab === 'journal' && (
          <div className="space-y-6">
            
            {/* 1. JOURNAL HEADER STATISTICS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* average BP card */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">O'rtacha qon bosimi</h3>
                  <p className="text-xl font-extrabold text-slate-800 mt-1">
                    {journalEntries.length > 0
                      ? `${Math.round(journalEntries.reduce((sum, e) => sum + e.sistolik, 0) / journalEntries.length)} / ${Math.round(journalEntries.reduce((sum, e) => sum + e.diastolik, 0) / journalEntries.length)}`
                      : 'Kiritilmagan'
                    } <span className="text-xs font-normal text-slate-500 font-sans">mmHg</span>
                  </p>
                  <div className="text-[10px] text-slate-400 mt-2 font-mono">
                    So'nggi {journalEntries.length} ta yozuv asosida
                  </div>
                </div>
                <div className={`p-3 rounded-full ${
                  journalEntries.length === 0 
                    ? 'bg-slate-100 text-slate-400' 
                    : (journalEntries.reduce((sum, e) => sum + e.sistolik, 0) / journalEntries.length > 130 
                        ? 'bg-red-100 text-red-600' 
                        : 'bg-emerald-100 text-emerald-600')
                }`}>
                  <Activity className="w-6 h-6" />
                </div>
              </div>

              {/* average pulse card */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">O'rtacha puls</h3>
                  <p className="text-xl font-extrabold text-slate-800 mt-1">
                    {journalEntries.length > 0
                      ? Math.round(journalEntries.reduce((sum, e) => sum + e.puls, 0) / journalEntries.length)
                      : 'Kiritilmagan'
                    } <span className="text-xs font-normal text-slate-500 font-sans">zarba/min</span>
                  </p>
                  <div className="text-[10px] text-slate-400 mt-2 font-mono">
                    Normal me'yor: 60-90 zarba/min
                  </div>
                </div>
                <div className="p-3 bg-red-100 text-red-500 rounded-full">
                  <Heart className="w-6 h-6" />
                </div>
              </div>

              {/* medication compliance card */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Dori ichish intizomi</h3>
                  <p className="text-xl font-extrabold text-slate-800 mt-1">
                    {(() => {
                      let totalMeds = 0;
                      let takenMeds = 0;
                      journalEntries.forEach(entry => {
                        entry.dorilar.forEach(d => {
                          totalMeds++;
                          if (d.ichildi) takenMeds++;
                        });
                      });
                      return totalMeds > 0 ? `${Math.round((takenMeds / totalMeds) * 100)}%` : 'Kiritilmagan';
                    })()}
                  </p>
                  <div className="text-[10px] text-slate-400 mt-2 font-mono">
                    Komplayens darajasi
                  </div>
                </div>
                <div className="p-3 bg-indigo-100 text-indigo-505 rounded-full">
                  <CheckCircle className="w-6 h-6" />
                </div>
              </div>

              {/* active cardiac alerts card */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ogohlantirishlar</h3>
                  <p className="text-xl font-extrabold text-slate-800 mt-1">
                    {(() => {
                      let warningCount = 0;
                      journalEntries.forEach(entry => {
                        if (entry.sistolik >= 140 || entry.diastolik >= 90 || entry.alomatlar.length > 0) {
                          warningCount++;
                        }
                      });
                      return `${warningCount} ta`;
                    })()}
                  </p>
                  <div className="text-[10px] text-slate-400 mt-2 font-mono text-red-500 font-bold">
                    Klinik e'tibor talab holatlar
                  </div>
                </div>
                <div className={`p-3 rounded-full ${
                  journalEntries.some(e => e.alomatlar.length > 0 || e.sistolik >= 140) 
                    ? 'bg-amber-100 text-amber-600' 
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>

            </div>

            {/* 1.5 INTERACTIVE HEALTH CHART */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 uppercase flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-indigo-600" />
                    Salomatlik Ko'rsatkichlari Dinamikasi (Oxirgi 7 ta yozuv)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Qon bosimi (Sistolik / Diastolik) va Puls ko'rsatkichlarining o'zaro nisbiy o'zgarish tendensiyasi.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1 bg-red-500 rounded-full" />
                    <span className="text-slate-600 font-semibold">Sistolik (SYS)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1 bg-blue-500 rounded-full" />
                    <span className="text-slate-600 font-semibold">Diastolik (DIA)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1 bg-emerald-500 rounded-full" />
                    <span className="text-slate-600 font-semibold">Puls (PUL)</span>
                  </div>
                </div>
              </div>

              {journalEntries.length > 0 ? (
                <div className="w-full h-[280px] sm:h-[320px] pt-4 font-sans">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={[...journalEntries]
                        .slice(0, 7)
                        .reverse()
                        .map(entry => ({
                          name: `${entry.sana.split('-').slice(1).join('/')} ${entry.vaqt}`,
                          sistolik: entry.sistolik,
                          diastolik: entry.diastolik,
                          puls: entry.puls
                        }))}
                      margin={{ top: 10, right: 15, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        dy={8}
                        className="font-mono text-[9px]"
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        domain={['dataMin - 10', 'dataMax + 10']}
                        dx={-8}
                        className="font-mono text-[9px]"
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" 
                        dataKey="sistolik" 
                        name="Sistolik qon bosimi" 
                        stroke="#ef4444" 
                        strokeWidth={3} 
                        activeDot={{ r: 6 }} 
                        dot={{ r: 3, strokeWidth: 1 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="diastolik" 
                        name="Diastolik qon bosimi" 
                        stroke="#3b82f6" 
                        strokeWidth={3} 
                        activeDot={{ r: 6 }} 
                        dot={{ r: 3, strokeWidth: 1 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="puls" 
                        name="Puls ko'rsatkichi" 
                        stroke="#10b981" 
                        strokeWidth={2} 
                        activeDot={{ r: 5 }} 
                        dot={{ r: 2, strokeWidth: 1 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl bg-slate-50/70 border border-dashed text-center space-y-3">
                  <Activity className="w-10 h-10 text-slate-300 animate-pulse" />
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm text-slate-700">Grafik yozuvlari mavjud emas</h4>
                    <p className="text-xs text-slate-500 max-w-sm">
                      Sizda hali salomatlik kundaligi yozuvlari mavjud emas. Quyidagi shakl orqali birinchi yozuvni kiriting va grafik zudlik bilan faollashadi.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 2. MAIN SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* LEFT COLUMN: FORM */}
              <div className="lg:col-span-12 xl:col-span-5 space-y-6">
                
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
                  <div className="border-b pb-3">
                    <h3 className="text-lg font-extrabold text-slate-800 uppercase flex items-center gap-2">
                      <Plus className="w-5 h-5 text-emerald-600" />
                      Yangi Kunlik Qayd Qo'shish
                    </h3>
                    <p className="text-xs text-slate-500">
                      Qon bosimi, puls va dorilar qabulini doimiy kiritib boring.
                    </p>
                  </div>

                  <form onSubmit={handleAddJournalEntry} className="space-y-4">
                    
                    {/* Date and Time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Sana
                        </label>
                        <input
                          type="date"
                          value={journalForm.sana}
                          onChange={(e) => setJournalForm({ ...journalForm, sana: e.target.value })}
                          required
                          className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Vaqt
                        </label>
                        <input
                          type="text"
                          value={journalForm.vaqt}
                          onChange={(e) => setJournalForm({ ...journalForm, vaqt: e.target.value })}
                          required
                          placeholder="HH:MM"
                          className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                        />
                      </div>
                    </div>

                    {/* Blood pressure & pulse */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Sistolik (mmHg)
                        </label>
                        <input
                          type="number"
                          value={journalForm.sistolik}
                          onChange={(e) => setJournalForm({ ...journalForm, sistolik: parseInt(e.target.value) || 0 })}
                          required
                          min="50"
                          max="250"
                          className="w-full text-sm rounded border border-slate-300 p-2 text-slate-800 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-black"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Diastolik (mmHg)
                        </label>
                        <input
                          type="number"
                          value={journalForm.diastolik}
                          onChange={(e) => setJournalForm({ ...journalForm, diastolik: parseInt(e.target.value) || 0 })}
                          required
                          min="30"
                          max="150"
                          className="w-full text-sm rounded border border-slate-300 p-2 text-slate-800 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-black"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Puls (/min)
                        </label>
                        <input
                          type="number"
                          value={journalForm.puls}
                          onChange={(e) => setJournalForm({ ...journalForm, puls: parseInt(e.target.value) || 0 })}
                          required
                          min="40"
                          max="200"
                          className="w-full text-sm rounded border border-slate-300 p-2 text-slate-800 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-black"
                        />
                      </div>
                    </div>

                    {/* Glucose and Weight */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Qondagi qand (mmol/l)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Ixtiyoriy"
                          value={journalForm.glyukoza}
                          onChange={(e) => setJournalForm({ ...journalForm, glyukoza: e.target.value !== '' ? parseFloat(e.target.value) : '' })}
                          className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Vazn (kg)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Ixtiyoriy"
                          value={journalForm.vazn}
                          onChange={(e) => setJournalForm({ ...journalForm, vazn: e.target.value !== '' ? parseFloat(e.target.value) : '' })}
                          className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Sleep and Stress */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Uyqu sifati
                        </label>
                        <select
                          value={journalForm.uyqu}
                          onChange={(e) => setJournalForm({ ...journalForm, uyqu: e.target.value as any })}
                          className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="yaxshi">Yaxshi (Tinch uyqu)</option>
                          <option value="ortacha">O'rtacha (Tungi uyg'onishlar)</option>
                          <option value="yomon">Yomon (Uykusizlik)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Stress darajasi
                        </label>
                        <select
                          value={journalForm.stress}
                          onChange={(e) => setJournalForm({ ...journalForm, stress: e.target.value as any })}
                          className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="past">Past (Xotirjamlik)</option>
                          <option value="ortacha">O'rtacha (O'rtacha kuchanish)</option>
                          <option value="yuqori">Yuqori (Kuchli asabiylashish)</option>
                        </select>
                      </div>
                    </div>

                    {/* Kunlik faollik va uyqu */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-emerald-50/40 p-3 rounded-xl border border-emerald-100">
                      <div>
                        <label className="block text-[11px] font-bold text-emerald-800 uppercase tracking-wide mb-1">
                          Yurilgan masofa (metr/kun)
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Masalan: 5000"
                          value={journalForm.yurilganMetr}
                          onChange={(e) => setJournalForm({ ...journalForm, yurilganMetr: e.target.value !== '' ? parseInt(e.target.value) : '' })}
                          className="w-full text-xs rounded border border-emerald-200 p-2 text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-emerald-800 uppercase tracking-wide mb-1">
                          Ichilgan suyuqlik (ml/kun)
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Masalan: 2000"
                          value={journalForm.ichilganSuvMl}
                          onChange={(e) => setJournalForm({ ...journalForm, ichilganSuvMl: e.target.value !== '' ? parseInt(e.target.value) : '' })}
                          className="w-full text-xs rounded border border-emerald-200 p-2 text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-emerald-800 uppercase tracking-wide mb-1">
                          Uxlash vaqti (soat)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          placeholder="Masalan: 7.5"
                          value={journalForm.uxquSoati}
                          onChange={(e) => setJournalForm({ ...journalForm, uxquSoati: e.target.value !== '' ? parseFloat(e.target.value) : '' })}
                          className="w-full text-xs rounded border border-emerald-200 p-2 text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* CARDIAC SYMPTOMS */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                      <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wide">
                        Kardiologik & Somatik belgilari (Semptomlar)
                      </label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {[
                          { id: 'ogriq', label: "Ko'krak og'rig'i ⚠️" },
                          { id: 'nafas_qisilishi', label: "Nafas qisilishi 🫁" },
                          { id: 'bosh_aylanishi', label: "Bosh aylanishi 🌀" },
                          { id: 'yurak_oynashi', label: "Yurak o'ynashi" },
                          { id: 'shishlar', label: "Oyoqlarda shishlar" },
                          { id: 'holsizlik', label: "Kuchli holsizlik" }
                        ].map((sym) => {
                          const isChecked = journalForm.alomatlar.includes(sym.id);
                          return (
                            <label
                              key={sym.id}
                              className={`flex items-start gap-2 p-1.5 rounded border text-slate-700 text-xs transition-colors cursor-pointer ${
                                isChecked 
                                  ? 'bg-amber-50 border-amber-300 font-semibold' 
                                  : 'bg-white hover:bg-slate-100 border-slate-200'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  const updated = isChecked
                                    ? journalForm.alomatlar.filter(id => id !== sym.id)
                                    : [...journalForm.alomatlar, sym.id];
                                  setJournalForm({ ...journalForm, alomatlar: updated });
                                }}
                                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                              />
                              <span>{sym.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* MEDICATION COMPLIANCE */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wide">
                          Kunlik Dorilar Qabuli
                        </label>
                        <span className="text-[9px] bg-slate-200 px-2 py-0.5 rounded font-mono font-bold text-slate-600">
                          {journalForm.dorilar.length} ta dori ro'yxatda
                        </span>
                      </div>

                      {journalForm.dorilar.length > 0 ? (
                        <div className="space-y-1.5">
                          {journalForm.dorilar.map((med) => (
                            <div key={med.nomi} className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200 text-xs text-slate-800">
                              <label className="flex items-center gap-2 cursor-pointer flex-1">
                                <input
                                  type="checkbox"
                                  checked={med.ichildi}
                                  onChange={() => toggleMedicationIchildi(med.nomi)}
                                  className="rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                                />
                                <span className={med.ichildi ? "line-through text-slate-400 font-semibold" : "text-slate-700 font-bold"}>
                                  {med.nomi} <span className="text-[10px] text-slate-500 font-normal">({med.doza})</span>
                                </span>
                              </label>
                              <button
                                type="button"
                                onClick={() => handleRemoveMedication(med.nomi)}
                                className="text-[10px] text-red-500 hover:text-red-700 ml-2"
                              >
                                O'chirish
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 italic text-center py-1">
                          Dori ro'yxati yo'q, quyida tezda dori qo'shing.
                        </p>
                      )}

                      <div className="flex gap-1.5 items-end pt-1 bg-white p-2 rounded border border-slate-200/60">
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Dori nomi (masalan: Lozap, Enap)"
                            value={newMedNomi}
                            onChange={(e) => setNewMedNomi(e.target.value)}
                            className="w-full text-[10px] rounded border border-slate-300 p-1.5 focus:outline-none text-slate-800 bg-slate-50"
                          />
                        </div>
                        <div className="w-[80px]">
                          <input
                            type="text"
                            placeholder="Doza"
                            value={newMedDoza}
                            onChange={(e) => setNewMedDoza(e.target.value)}
                            className="w-full text-[10px] rounded border border-slate-300 p-1.5 focus:outline-none text-slate-800 bg-slate-50"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddMedication}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1.5 rounded transition shrink-0 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* NOTES */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                        Qo'shimcha Qaydlar (Nutritiv va faollik holati)
                      </label>
                      <textarea
                        rows={2}
                        value={journalForm.qaydlar}
                        onChange={(e) => setJournalForm({ ...journalForm, qaydlar: e.target.value })}
                        placeholder="Masalan: To'g'ri taomlandim, kamroq tuz ishlatildi. Kechki payt 40 daqiqa ko'chada sayr qildim..."
                        className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      Kundalikka Saqlash 💾
                    </button>

                  </form>
                </div>

                {/* HEART WARNING */}
                {journalForm.alomatlar.length > 0 && (
                  <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-4 rounded-r-lg shadow-sm space-y-1">
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                      <h4 className="font-extrabold text-xs uppercase text-red-900 tracking-wider">Zudlik bilan Vrach ko'rigi zarur!</h4>
                    </div>
                    <p className="text-[11px] text-red-800 leading-relaxed font-semibold">
                      Sizda kardiologik alomatlar tanlandi! Ko'krak qafasidagi og'riqlar va nafas qisilishi o'tkir kardiologik yuklanma belgisi bo'lishi mumkin. Sog'lig'ingizni xavf ostiga qo'ymasdan oilaviy shifokorga murojaat qiling!
                    </p>
                  </div>
                )}

              </div>

              {/* RIGHT COLUMN: HISTORY TIMELINE */}
              <div className="lg:col-span-12 xl:col-span-7 space-y-6">

                {/* DORI ESLATMALARI VA PUSH NOTIFICATION TIZIMI */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-205 p-6 space-y-5">
                  <div className="border-b pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-800 uppercase flex items-center gap-2">
                        <Bell className="w-5 h-5 text-indigo-650 animate-pulse" />
                        Dorilar Eslatmalari Tizimi (Push Alert)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Kunlik kardiologik dori vositalaringizni ichish vaqtini o'zbekona push-ogohlantirish orqali nazorat qiling.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const testAlarm: MedicationAlarm = {
                          id: 'test-' + Math.random().toString(36).substr(2, 5),
                          nomi: 'Lozap H (Sinov)',
                          doza: '50 mg',
                          vaqt: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false }),
                          faol: true,
                          ichildiBugun: false,
                          oxirgiIchilganSana: ''
                        };
                        setActiveNotification(testAlarm);
                        playChime();
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow cursor-pointer uppercase tracking-wider shrink-0"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Push Sinovi (Test)
                    </button>
                  </div>

                  {/* Alarms List */}
                  <div className="space-y-2">
                    {medAlarms.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {medAlarms.map((alarm) => (
                          <div key={alarm.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-2 shadow-sm text-xs">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${alarm.faol ? (alarm.ichildiBugun ? 'bg-emerald-500' : 'bg-red-500 animate-ping') : 'bg-slate-300'}`} />
                              <div>
                                <b className="text-slate-800 text-[13px]">{alarm.nomi}</b>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span>Dozasi: <b>{alarm.doza}</b></span>
                                  <span>•</span>
                                  <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-extrabold text-[9px]">{alarm.vaqt}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAlarm({ ...alarm });
                                }}
                                className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 p-1 rounded transition shrink-0 cursor-pointer"
                                title="Tahrirlash"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setMedAlarms(prev => prev.map(al => al.id === alarm.id ? { ...al, faol: !al.faol } : al));
                                }}
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded transition cursor-pointer ${alarm.faol ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                              >
                                {alarm.faol ? "Faol" : "Yopiq"}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setMedAlarms(prev => prev.filter(al => al.id !== alarm.id));
                                }}
                                className="text-red-500 hover:text-red-700 font-bold p-1 shrink-0 cursor-pointer"
                                title="Eslatmani o'chirish"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic text-center py-2 bg-slate-50 border border-dashed rounded-lg">Foydalanuvchi eslatmalari yo'q. Quyidagi kichik shakl orqali yangi eslatuvchini qo'shing!</p>
                    )}
                  </div>

                  {/* Add Alarm Form Inline */}
                  <div className="bg-indigo-50/40 rounded-xl border border-indigo-100 p-4 space-y-3">
                    <h5 className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5 text-indigo-600" />
                      Yangi Kunlik Eslatma Qo'shish
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-550 uppercase tracking-wider mb-1">Dori Nomi</label>
                        <input
                          type="text"
                          placeholder="masalan: Lozap, Enap, Bisoprolol"
                          id="alarm-input-name"
                          className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-550 uppercase tracking-wider mb-1">Dozasi & Vaqti</label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Doza (masalan: 10 mg)"
                            id="alarm-input-dose"
                            className="w-1/2 text-xs rounded-lg border border-slate-300 p-2 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500"
                          />
                          <input
                            type="time"
                            defaultValue="08:00"
                            id="alarm-input-time"
                            className="w-1/2 text-xs rounded-lg border border-slate-300 p-1.5 bg-white text-slate-800 font-mono focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nameEl = document.getElementById('alarm-input-name') as HTMLInputElement;
                          const doseEl = document.getElementById('alarm-input-dose') as HTMLInputElement;
                          const timeEl = document.getElementById('alarm-input-time') as HTMLInputElement;
                          
                          if (!nameEl || !nameEl.value.trim()) {
                            alert("Rahmat, dori nomini kiritishingiz lozim!");
                            return;
                          }

                          const newAlarm: MedicationAlarm = {
                            id: 'alarm-' + Date.now(),
                            nomi: nameEl.value.trim(),
                            doza: doseEl ? (doseEl.value.trim() || '1 tab') : '1 tab',
                            vaqt: timeEl ? (timeEl.value || '08:00') : '08:00',
                            faol: true,
                            ichildiBugun: false,
                            oxirgiIchilganSana: ''
                          };

                          setMedAlarms(prev => [...prev, newAlarm]);
                          
                          // Clear values
                          nameEl.value = '';
                          if (doseEl) doseEl.value = '';
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2 rounded-lg transition-colors cursor-pointer text-center uppercase tracking-wider"
                      >
                        Qo'shish 🔔
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-3">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-800 uppercase flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-emerald-600" />
                        Kundalik yozuvlar zanjiri (Timeline)
                      </h3>
                      <p className="text-xs text-slate-500">
                        O'zgarishlar dinamikasi qon tomirlar islohi uchun muhimdir.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={downloadJournalCSV}
                        className="text-[11px] bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer font-bold"
                        title="Kundalik qaydlarini Excel (CSV) formatida yuklab olish"
                      >
                        <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                        CSV Yuklash
                      </button>

                      <button
                        onClick={downloadJournalExcel}
                        className="text-[11px] bg-blue-50 border border-blue-300 hover:bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer font-bold"
                        title="Kundalik qaydlarini Excel formatida yuklab olish"
                      >
                        <FileDown className="w-3.5 h-3.5 text-blue-600" />
                        Excel
                      </button>

                      <button
                        className="text-[11px] bg-indigo-50 border border-indigo-300 hover:bg-indigo-100 text-indigo-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer font-bold"
                        title="Shifokorga ko'rsatish uchun maxsus PDF kardiologik hisobot tayyorlash"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        Shifokorga Hisobot (PDF)
                      </button>

                      <button
                        onClick={() => window.print()}
                        className="text-[11px] border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
                        Chop Etish
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Haqiqatdan ham barcha kundalik qaydlarini o'chirib yubormoqchimisiz?")) {
                            setJournalEntries([]);
                            localStorage.removeItem('soglik_kundaligi');
                          }
                        }}
                        className="text-[11px] text-red-600 hover:bg-red-50 border border-red-250 px-3 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        Tozalash
                      </button>
                    </div>
                  </div>

                  {/* TIMELINE LIST */}
                  {journalEntries.length > 0 ? (
                    <div className="space-y-6 pr-1">
                      {journalEntries.map((entry) => {
                        
                        // BP check
                        let bpCategory = { label: 'Normal', color: 'bg-emerald-50 text-emerald-800 border-emerald-300', score: 0 };
                        if (entry.sistolik >= 140 || entry.diastolik >= 90) {
                          bpCategory = { label: 'Gipertoniya 🔴', color: 'bg-red-50 text-red-800 border-red-300 font-bold', score: 2 };
                        } else if (entry.sistolik >= 130 || entry.diastolik >= 80) {
                          bpCategory = { label: 'Pre-gipertoniya 🟡', color: 'bg-amber-50 text-amber-800 border-amber-350', score: 1 };
                        }

                        const totalMedCount = entry.dorilar.length;
                        const takenMedCount = entry.dorilar.filter(d => d.ichildi).length;

                        return (
                          <div
                            key={entry.id}
                            className="relative pl-6 border-l-2 border-slate-200 space-y-3 pb-2"
                          >
                            <div className={`absolute -left-[7px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-white ${
                              bpCategory.score === 2 ? 'border-red-500 bg-red-500' : (bpCategory.score === 1 ? 'border-amber-500 bg-amber-400' : 'border-emerald-500 bg-emerald-500')
                            }`}></div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                  📅 {entry.sana} ({entry.vaqt})
                                </span>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${bpCategory.color}`}>
                                  {bpCategory.label}
                                </span>
                              </div>
                              <button
                                onClick={() => handleDeleteJournalEntry(entry.id)}
                                className="text-[11px] text-slate-400 hover:text-red-500 transition cursor-pointer"
                              >
                                O'chirish
                              </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200/60 rounded-xl p-3">
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Arterial Bosim</span>
                                <span className="text-sm font-black text-slate-800 font-mono">
                                  {entry.sistolik} / {entry.diastolik} <span className="text-[10px] text-slate-500">mmHg</span>
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Yurak Puls</span>
                                <span className="text-sm font-black text-slate-800 font-mono">
                                  ❤️ {entry.puls} <span className="text-[10px] text-slate-500 font-sans">/daqiqa</span>
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Qondagi qand</span>
                                <span className="text-sm font-bold text-slate-800 font-mono">
                                  {entry.glyukoza ? `🩸 ${entry.glyukoza} mmol/l` : 'Kiritilmagan'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Sog'lom vazn</span>
                                <span className="text-sm font-bold text-slate-800 font-mono">
                                  ⚖️ {entry.vazn ? `${entry.vazn} kg` : 'Kiritilmagan'}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                              <div>
                                <span className="text-[10px] text-emerald-700 uppercase font-bold block">Yurilgan (metr)</span>
                                <span className="text-sm font-bold text-slate-800">
                                  {entry.yurilganMetr !== '' && entry.yurilganMetr != null ? `🚶 ${entry.yurilganMetr} m` : 'Kiritilmagan'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-emerald-700 uppercase font-bold block">Ichilgan suv (ml)</span>
                                <span className="text-sm font-bold text-slate-800">
                                  {entry.ichilganSuvMl !== '' && entry.ichilganSuvMl != null ? `💧 ${entry.ichilganSuvMl} ml` : 'Kiritilmagan'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-emerald-700 uppercase font-bold block">Uxlash (soat)</span>
                                <span className="text-sm font-bold text-slate-800">
                                  {entry.uxquSoati !== '' && entry.uxquSoati != null ? `😴 ${entry.uxquSoati} soat` : 'Kiritilmagan'}
                                </span>
                              </div>
                            </div>

                            {/* symptoms & medications */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              
                              <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                                <span className="text-[10px] text-slate-500 font-bold uppercase block">Kuzatilgan Semptomlar</span>
                                {entry.alomatlar.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {entry.alomatlar.map(s => (
                                      <span key={s} className="text-[9px] bg-red-100 text-red-850 border border-red-200 px-2 py-0.5 rounded-full font-bold">
                                        {s === 'ogriq' ? 'Ko\'krak og\'rig\'i ⚠️' : (s === 'nafas_qisilishi' ? 'Nafas qisishi 🫁' : (s === 'bosh_aylanishi' ? 'Bosh aylanishi 🌀' : (s === 'yurak_oynashi' ? 'Yurak o\'ynashi' : s)))}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-emerald-600 font-medium block">
                                    ✓ Hech qanday shikoyat yoki alomat yo'q
                                  </span>
                                )}
                              </div>

                              <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-slate-500 font-bold uppercase">Dorilar qabuli</span>
                                  {totalMedCount > 0 && (
                                    <span className="text-[9px] font-bold text-indigo-800">
                                      {takenMedCount} / {totalMedCount} ichildi
                                    </span>
                                  )}
                                </div>
                                {entry.dorilar.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {entry.dorilar.map(d => (
                                      <span key={d.nomi} className={`text-[9px] px-2 py-0.5 rounded ${
                                        d.ichildi 
                                          ? 'bg-emerald-100 text-emerald-800 font-semibold' 
                                          : 'bg-slate-100 text-slate-400 line-through'
                                      }`}>
                                        {d.ichildi ? '✓' : '✗'} {d.nomi} ({d.doza})
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic block">
                                    Dori kiritilmagan
                                  </span>
                                )}
                              </div>

                            </div>

                            {entry.qaydlar && (
                              <div className="bg-slate-100 text-slate-700 p-2 rounded border border-dashed text-xs italic">
                                <b>Qayd:</b> "{entry.qaydlar}"
                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-16 space-y-3">
                      <BookOpen className="w-16 h-16 text-slate-300 mx-auto" />
                      <h4 className="font-extrabold text-slate-700">Hozircha kundalikka qaydlar kiritilmagan</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Muntazam ravishda o'z qon bosimingiz, pulsingiz va o'zgarishlar zanjirini kiritib boring!
                      </p>
                    </div>
                  )}

                </div>

              </div>

            </div>

          </div>
        )}

        {activeTab === 'advices' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b pb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <span>Shifokorlaringiz Klinik Tavsiyalari va Retseptlari ({patientAdvices.length})</span>
            </h3>

            {patientAdvices.length === 0 ? (
              <div className="text-center py-16 space-y-3 bg-slate-50/50 rounded-2xl border">
                <Heart className="w-12 h-12 text-slate-300 mx-auto animate-pulse shrink-0" />
                <h4 className="font-extrabold text-slate-700">Shifokor maslahatlari hozircha yo'q</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Sizning hisobingizga vrachlar tomonidan biron-bir shaxsiy ko'rsatmalar yoki dori-darmon tartib-taomillari biriktirilmagan.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {patientAdvices.map((ad) => (
                  <div key={ad.id} className="p-5 rounded-2xl border border-indigo-100 bg-indigo-50/15 space-y-3 shadow-sm relative">
                    <div className="flex items-center justify-between border-b pb-2 text-xs">
                      <div>
                        <span className="font-black text-indigo-950 block">👨‍⚕️ {ad.shifokorIsm}</span>
                        <span className="text-[10px] text-slate-450 font-semibold">{ad.shifokorMutaxassislik}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border">
                        {ad.sana} {ad.vaqt}
                      </span>
                    </div>

                    <p className="text-xs text-slate-750 leading-relaxed font-normal whitespace-pre-line bg-white/70 p-3 rounded-lg border italic">
                      "{ad.matn}"
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>🏥 Farg'ona kardio-klaster markazi</span>
                      <span className="text-emerald-600 font-bold">✓ Tasdiqlangan Retsept</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* FOOTER & DISCLAIMER */}
      <footer className="max-w-7xl mx-auto px-4 mt-12 border-t border-slate-200 pt-6 text-center text-slate-500 space-y-3 print:hidden">
        <p className="text-xs">
          © 2026 {APP_BRAND}. {t(APP_FOOTER_COPY, language)}
        </p>
        <div className="bg-slate-200/50 p-4 rounded-lg max-w-4xl mx-auto text-[11px] leading-relaxed text-slate-600 border border-slate-300/60">
          <span className="font-extrabold uppercase text-slate-700 block mb-1">Muhim Ogohlantirish (Medical Disclaimer)</span>
          Ushbu tizim klinika emas va shaxsiy vrach yoki kardiolog tavsiyalarini o'rnini bosa olmaydi. Natijalar faqat xavf baholash va profilaktik ma'lumot uchun beriladi. Shoshilinch holatda 103 ga murojaat qiling.
        </div>
      </footer>
      </div>
    </div>
  );
}

