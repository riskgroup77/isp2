import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { computeDiseasePrognoses, MIN_KNOWN_FACTORS, zonaColor } from '../lib/diseaseRisk';
import type { Evidence } from '../lib/riskEvidence';

interface DiseaseRiskPrognosisProps {
  evidence: Evidence;
  title?: string;
}

const ZONA_LABELS: Record<string, string> = {
  past: 'Past xavf (< 20%)',
  ortacha: "O'rtacha xavf (20–44%)",
  yuqori: 'Yuqori xavf (45–69%)',
  juda_yuqori: 'Juda yuqori xavf (≥ 70%)',
};

export default function DiseaseRiskPrognosis({
  evidence,
  title = 'Kasallik risk prognozlari',
}: DiseaseRiskPrognosisProps) {
  const prognoses = useMemo(() => computeDiseasePrognoses(evidence), [evidence]);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const highRisk = prognoses.filter((p) => p.zona === 'yuqori' || p.zona === 'juda_yuqori');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-3 border-b pb-3">
        <Activity className="w-6 h-6 text-indigo-600" />
        <div>
          <h3 className="font-extrabold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">
            Har bir kasallik bo'yicha xavf indeksi — omillar balli asosida, isboti har bir kartada
          </p>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
        <p>
          <b>Usul:</b> ballar yordamida baholash (skoring). Har bir xavf omili kodlanadi: <b>0</b> — yo'q,{' '}
          <b>1</b> — o'rtacha, <b>2</b> — kuchli ifodalangan.
        </p>
        <p className="font-mono text-[11px] bg-white border border-slate-200 rounded px-2 py-1 inline-block">
          Xavf indeksi = Σ ball / (2 × ma'lumoti bor omillar soni) × 100%
        </p>
        <p>
          Ma'lumoti yo'q omil hisobga olinmaydi. Kamida {MIN_KNOWN_FACTORS} ta omil bo'yicha ma'lumot bo'lmasa, indeks
          hisoblanmaydi. Indeks omillar ulushini ko'rsatadi, kasallik yuzaga kelish ehtimoli emas. Ehtimollik
          (10 yillik xavf) "Hisob-kitob isboti"dagi Framingham bo'limida.
        </p>
      </div>

      {highRisk.length > 0 && (
        <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {highRisk.length} ta kasallik bo'yicha yuqori xavf indeksi aniqlandi. Profilaktik choralar tavsiya etiladi.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {prognoses.map((p) => {
          const isOpen = !!open[p.kasallik.id];
          return (
            <div key={p.kasallik.id} className="rounded-xl border border-slate-200 p-4 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-800">{p.kasallik.nomi}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">{p.kasallik.tavsif}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg font-black" style={{ color: zonaColor(p.zona) }}>
                    {p.xavfFoizi === null ? '—' : `${p.xavfFoizi}%`}
                  </span>
                  <p className="text-[9px] font-bold uppercase" style={{ color: zonaColor(p.zona) }}>
                    {p.zona ? ZONA_LABELS[p.zona] : "Ma'lumot yetarli emas"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{p.prognoz}</p>
              {p.tavsiyalar.length > 0 && (
                <ul className="text-[10px] text-slate-600 space-y-0.5">
                  {p.tavsiyalar.map((t, i) => (
                    <li key={i}>• {t}</li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [p.kasallik.id]: !isOpen }))}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900"
              >
                {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Isbot: qanday hisoblandi
              </button>
              {isOpen && (
                <div className="space-y-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600">
                          <th className="p-1.5 text-left border">Omil</th>
                          <th className="p-1.5 text-left border">Dalil (javob / qiymat va qoida)</th>
                          <th className="p-1.5 text-center border">Ball</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.omillar.map((o) => (
                          <tr key={o.key} className={o.ball === null ? 'text-slate-400' : ''}>
                            <td className="p-1.5 border font-semibold">{o.label}</td>
                            <td className="p-1.5 border">{o.dalil}</td>
                            <td className="p-1.5 border text-center font-mono font-bold">
                              {o.ball === null ? '—' : o.ball}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="font-mono text-[11px] bg-indigo-50 border border-indigo-100 rounded px-2 py-1.5 text-indigo-900 break-words">
                    {p.formula}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
