import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { renderChart } from '../lib/chartSvg';
import {
  computeMorbidity,
  downloadMorbidityTemplate,
  importMorbidityFile,
  loadMorbidity,
  saveMorbidity,
  type MorbDataset,
} from '../lib/morbidity';
import {
  computeHygiene,
  downloadHygieneTemplate,
  importHygieneFile,
  loadHygiene,
  saveHygiene,
  type HygDataset,
} from '../lib/hygiene';
import { exportSectionsExcel, exportSectionsWord, type MetaRow } from '../lib/sectionExport';
import { APP_EXPORT_PREFIX } from '../lib/branding';
import StatTableCard from './StatTableCard';

type TKind = 'student' | 'welch';

export default function MorbidityHygienePanel() {
  const [tab, setTab] = useState<'morb' | 'hyg'>('morb');
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-rose-900 via-slate-900 to-teal-900 text-white rounded-2xl p-5 md:p-6 shadow-lg">
        <p className="text-[11px] font-bold uppercase tracking-widest text-rose-200">Import · biostatistika</p>
        <h2 className="text-xl md:text-2xl font-black mt-1">Kasallanish kartalari va gigiyenik o'lchovlar</h2>
        <p className="text-sm text-slate-300 mt-1 max-w-3xl">
          5 yillik vaqtincha mehnatga layoqatsizlik bilan kasallanish (16-VN) va ish joylaridagi instrumental o'lchovlarni Excel'dan yuklang —
          ekstensiv va intensiv ko'rsatkichlar, M ± m, σ, Styudent t, ANOVA va χ² avtomatik hisoblanadi.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {([
            ['morb', 'Kasallanish (5 yil)', Activity],
            ['hyg', "Gigiyenik o'lchovlar", FlaskConical],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition ${
                tab === id ? 'bg-white text-slate-900 border-white' : 'bg-white/10 border-white/20 hover:bg-white/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'morb' ? <MorbidityTab /> : <HygieneTab />}
    </div>
  );
}

// ── Umumiy kichik komponentlar ──

function ImportBar({
  onTemplate,
  onFile,
  busy,
  hasData,
  onClear,
}: {
  onTemplate: () => void;
  onFile: (f: File) => void;
  busy: boolean;
  hasData: boolean;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onTemplate}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50"
      >
        <Download className="w-4 h-4" />
        Shablonni yuklab olish
      </button>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        Excel faylni yuklash
      </button>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      {hasData && (
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm font-bold hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
          Ma'lumotni tozalash
        </button>
      )}
    </div>
  );
}

function ExportBar({ onExcel, onWord, busy }: { onExcel: () => void; onWord: () => void; busy: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onExcel} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
        <FileSpreadsheet className="w-4 h-4" />
        Excel
      </button>
      <button
        type="button"
        onClick={onWord}
        disabled={busy}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-bold hover:bg-blue-800 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        Word
      </button>
    </div>
  );
}

function Messages({ errors, warnings }: { errors: string[]; warnings: string[] }) {
  return (
    <>
      {errors.length > 0 && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs space-y-1 max-h-40 overflow-y-auto">
          {errors.slice(0, 50).map((e, i) => (
            <p key={i}>• {e}</p>
          ))}
          {errors.length > 50 && <p>… yana {errors.length - 50} ta</p>}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
          {warnings.map((w, i) => (
            <p key={i} className="flex gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {w}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

function TKindPicker({ value, onChange }: { value: TKind; onChange: (v: TKind) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <span className="font-bold text-slate-500 uppercase text-[10px]">Ikki guruh uchun t-mezoni:</span>
      {([
        ['student', 'Styudent (klassik)'],
        ['welch', 'Welch'],
      ] as const).map(([k, l]) => (
        <label key={k} className="flex items-center gap-1.5 cursor-pointer">
          <input type="radio" checked={value === k} onChange={() => onChange(k)} />
          {l}
        </label>
      ))}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

// ── Kasallanish ──

function MorbidityTab() {
  const [ds, setDs] = useState<MorbDataset | null>(() => loadMorbidity());
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [wordBusy, setWordBusy] = useState(false);
  const [base, setBase] = useState<100 | 1000>(100);
  const [includeSub, setIncludeSub] = useState(false);
  const [tKind, setTKind] = useState<TKind>('student');

  const update = (next: MorbDataset | null) => {
    setDs(next);
    saveMorbidity(next);
  };

  const onFile = async (f: File) => {
    setBusy(true);
    try {
      const res = await importMorbidityFile(f);
      setErrors(res.errors);
      if (res.dataset) update(res.dataset);
    } finally {
      setBusy(false);
    }
  };

  const result = useMemo(() => (ds ? computeMorbidity(ds, { base, includeSub, tKind, comma: true }) : null), [ds, base, includeSub, tKind]);
  const groupCols = useMemo(() => {
    if (!ds) return [] as string[];
    const gs = [...new Set(ds.records.map((r) => r.group))].filter((g) => g !== '');
    return gs.length ? gs : [''];
  }, [ds]);

  const setWorkers = (year: number, group: string, value: string) => {
    if (!ds) return;
    const n = value.trim() === '' ? null : Number(value.replace(',', '.'));
    const rest = ds.workers.filter((w) => !(w.year === year && w.group === group));
    update({ ...ds, workers: n === null || !Number.isFinite(n) || n <= 0 ? rest : [...rest, { year, group, workers: n }] });
  };

  const meta = (): MetaRow[] => [
    ['Manba fayl', ds?.name ?? ''],
    ['Format', ds?.source === '16-VN' ? '16-VN shakli (keng jadval)' : 'Import shabloni'],
    ['Yillar', result ? `${result.years[0]}–${result.years[result.years.length - 1]}` : ''],
    ['Ekstensiv ko\'rsatkich', "Kasallik sinfining barcha holatlar ichidagi ulushi, % (tuzilma)"],
    ['Intensiv ko\'rsatkich', `Holatlar (kunlar) soni / o'rtacha ro'yxatdagi ishchilar × ${base}`],
    ['1 holat davomiyligi', 'Kunlar soni / holatlar soni'],
    ['M ± m', "Yillar bo'yicha o'rtacha qiymat va standart xato (m = σ/√n)"],
    ['Testlar', `2 guruh — ${tKind === 'welch' ? 'Welch' : 'Styudent (klassik)'} t-mezoni; 3+ guruh — ANOVA; tuzilma — Pearson χ²; yillar bo'yicha darajalar — Puasson χ²`],
    ['Ahamiyatlilik', '* p<0,05; ** p<0,01; *** p<0,001'],
    ['Tuzilgan', new Date().toLocaleString('uz-UZ')],
  ];

  const sections = () => (result ? [{ title: 'Kasallanish (VMLK) tahlili', sheet: 'Kasallanish', tables: result.tables, charts: result.charts }] : []);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <p className="text-sm text-slate-600">
          Ikki xil fayl qabul qilinadi: <b>import shabloni</b> (yil × kasallik sinfi × holatlar/kunlar, ixtiyoriy guruh va ishchilar soni) yoki
          tayyor <b>16-VN shaklidagi jadval</b> (qatorlarda kasallik sinflari, ustunlarda "2020-yil", "2021-yil" …).
        </p>
        <ImportBar
          onTemplate={downloadMorbidityTemplate}
          onFile={onFile}
          busy={busy}
          hasData={!!ds}
          onClear={() => {
            if (window.confirm("Yuklangan kasallanish ma'lumotlari shu brauzerdan o'chirilsinmi?")) {
              update(null);
              setErrors([]);
            }
          }}
        />
        {ds && result && (
          <p className="text-xs text-slate-500">
            <b>{ds.name}</b> · {ds.source} · {result.years.length} yil ({result.years[0]}–{result.years[result.years.length - 1]}) ·{' '}
            {new Set(ds.records.map((r) => r.cls)).size} ta qator (sinf) · {ds.records.length} yozuv · ma'lumot shu brauzerda saqlanadi
          </p>
        )}
      </div>

      <Messages errors={errors} warnings={result?.warnings ?? []} />

      {ds && result && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">O'rtacha ro'yxatdagi ishchilar soni (intensiv ko'rsatkich uchun)</h3>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-slate-500">Yil</th>
                    {groupCols.map((g) => (
                      <th key={g || 'all'} className="p-2 text-left text-slate-500">
                        {g || 'Butun korxona'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.years.map((y) => (
                    <tr key={y}>
                      <td className="p-2 font-bold text-slate-700">{y}</td>
                      {groupCols.map((g) => (
                        <td key={g || 'all'} className="p-1">
                          <input
                            type="number"
                            min={0}
                            defaultValue={ds.workers.find((w) => w.year === y && w.group === g)?.workers ?? ''}
                            onBlur={(e) => setWorkers(y, g, e.target.value)}
                            placeholder="ishchilar"
                            className="w-28 px-2 py-1.5 rounded-lg border border-slate-200"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <span className="font-bold text-slate-500 uppercase text-[10px]">Intensiv asos:</span>
              {([100, 1000] as const).map((b) => (
                <label key={b} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={base === b} onChange={() => setBase(b)} />
                  {b} ishchiga {b === 1000 ? '(‰)' : ''}
                </label>
              ))}
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={includeSub} onChange={(e) => setIncludeSub(e.target.checked)} />
                "Ulardan" tafsilot qatorlarini ham ko'rsatish
              </label>
            </div>
            <TKindPicker value={tKind} onChange={setTKind} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-900">Natijalar</h3>
            <ExportBar
              busy={wordBusy}
              onExcel={() =>
                exportSectionsExcel(meta(), sections(), `${APP_EXPORT_PREFIX}_Kasallanish_${today()}.xlsx`, [
                  {
                    name: "Manba ma'lumot",
                    aoa: [
                      ['Yil', 'Kasallik sinfi', 'Satr kodi', 'Daraja', 'Holatlar', 'Kunlar', 'Guruh'],
                      ...ds.records.map((r) => [r.year, r.cls, r.code, r.level, r.cases, r.days ?? '', r.group]),
                    ],
                  },
                  { name: 'Ishchilar', aoa: [['Yil', 'Guruh', 'Ishchilar soni'], ...ds.workers.map((w) => [w.year, w.group, w.workers])] },
                ])
              }
              onWord={async () => {
                setWordBusy(true);
                try {
                  await exportSectionsWord('Vaqtincha mehnatga layoqatsizlik bilan kasallanish tahlili', meta(), sections(), `${APP_EXPORT_PREFIX}_Kasallanish_${today()}.docx`);
                } catch (e) {
                  setErrors([e instanceof Error ? e.message : 'Word fayl yaratilmadi']);
                } finally {
                  setWordBusy(false);
                }
              }}
            />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {result.charts.map((c, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden [&_svg]:w-full [&_svg]:h-auto"
                dangerouslySetInnerHTML={{ __html: renderChart(c).svg }}
              />
            ))}
          </div>
          {result.tables.map((t) => (
            <StatTableCard key={t.id} table={t} />
          ))}
        </>
      )}
    </div>
  );
}

// ── Gigiyena ──

function HygieneTab() {
  const [ds, setDs] = useState<HygDataset | null>(() => loadHygiene());
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [wordBusy, setWordBusy] = useState(false);
  const [tKind, setTKind] = useState<TKind>('student');

  const update = (next: HygDataset | null) => {
    setDs(next);
    saveHygiene(next);
  };

  const onFile = async (f: File) => {
    setBusy(true);
    try {
      const res = await importHygieneFile(f);
      setErrors(res.errors);
      if (res.dataset) update(res.dataset);
    } finally {
      setBusy(false);
    }
  };

  const result = useMemo(() => (ds ? computeHygiene(ds, { tKind, comma: true }) : null), [ds, tKind]);
  const meta = (): MetaRow[] => [
    ['Manba fayl', ds?.name ?? ''],
    ["O'lchovlar soni", ds?.records.length ?? 0],
    ['M ± m, σ', "O'rtacha qiymat, standart xato (m = σ/√n), o'rtacha kvadratik chetlanish"],
    ["Me'yorga mos emas", "Yuqori chegarali omillarda me'yordan oshgan, quyi chegaralilarda me'yordan past o'lchovlar ulushi, %"],
    ['Karralik', "O'rtacha qiymat / me'yor"],
    ['Testlar', `2 ish joyi — ${tKind === 'welch' ? 'Welch' : 'Styudent (klassik)'} t-mezoni; 3+ — ANOVA; me'yorga mos kelmaslik ulushi — Pearson χ²`],
    ['Ahamiyatlilik', '* p<0,05; ** p<0,01; *** p<0,001'],
    ['Tuzilgan', new Date().toLocaleString('uz-UZ')],
  ];
  const sections = () => (result ? [{ title: "Gigiyenik o'lchovlar tahlili", sheet: 'Gigiyena', tables: result.tables, charts: result.charts }] : []);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <p className="text-sm text-slate-600">
          Har bir qator — bitta o'lchov: ish joyi (sex), omil (shovqin, harorat, chang, yoritilganlik …), birlik, qiymat va me'yor (REM/PDU).
        </p>
        <ImportBar
          onTemplate={downloadHygieneTemplate}
          onFile={onFile}
          busy={busy}
          hasData={!!ds}
          onClear={() => {
            if (window.confirm("Yuklangan gigiyenik o'lchovlar shu brauzerdan o'chirilsinmi?")) {
              update(null);
              setErrors([]);
            }
          }}
        />
        {ds && result && (
          <p className="text-xs text-slate-500">
            <b>{ds.name}</b> · {ds.records.length} o'lchov · {result.factors.length} omil · {result.places.length} ish joyi · ma'lumot shu brauzerda saqlanadi
          </p>
        )}
        {ds && <TKindPicker value={tKind} onChange={setTKind} />}
      </div>

      <Messages errors={errors} warnings={result?.warnings ?? []} />

      {ds && result && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-900">Natijalar</h3>
            <ExportBar
              busy={wordBusy}
              onExcel={() =>
                exportSectionsExcel(meta(), sections(), `${APP_EXPORT_PREFIX}_Gigiyena_${today()}.xlsx`, [
                  {
                    name: "Manba ma'lumot",
                    aoa: [
                      ['Sana', 'Ish joyi', 'Omil', 'Birlik', 'Qiymat', "Me'yor", "Me'yor turi"],
                      ...ds.records.map((r) => [r.date, r.place, r.factor, r.unit, r.value, r.norm ?? '', r.normType === 'min' ? 'quyi' : 'yuqori']),
                    ],
                  },
                ])
              }
              onWord={async () => {
                setWordBusy(true);
                try {
                  await exportSectionsWord("Ish joylaridagi gigiyenik o'lchovlar tahlili", meta(), sections(), `${APP_EXPORT_PREFIX}_Gigiyena_${today()}.docx`);
                } catch (e) {
                  setErrors([e instanceof Error ? e.message : 'Word fayl yaratilmadi']);
                } finally {
                  setWordBusy(false);
                }
              }}
            />
          </div>
          {result.charts.map((c, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden [&_svg]:w-full [&_svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: renderChart(c).svg }}
            />
          ))}
          {result.tables.map((t) => (
            <StatTableCard key={t.id} table={t} />
          ))}
        </>
      )}
    </div>
  );
}
