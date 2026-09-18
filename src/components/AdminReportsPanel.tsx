import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Image,
  FolderArchive,
  Info,
  BookOpen,
  FlaskConical,
  Table2,
  BarChart3,
  PieChart,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { t } from '../lib/lang';

const BASE = '/reports/n400';

type ReportItem = {
  name: string;
  file: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  badge?: string;
};

type ReportGroup = {
  id: string;
  group: string;
  subtitle: string;
  gradient: string;
  border: string;
  iconBg: string;
  iconColor: string;
  Icon: React.ComponentType<{ className?: string }>;
  items: ReportItem[];
};

const REPORT_FILES: ReportGroup[] = [
  {
    id: 'asosiy',
    group: '01 — Asosiy hisobotlar',
    subtitle: 'Dissertatsiya va anketa (Word + Excel, foiz + 95% CI)',
    gradient: 'from-indigo-600 via-blue-600 to-cyan-600',
    border: 'border-indigo-200',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-700',
    Icon: BookOpen,
    items: [
      { name: 'Dissertatsiya_Tahlil_N400.docx', file: '01_asosiy_hisobotlar/Dissertatsiya_Tahlil_N400.docx', icon: FileText, desc: 'Dissertatsiya bob\'i + 4.2-jadval ichida', badge: 'Word' },
      { name: 'Dissertatsiya_Tahlil_N400.xlsx', file: '01_asosiy_hisobotlar/Dissertatsiya_Tahlil_N400.xlsx', icon: FileSpreadsheet, desc: '3-jadval, ICD, 4.2-jadval varaqlari', badge: 'Excel' },
      { name: 'Anketa_Tahlili_N400.docx', file: '01_asosiy_hisobotlar/Anketa_Tahlili_N400.docx', icon: FileText, desc: '7 bo\'lim + xavf zonasi + 95% CI', badge: 'Word' },
      { name: 'Anketa_Tahlili_N400.xlsx', file: '01_asosiy_hisobotlar/Anketa_Tahlili_N400.xlsx', icon: FileSpreadsheet, desc: 'Har bo\'lim alohida varaq', badge: 'Excel' },
      { name: 'Anketa_Tahlili_Sex_Ishchilari.docx', file: '01_asosiy_hisobotlar/Anketa_Tahlili_Sex_Ishchilari.docx', icon: FileText, desc: '7 jadval shablon formatida', badge: 'Word' },
    ],
  },
  {
    id: 'jadval42',
    group: '03 — 4.2-jadval (dissertatsiya formati)',
    subtitle: 'ICD sinflari × Hodisa/Nazorat — 100 ishchiga M ± m',
    gradient: 'from-rose-600 via-red-600 to-orange-500',
    border: 'border-rose-200',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-700',
    Icon: Table2,
    items: [
      { name: 'Jadval_4_2_ICD_Hodisa_Nazorat_N400.docx', file: '03_jadval_4_2/Jadval_4_2_ICD_Hodisa_Nazorat_N400.docx', icon: FileText, desc: 'Skrinshotdagi format: holatlar va kunlar M±m', badge: 'Asosiy' },
      { name: 'Jadval_4_2_ICD_Hodisa_Nazorat_N400.xlsx', file: '03_jadval_4_2/Jadval_4_2_ICD_Hodisa_Nazorat_N400.xlsx', icon: FileSpreadsheet, desc: 'Excel — dissertatsiyaga qo\'yish uchun', badge: 'Excel' },
    ],
  },
  {
    id: 'ilmiy',
    group: '02 — Ilmiy-statistik tahlil',
    subtitle: '95% CI, p-qiymat, OR, Cronbach α, matn namunalari',
    gradient: 'from-violet-600 via-purple-600 to-fuchsia-600',
    border: 'border-violet-200',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-700',
    Icon: FlaskConical,
    items: [
      { name: 'Anketa_Ilmiy_Statistika_N400.docx', file: '02_ilmiy_statistika/Anketa_Ilmiy_Statistika_N400.docx', icon: FileText, desc: 'Dissertatsiya/maqola uchun to\'liq statistika', badge: 'Word' },
      { name: 'Anketa_Ilmiy_Statistika_N400.xlsx', file: '02_ilmiy_statistika/Anketa_Ilmiy_Statistika_N400.xlsx', icon: FileSpreadsheet, desc: '4.2-jadval varaq ham bor', badge: 'Excel' },
    ],
  },
  {
    id: 'malumot',
    group: '06 — Ma\'lumotnoma va formulalar',
    subtitle: 'Hisoblash usullari, CI, OR, 4.2-jadval formulasi',
    gradient: 'from-emerald-600 via-teal-600 to-green-600',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
    Icon: Sparkles,
    items: [
      { name: 'Malumotnoma_Formulalar_N400.docx', file: '06_malumotnoma/Malumotnoma_Formulalar_N400.docx', icon: FileText, desc: 'Barcha formulalar va metodologiya', badge: 'Word' },
    ],
  },
  {
    id: 'diss-diag',
    group: '04 — Diagrammalar (dissertatsiya)',
    subtitle: 'Kasalliklar, ICD, sexlar, jins, hodisa/nazorat',
    gradient: 'from-amber-500 via-orange-500 to-yellow-500',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-800',
    Icon: PieChart,
    items: [
      { name: '01_kasallanishlar_strukturasi.png', file: '04_diagrammalar_dissertatsiya/01_kasallanishlar_strukturasi.png', icon: Image, desc: 'Kasallanishlar pie' },
      { name: '02_icd_kasallik_sinflari.png', file: '04_diagrammalar_dissertatsiya/02_icd_kasallik_sinflari.png', icon: Image, desc: 'ICD-10 barcha 19 sinf' },
      { name: '03_sexlar_taqsimoti.png', file: '04_diagrammalar_dissertatsiya/03_sexlar_taqsimoti.png', icon: Image, desc: 'Sexlar taqsimoti' },
      { name: '04_jins_taqsimoti.png', file: '04_diagrammalar_dissertatsiya/04_jins_taqsimoti.png', icon: Image, desc: 'Jins taqsimoti' },
      { name: '05_hodisa_nazorat.png', file: '04_diagrammalar_dissertatsiya/05_hodisa_nazorat.png', icon: Image, desc: 'Hodisa / nazorat' },
    ],
  },
  {
    id: 'ank-diag',
    group: '05 — Diagrammalar (anketa, har bo\'lim)',
    subtitle: '7 bo\'lim + xavf zonasi (yashil / sariq / qizil)',
    gradient: 'from-sky-600 via-blue-500 to-indigo-500',
    border: 'border-sky-200',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-700',
    Icon: BarChart3,
    items: [
      { name: '01_bolim_umumiy.png', file: '05_diagrammalar_anketa/01_bolim_umumiy.png', icon: Image, desc: '1-bo\'lim' },
      { name: '02_bolim_mehnat.png', file: '05_diagrammalar_anketa/02_bolim_mehnat.png', icon: Image, desc: '2-bo\'lim' },
      { name: '03_bolim_jismoniy.png', file: '05_diagrammalar_anketa/03_bolim_jismoniy.png', icon: Image, desc: '3-bo\'lim' },
      { name: '04_bolim_hayot.png', file: '05_diagrammalar_anketa/04_bolim_hayot.png', icon: Image, desc: '4-bo\'lim' },
      { name: '05_bolim_tibbiy.png', file: '05_diagrammalar_anketa/05_bolim_tibbiy.png', icon: Image, desc: '5-bo\'lim' },
      { name: '06_bolim_ovqat.png', file: '05_diagrammalar_anketa/06_bolim_ovqat.png', icon: Image, desc: '6-bo\'lim' },
      { name: '07_bolim_taklif.png', file: '05_diagrammalar_anketa/07_bolim_taklif.png', icon: Image, desc: '7-bo\'lim' },
      { name: '08_xavf_zonasi.png', file: '05_diagrammalar_anketa/08_xavf_zonasi.png', icon: Image, desc: 'Yashil / sariq / qizil' },
    ],
  },
];

const STATS = [
  { label: 'Namuna (N)', value: '400', color: 'bg-indigo-500' },
  { label: 'Jami anketa', value: '698', color: 'bg-blue-500' },
  { label: 'ICD sinflar', value: '19', color: 'bg-violet-500' },
  { label: 'Fayllar', value: '20+', color: 'bg-emerald-500' },
];

interface AdminReportsPanelProps {
  language?: 'lotin' | 'kirill';
}

export default function AdminReportsPanel({ language = 'lotin' }: AdminReportsPanelProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadFile = async (file: string, label: string) => {
    setDownloading(file);
    try {
      const url = `${BASE}/${file.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${label} topilmadi (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.split('/').pop() || file;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Yuklab olishda xato');
    } finally {
      setDownloading(null);
    }
  };

  const totalFiles = REPORT_FILES.reduce((s, g) => s + g.items.length, 0);

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggIGQ9Ik0zNiAzNGg2djZoLTZ6TTAgMzRoNnY2SDB6TTAgMGg2djZIMHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0 border border-white/20">
              <FolderArchive className="w-7 h-7 text-amber-300" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 mb-1">
                Farg&apos;ona IEM · N=400
              </p>
              <h2 className="text-xl font-extrabold leading-tight">
                {t('N=400 tayyor hisobotlar', language)}
              </h2>
              <p className="text-sm text-indigo-200/90 mt-2 max-w-xl leading-relaxed">
                Tartibli papkalar: asosiy hisobotlar, 4.2-jadval (M±m), ilmiy statistika,
                diagrammalar va ma&apos;lumotnoma. Foizlar saqlangan, 95% CI qo&apos;shilgan.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span className="text-xs font-bold text-emerald-200">{totalFiles} fayl tayyor</span>
          </div>
        </div>

        {/* Stat cards */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-xl bg-white/10 backdrop-blur border border-white/10 px-4 py-3"
            >
              <div className={`w-2 h-2 rounded-full ${s.color} mb-2`} />
              <p className="text-2xl font-black">{s.value}</p>
              <p className="text-[10px] text-indigo-300 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Info boxes */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex gap-3 text-xs text-blue-900">
          <Info className="w-5 h-5 shrink-0 text-blue-600" />
          <div>
            <p className="font-bold mb-1">Excel tahlil (AI)</p>
            <p>
              «Excel tahlil» tabiga <code className="bg-white px-1 rounded text-[10px]">Dissertatsiya_Tahlil_N400.xlsx</code> yuklang.
            </p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex gap-3 text-xs text-rose-900">
          <Table2 className="w-5 h-5 shrink-0 text-rose-600" />
          <div>
            <p className="font-bold mb-1">4.2-jadval (yangi)</p>
            <p>
              ICD × Hodisa/Nazorat — <strong>29 ± 1,2</strong> formatida 100 ishchiga MVL holatlari va kunlari.
            </p>
          </div>
        </div>
      </div>

      {/* Report groups */}
      {REPORT_FILES.map((group) => {
        const GroupIcon = group.Icon;
        return (
          <section
            key={group.id}
            className={`bg-white rounded-2xl border ${group.border} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className={`px-5 py-4 bg-gradient-to-r ${group.gradient} text-white`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <GroupIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">{group.group}</h3>
                  <p className="text-[11px] text-white/80 mt-0.5">{group.subtitle}</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {group.items.map((item) => {
                const Icon = item.icon;
                const busy = downloading === item.file;
                return (
                  <div
                    key={item.file}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg ${group.iconBg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4 h-4 ${group.iconColor}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-slate-800">{item.name}</p>
                          {item.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => downloadFile(item.file, item.name)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold shadow-sm hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {busy ? 'Yuklanmoqda...' : 'Yuklab olish'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Folder map */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-bold text-slate-700 mb-3">Papka tuzilmasi (public/reports/n400/)</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[10px] font-mono text-slate-600">
          {[
            '01_asosiy_hisobotlar/',
            '02_ilmiy_statistika/',
            '03_jadval_4_2/',
            '04_diagrammalar_dissertatsiya/',
            '05_diagrammalar_anketa/',
            '06_malumotnoma/',
          ].map((f) => (
            <div key={f} className="px-2 py-1.5 bg-white rounded-lg border border-slate-200">
              📁 {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
