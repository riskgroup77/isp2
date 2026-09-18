import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Image,
  FolderArchive,
  Info,
} from 'lucide-react';
import { t } from '../lib/lang';

const BASE = '/reports/n400';

const REPORT_FILES = [
  {
    group: 'Asosiy hisobotlar',
    items: [
      { name: 'Dissertatsiya_Tahlil_N400.docx', file: 'Dissertatsiya_Tahlil_N400.docx', icon: FileText, desc: 'Dissertatsiya bob\'i (Word)' },
      { name: 'Dissertatsiya_Tahlil_N400.xlsx', file: 'Dissertatsiya_Tahlil_N400.xlsx', icon: FileSpreadsheet, desc: 'Dissertatsiya tahlili (Excel)' },
      { name: 'Anketa_Tahlili_N400.docx', file: 'Anketa_Tahlili_N400.docx', icon: FileText, desc: '7 bo\'lim + xavf zonasi (Word)' },
      { name: 'Anketa_Tahlili_N400.xlsx', file: 'Anketa_Tahlili_N400.xlsx', icon: FileSpreadsheet, desc: 'Anketa tahlili (Excel)' },
      { name: 'Anketa_Tahlili_Sex_Ishchilari.docx', file: 'Anketa_Tahlili_Sex_Ishchilari.docx', icon: FileText, desc: '7 jadval shablon formatida' },
      { name: 'Malumotnoma_Formulalar_N400.docx', file: 'Malumotnoma_Formulalar_N400.docx', icon: FileText, desc: 'Hisoblash formulalari va metodologiya (Word)' },
    ],
  },
  {
    group: 'Ilmiy-statistik tahlil (95% CI, p, OR)',
    items: [
      { name: 'Anketa_Ilmiy_Statistika_N400.docx', file: 'Anketa_Ilmiy_Statistika_N400.docx', icon: FileText, desc: 'Dissertatsiya/maqola uchun to\'liq statistika (Word)' },
      { name: 'Anketa_Ilmiy_Statistika_N400.xlsx', file: 'Anketa_Ilmiy_Statistika_N400.xlsx', icon: FileSpreadsheet, desc: '95% CI, p-qiymat, OR, Cronbach α (Excel)' },
    ],
  },
  {
    group: 'Diagrammalar — dissertatsiya',
    items: [
      { name: '01_kasallanishlar_strukturasi.png', file: 'diagrammalar/01_kasallanishlar_strukturasi.png', icon: Image, desc: 'Kasallanishlar pie' },
      { name: '02_icd_kasallik_sinflari.png', file: 'diagrammalar/02_icd_kasallik_sinflari.png', icon: Image, desc: 'ICD-10 barcha 19 sinf' },
      { name: '03_sexlar_taqsimoti.png', file: 'diagrammalar/03_sexlar_taqsimoti.png', icon: Image, desc: 'Sexlar taqsimoti' },
      { name: '04_jins_taqsimoti.png', file: 'diagrammalar/04_jins_taqsimoti.png', icon: Image, desc: 'Jins taqsimoti' },
      { name: '05_hodisa_nazorat.png', file: 'diagrammalar/05_hodisa_nazorat.png', icon: Image, desc: 'Hodisa / nazorat' },
    ],
  },
  {
    group: 'Diagrammalar — anketa (har bo\'lim)',
    items: [
      { name: '01_bolim_umumiy.png', file: 'diagrammalar_anketa/01_bolim_umumiy.png', icon: Image, desc: '1-bo\'lim' },
      { name: '02_bolim_mehnat.png', file: 'diagrammalar_anketa/02_bolim_mehnat.png', icon: Image, desc: '2-bo\'lim' },
      { name: '03_bolim_jismoniy.png', file: 'diagrammalar_anketa/03_bolim_jismoniy.png', icon: Image, desc: '3-bo\'lim' },
      { name: '04_bolim_hayot.png', file: 'diagrammalar_anketa/04_bolim_hayot.png', icon: Image, desc: '4-bo\'lim' },
      { name: '05_bolim_tibbiy.png', file: 'diagrammalar_anketa/05_bolim_tibbiy.png', icon: Image, desc: '5-bo\'lim' },
      { name: '06_bolim_ovqat.png', file: 'diagrammalar_anketa/06_bolim_ovqat.png', icon: Image, desc: '6-bo\'lim' },
      { name: '07_bolim_taklif.png', file: 'diagrammalar_anketa/07_bolim_taklif.png', icon: Image, desc: '7-bo\'lim' },
      { name: '08_xavf_zonasi.png', file: 'diagrammalar_anketa/08_xavf_zonasi.png', icon: Image, desc: 'Yashil / sariq / qizil' },
    ],
  },
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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <FolderArchive className="w-6 h-6 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {t('N=400 tayyor hisobotlar', language)}
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Farg&apos;ona IEM — 400 ta ishchi tahlili. ICD-10 barcha 19 sinfda kamida 1 holat.
              Kasalliklar jadvali jami n=400 (100%). Word, Excel va diagrammalarni yuklab oling
              yoki «Excel tahlil» bo&apos;limiga Excel faylni yuklang.
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200 flex gap-2 text-xs text-blue-900">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            <strong>Excel tahlil:</strong> «Excel tahlil» tabiga <code className="bg-white px-1 rounded">Dissertatsiya_Tahlil_N400.xlsx</code> yoki{' '}
            <code className="bg-white px-1 rounded">Anketa_Tahlili_N400.xlsx</code> yuklang — AI varaqlarni o&apos;qiydi.
          </p>
        </div>
      </div>

      {REPORT_FILES.map((group) => (
        <section key={group.group} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-slate-50 font-bold text-sm text-slate-800">
            {group.group}
          </div>
          <div className="divide-y">
            {group.items.map((item) => {
              const Icon = item.icon;
              const busy = downloading === item.file;
              return (
                <div
                  key={item.file}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-5 h-5 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">{item.name}</p>
                      <p className="text-[10px] text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => downloadFile(item.file, item.name)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {busy ? 'Yuklanmoqda...' : 'Yuklab olish'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
