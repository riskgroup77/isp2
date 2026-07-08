import React, { useMemo } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import {
  computeDiseasePrognoses,
  zonaColor,
  type PrognosisInput,
} from '../lib/diseaseRisk';

interface DiseaseRiskPrognosisProps {
  input: PrognosisInput;
  title?: string;
}

const ZONA_LABELS: Record<string, string> = {
  past: 'Past xavf',
  ortacha: "O'rtacha xavf",
  yuqori: 'Yuqori xavf',
  juda_yuqori: 'Juda yuqori xavf',
};

export default function DiseaseRiskPrognosis({
  input,
  title = 'Kasallik risk prognozlari',
}: DiseaseRiskPrognosisProps) {
  const prognoses = useMemo(() => computeDiseasePrognoses(input), [input]);

  const highRisk = prognoses.filter(
    (p) => p.zona === 'yuqori' || p.zona === 'juda_yuqori'
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-3 border-b pb-3">
        <Activity className="w-6 h-6 text-indigo-600" />
        <div>
          <h3 className="font-extrabold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">
            Kasallik turlari bo'yicha 5 yillik rivojlanish xavfi prognozi
          </p>
        </div>
      </div>

      {highRisk.length > 0 && (
        <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {highRisk.length} ta kasallik bo'yicha yuqori xavf aniqlandi. Profilaktik choralar
            tavsiya etiladi.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {prognoses.map((p) => (
          <div
            key={p.kasallik.id}
            className="rounded-xl border border-slate-200 p-4 space-y-2 hover:shadow-sm transition"
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <h4 className="font-bold text-sm text-slate-800">{p.kasallik.nomi}</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">{p.kasallik.tavsif}</p>
              </div>
              <div className="text-right shrink-0">
                <span
                  className="text-lg font-black"
                  style={{ color: zonaColor(p.zona) }}
                >
                  {p.xavfFoizi}%
                </span>
                <p
                  className="text-[9px] font-bold uppercase"
                  style={{ color: zonaColor(p.zona) }}
                >
                  {ZONA_LABELS[p.zona]}
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
          </div>
        ))}
      </div>
    </div>
  );
}
