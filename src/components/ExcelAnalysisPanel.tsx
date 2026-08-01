import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { analyzeExcel } from '../lib/api';
import { formatApiError } from '../lib/surveyUtils';
import type { ExcelAnalysisResponse, ManbaTuri } from '../types/api';
import AnketaTahlilPanel from './AnketaTahlilPanel';
import { t } from '../lib/lang';

const MAX_BYTES = 30 * 1024 * 1024;

const MANBA_TURI_LABELS: Record<string, string> = {
  milliy_standart: 'Milliy standart',
  xalqaro: 'Xalqaro',
  ilmiy_adabiyot: 'Ilmiy adabiyot',
  statistika: 'Statistika',
  gemini_tahlil: 'Gemini AI tahlil',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface ExcelAnalysisPanelProps {
  language?: 'lotin' | 'kirill';
}

export default function ExcelAnalysisPanel({ language = 'lotin' }: ExcelAnalysisPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [izoh, setIzoh] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressHint, setProgressHint] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ExcelAnalysisResponse | null>(null);

  const validateFile = (selected: File): string | null => {
    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      return 'Faqat .xlsx formatdagi Excel fayllar qabul qilinadi.';
    }
    if (selected.size > MAX_BYTES) {
      return `Fayl hajmi ${formatFileSize(selected.size)} — maksimal 30 MB ruxsat etilgan.`;
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setErrorMsg(null);
    setResult(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const err = validateFile(selected);
    if (err) {
      setErrorMsg(err);
      setFile(null);
      e.target.value = '';
      return;
    }
    setFile(selected);
  };

  const clearFile = () => {
    setFile(null);
    setResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (!file) {
      setErrorMsg('Avval Excel faylni tanlang.');
      return;
    }
    const err = validateFile(file);
    if (err) {
      setErrorMsg(err);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setResult(null);
    setProgressHint('Excel o\'qilmoqda va AI tahlil bajarilmoqda...');

    const slowTimer = window.setTimeout(() => {
      setProgressHint('Katta fayllar uchun 30–180 soniya kutish mumkin. Iltimos, kuting...');
    }, 8000);

    try {
      const data = await analyzeExcel(file, izoh.trim() || undefined);
      setResult(data);
    } catch (err) {
      setErrorMsg(formatApiError(err));
    } finally {
      window.clearTimeout(slowTimer);
      setLoading(false);
      setProgressHint('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {t('Excel yuklash va AI tahlil', language)}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Anketa statistikasi Excel faylini yuklang — AI barcha varaqlarni o&apos;qib umumiy tahlil beradi.
              Maksimal hajm: 30 MB · Timeout: 180 soniya.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
              Excel fayl (.xlsx)
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition ${
                file ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
                className="hidden"
                id="excel-upload-input"
                disabled={loading}
              />
              {!file ? (
                <label htmlFor="excel-upload-input" className="cursor-pointer block space-y-2">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">Fayl tanlash uchun bosing</p>
                  <p className="text-[10px] text-slate-400">.xlsx · max 30 MB</p>
                </label>
              ) : (
                <div className="flex items-center justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    disabled={loading}
                    className="p-2 rounded-lg hover:bg-white text-slate-500"
                    title="Faylni olib tashlash"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
              Qo&apos;shimcha izoh (ixtiyoriy)
            </label>
            <textarea
              value={izoh}
              onChange={(e) => setIzoh(e.target.value)}
              disabled={loading}
              rows={5}
              placeholder="Masalan: 2025-yil 1-chorak anketa natijalari, Farg'ona filiali..."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm resize-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!file || loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Tahlil qilinmoqda...
            </>
          ) : (
            <>
              <FileSpreadsheet className="w-4 h-4" />
              Tahlil qilish
            </>
          )}
        </button>

        {loading && progressHint && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {progressHint}
          </p>
        )}
      </div>

      {result && (
        <div className="space-y-6">
          {result.aiXato && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold text-amber-900 text-sm">AI tahlil qismida xato</p>
                <p className="text-xs text-amber-800 mt-1">{result.aiXato}</p>
              </div>
            </div>
          )}

          <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
              <div>
                <h3 className="font-extrabold text-slate-900">Tahlil natijasi</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{result.faylNomi}</p>
              </div>
              {result.varaqlar.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {result.varaqlar.map((v) => (
                    <span
                      key={v.nomi}
                      className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600"
                    >
                      {v.nomi}: {v.qatorlarSoni} qator
                    </span>
                  ))}
                </div>
              )}
            </div>

            {result.varaqlar.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-2 text-left border border-slate-200">Varaq</th>
                      <th className="p-2 text-left border border-slate-200">Qatorlar</th>
                      <th className="p-2 text-left border border-slate-200">Ustunlar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.varaqlar.map((v) => (
                      <tr key={v.nomi}>
                        <td className="p-2 border border-slate-200 font-bold">{v.nomi}</td>
                        <td className="p-2 border border-slate-200">{v.qatorlarSoni}</td>
                        <td className="p-2 border border-slate-200">{v.ustunlar.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {result.umumiyXulosa && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <h4 className="text-xs font-bold uppercase text-emerald-800 mb-2">Umumiy xulosa</h4>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {result.umumiyXulosa}
                </p>
              </div>
            )}
          </section>

          {result.statistikaXulosasi.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">
                Bo&apos;limlar bo&apos;yicha xulosa
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.statistikaXulosasi.map((block, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                    <h4 className="font-extrabold text-slate-900">{block.boLim}</h4>
                    {block.asosiyKoRsatkichlar.length > 0 && (
                      <ul className="space-y-1">
                        {block.asosiyKoRsatkichlar.map((k, j) => (
                          <li key={j} className="text-xs text-slate-600 flex gap-1.5">
                            <span className="text-emerald-600">•</span>
                            {k}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-sm text-slate-700 border-t pt-3">{block.xulosa}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {result.tahlil ? (
            <section className="space-y-3">
              <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">
                AI tahlil (anketa formatida)
              </h3>
              <AnketaTahlilPanel tahlil={result.tahlil} language={language} />
            </section>
          ) : (
            !result.aiXato && (
              <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl">
                AI tahlil obyekti qaytmadi, lekin umumiy xulosa va statistika mavjud.
              </p>
            )
          )}

          {result.formulalar.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b flex items-center gap-2">
                <Calculator className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">
                  Formulalar
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-3 text-left border border-slate-200">Nomi</th>
                      <th className="p-3 text-left border border-slate-200">Formula</th>
                      <th className="p-3 text-left border border-slate-200">Izoh</th>
                      <th className="p-3 text-left border border-slate-200">Qo&apos;llanilgan qism</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.formulalar.map((f, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 border border-slate-200 font-bold whitespace-nowrap">
                          {f.nomi}
                        </td>
                        <td className="p-3 border border-slate-200 font-mono text-indigo-700">
                          {f.formula}
                        </td>
                        <td className="p-3 border border-slate-200">{f.izoh}</td>
                        <td className="p-3 border border-slate-200">{f.qoLlanilganQism}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {result.manbalar.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">
                  Manbalar
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-3 text-left border border-slate-200">Nomi</th>
                      <th className="p-3 text-left border border-slate-200">Turi</th>
                      <th className="p-3 text-left border border-slate-200">Havola</th>
                      <th className="p-3 text-left border border-slate-200">Izoh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.manbalar.map((m, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 border border-slate-200 font-bold">{m.nomi}</td>
                        <td className="p-3 border border-slate-200">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                            {MANBA_TURI_LABELS[m.turi as ManbaTuri] || m.turi}
                          </span>
                        </td>
                        <td className="p-3 border border-slate-200">
                          {m.havola ? (
                            <a
                              href={m.havola}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:underline break-all"
                            >
                              {m.havola}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 border border-slate-200">{m.izoh}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
