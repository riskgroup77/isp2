import React, { useState } from 'react';
import { 
  Heart, 
  User, 
  Lock, 
  ChevronRight, 
  Building2, 
  MapPin, 
  Activity, 
  Award,
  Sparkles,
  LockKeyhole,
  Info,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { login as apiLogin, register as apiRegister, getProfile, apiProfileToUser } from '../lib/api';
import { formatApiError } from '../lib/surveyUtils';
import { t } from '../lib/lang';
import { APP_BRAND, APP_TAGLINE, APP_DISCLAIMER } from '../lib/branding';

interface AuthScreenProps {
  onAuthSuccess: (user: UserProfile) => void;
  language?: 'lotin' | 'kirill';
  onLanguageChange?: (lang: 'lotin' | 'kirill') => void;
}

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

export default function AuthScreen({ onAuthSuccess, language = 'lotin', onLanguageChange }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [login, setLogin] = useState('');
  const [parol, setParol] = useState('');
  const [ism, setIsm] = useState('');
  const [rol, setRol] = useState<UserRole>('xodim');
  
  // Patient fields
  const [shaharTuman, setShaharTuman] = useState("Farg'ona shahri");
  const [yosh, setYosh] = useState('45');
  const [jins, setJins] = useState<'erkak' | 'ayol'>('erkak');
  const [boy, setBoy] = useState('172');
  const [vazn, setVazn] = useState('75');

  // Doctor fields
  const [mutaxassislik, setMutaxassislik] = useState('Kardiolog, Ilmiy xodim');
  const [shifoxona, setShifoxona] = useState("Farg'ona viloyat kardiologiya dispanseri");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleShortcutLogin = (demoLogin: string, demoParol: string) => {
    resetMessages();
    setLogin(demoLogin);
    setParol(demoParol);
    // Submit login directly
    submitLogin(demoLogin, demoParol);
  };

  const submitLogin = async (usrLogin: string, usrParol: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await apiLogin(usrLogin, usrParol);
      const profile = await getProfile();
      onAuthSuccess(apiProfileToUser(profile) as UserProfile);
    } catch (err: unknown) {
      setErrorMsg(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!login.trim() || !parol.trim()) {
      setErrorMsg("Iltimos, login va maxfiy so'zni kiriting.");
      return;
    }

    if (mode === 'login') {
      await submitLogin(login, parol);
    } else {
      // REGISTER
      if (!ism.trim()) {
        setErrorMsg("To'liq ism-sharifingizni kiriting.");
        return;
      }
      setLoading(true);
      try {
        await apiRegister({
          login: login.trim(),
          password: parol.trim(),
          ism: ism.trim(),
          rol: 'xodim',
          jins,
          yosh: parseInt(yosh) || 25,
          shifoxona: null,
          mutaxassislik: null,
        });

        setSuccessMsg("Hisob muvaffaqiyatli yaratildi! Kirish bo'limidan kiring.");
        setMode('login');
        setParol('');
      } catch (err: unknown) {
        setErrorMsg(formatApiError(err));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-md mx-auto my-8 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden" id="auth-container">
      
      {/* Header card banner */}
      <div className="bg-slate-900 p-6 text-white text-center space-y-3 relative">
        {onLanguageChange && (
          <div className="flex justify-center mb-1">
            <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 shadow">
              <button
                type="button"
                onClick={() => onLanguageChange('lotin')}
                className={`px-2.5 py-1 text-[9px] rounded font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  language === 'lotin'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/40'
                }`}
              >
                Lotin
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('kirill')}
                className={`px-2.5 py-1 text-[9px] rounded font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  language === 'kirill'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/40'
                }`}
              >
                Кирилл
              </button>
            </div>
          </div>
        )}
        <div className="absolute top-3 right-3 animate-pulse">
          <Sparkles className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center mx-auto text-white shadow">
          <Heart className="w-6 h-6 shrink-0" />
        </div>
        <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
          {APP_BRAND}
        </h2>
        <p className="text-[10px] sm:text-xs font-semibold text-slate-200 uppercase tracking-wide leading-relaxed mt-2 max-w-sm mx-auto">
          {t(APP_TAGLINE, language)}
        </p>
      </div>

      {/* Tabs list triggers */}
      <div className="flex border-b border-slate-100">
        <button
          type="button"
          onClick={() => { setMode('login'); resetMessages(); }}
          className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
            mode === 'login'
              ? 'border-emerald-505 text-emerald-600 bg-emerald-50/20'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
          id="tab-auth-login"
        >
          {t("Tizimga Kirish", language)}
        </button>
        <button
          type="button"
          onClick={() => { setMode('register'); setRol('xodim'); resetMessages(); }}
          className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
            mode === 'register'
              ? 'border-emerald-505 text-emerald-600 bg-emerald-50/20'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
          id="tab-auth-register"
        >
          {t("Ro'yxatdan O'tish", language)}
        </button>
      </div>

      <div className="p-6">
        
        {/* Error/Success alerts */}
        {errorMsg && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 rounded text-xs text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{t(errorMsg, language)}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded text-xs text-emerald-800 flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{t(successMsg, language)}</span>
          </div>
        )}

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          
          {/* USERNAME / LOGIN */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
              {t("Foydalanuvchi logini *", language)}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder={t("Masalan: Sardor2026", language)}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                className="w-full text-xs rounded border border-slate-300 pl-9 pr-3 py-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500/80 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* PAROL (Password) */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
              {t("Maxfiy parol *", language)}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <LockKeyhole className="w-4 h-4" />
              </span>
              <input
                type="password"
                placeholder="********"
                value={parol}
                onChange={(e) => setParol(e.target.value)}
                required
                className="w-full text-xs rounded border border-slate-300 pl-9 pr-3 py-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500/80 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* ADDITIONAL FIELDS FOR REGISTER ONLY */}
          {mode === 'register' && (
            <div className="space-y-4 border-t border-dashed border-slate-200 pt-4 animate-fadeIn">
              
              {/* FULL NAME */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
                  {t("Ism va Sharifingiz *", language)}
                </label>
                <input
                  type="text"
                  placeholder={t("Masalan: Qodirov Sardorbek", language)}
                  value={ism}
                  onChange={(e) => setIsm(e.target.value)}
                  className="w-full text-xs rounded border border-slate-300 p-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* ROLE SELECTION */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
                  {t("Portal Tizimidagi Rolingiz", language)}
                </label>
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800">{t("Bemor (Foydalanuvchi) 👤", language)}</span>
                  <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded-full">{t("Faqat Bemor", language)}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                  {t("Xavfsizlikni ta'minlash maqsadida mustaqil ravishda faqat Bemor bo'lib ro'yxatdan o'tish imkoniyati mavjud. Shifokor va Admin hisoblari tizim ma'muriyati orqali taqdim etiladi.", language)}
                </p>
              </div>

              {/* CONDITIONAL SUB-FORMS */}
              {rol === 'xodim' && (
                <div className="bg-slate-55 p-3 rounded-xl border border-slate-200/80 space-y-3">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 border-b pb-1">
                     {t("Klinik & Nutritiv boshlang'ich kadr", language)}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                        {t("Siz yashaydigan Hudud", language)}
                      </label>
                      <select
                        value={shaharTuman}
                        onChange={(e) => setShaharTuman(e.target.value)}
                        className="w-full text-[10px] rounded border border-slate-300 p-1.5 focus:outline-none bg-white text-slate-800"
                      >
                        {FERGANA_REGIONS.map((reg) => (
                          <option key={reg} value={reg}>{t(reg, language)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                        {t("Yoshingiz (yillarda)", language)}
                      </label>
                      <input
                        type="number"
                        value={yosh}
                        onChange={(e) => setYosh(e.target.value)}
                        className="w-full text-[10px] rounded border border-slate-300 p-1.5 focus:outline-none bg-white text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                        {t("Jins", language)}
                      </label>
                      <select
                        value={jins}
                        onChange={(e) => setJins(e.target.value as any)}
                        className="w-full text-[10px] rounded border border-slate-300 p-1.5 focus:outline-none bg-white text-slate-800"
                      >
                        <option value="erkak">{t("Erkak", language)}</option>
                        <option value="ayol">{t("Ayol", language)}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                        {t("Bo'y", language)} (sm)
                      </label>
                      <input
                        type="number"
                        value={boy}
                        onChange={(e) => setBoy(e.target.value)}
                        className="w-full text-[10px] rounded border border-slate-300 p-1.5 focus:outline-none bg-white text-slate-800 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                        {t("Vazn", language)} (kg)
                      </label>
                      <input
                        type="number"
                        value={vazn}
                        onChange={(e) => setVazn(e.target.value)}
                        className="w-full text-[10px] rounded border border-slate-300 p-1.5 focus:outline-none bg-white text-slate-800 font-mono"
                      />
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            id="btn-auth-submit"
          >
            <span>{loading ? t('Kuting, ulanish bormoqda...', language) : (mode === 'login' ? t('Tizimga Kirish', language) : t('Portalda Ro\'yxatdan O\'tish', language))}</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* YURIDIK OGOHLANTIRISH / MEDICAL DISCLAIMER */}
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 text-amber-900 text-left space-y-1.5 transition duration-150">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-[10px] uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{t("YUridik ogohlantirish (Medical Disclaimer)", language)}</span>
            </div>
            <p className="text-[10.5px] leading-relaxed text-slate-700 font-medium">
              {t(APP_DISCLAIMER, language)}
            </p>
          </div>

        </form>

        {/* Backend API orqali kirish — demo hisoblar serverda bo'lishi kerak */}
        <div className="mt-8 border-t border-slate-150 pt-5 space-y-2">
          <p className="text-[10px] text-slate-500 text-center">
            {t("API:", language)}{' '}
            <span className="font-mono text-emerald-700">
              {import.meta.env.VITE_API_URL || 'https://api.energohealth-predict.uz'}
            </span>
          </p>
          <p className="text-[9px] text-slate-400 text-center">
            Swagger: /docs · Shifokor ro'yxatdan o'tganda admin tasdiqlashi kerak
          </p>
        </div>
      </div>

    </div>
  );
}
