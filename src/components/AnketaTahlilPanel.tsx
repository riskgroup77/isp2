import React from 'react';
import { Activity, CheckCircle2, ListChecks, TrendingUp } from 'lucide-react';
import { getRiskZoneStyle } from '../lib/surveyUtils';
import type { ExcelAnalysisTahlil } from '../types/api';
import { t } from '../lib/lang';

interface AnketaTahlilPanelProps {
  tahlil: ExcelAnalysisTahlil;
  language?: 'lotin' | 'kirill';
}

function asText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function renderActionItem(item: unknown, index: number) {
  if (typeof item === 'string') {
    return (
      <li key={index} className="flex gap-2 text-sm text-slate-700">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <span>{item}</span>
      </li>
    );
  }
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const parts = ['bosqich', 'harakat', 'muddat', 'masul']
      .map((k) => obj[k])
      .filter(Boolean)
      .map(asText);
    const extra = Object.entries(obj)
      .filter(([k]) => !['bosqich', 'harakat', 'muddat', 'masul'].includes(k))
      .map(([k, v]) => `${k}: ${asText(v)}`);
    const text = [...parts, ...extra].join(' · ') || asText(item);
    return (
      <li key={index} className="flex gap-2 text-sm text-slate-700">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <span>{text}</span>
      </li>
    );
  }
  return null;
}

function renderTasirItem(item: unknown, index: number) {
  if (typeof item === 'string') {
    return (
      <div key={index} className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-sm text-indigo-900">
        {item}
      </div>
    );
  }
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    return (
      <div key={index} className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-sm">
        {Object.entries(obj).map(([k, v]) => (
          <p key={k} className="text-indigo-900">
            <span className="font-bold capitalize">{k}: </span>
            {asText(v)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function AnketaTahlilPanel({ tahlil, language = 'lotin' }: AnketaTahlilPanelProps) {
  const zoneStyle = getRiskZoneStyle(tahlil.zona);
  const shaxsiy = tahlil.shaxsiyTavsiyalar || {};

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className="p-5 rounded-2xl border-2 text-center bg-white"
          style={{ borderColor: zoneStyle.color }}
        >
          <Activity className="w-6 h-6 mx-auto mb-2" style={{ color: zoneStyle.color }} />
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('Risk zonasi', language)}</p>
          <p className="text-2xl font-black" style={{ color: zoneStyle.color }}>
            {tahlil.zona || '—'}
          </p>
          <p className="text-xs text-slate-600 mt-1">{zoneStyle.label}</p>
        </div>
        <div className="p-5 rounded-2xl border border-slate-200 bg-white text-center">
          <TrendingUp className="w-6 h-6 mx-auto mb-2 text-indigo-600" />
          <p className="text-[10px] uppercase font-bold text-slate-500">{t('Risk foizi', language)}</p>
          <p className="text-2xl font-black text-indigo-700">{tahlil.riskFoizi ?? '—'}%</p>
        </div>
        <div className="p-5 rounded-2xl border border-slate-200 bg-white text-center">
          <p className="text-[10px] uppercase font-bold text-slate-500">TMI</p>
          <p className="text-2xl font-black text-slate-800">{tahlil.tmi ?? '—'}</p>
          <p className="text-xs text-slate-500">{tahlil.tmiKategoriya || ''}</p>
        </div>
      </div>

      {tahlil.klinikXulosa && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-2 uppercase text-xs tracking-wider">
            {t('Klinik xulosa', language)}
          </h3>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{tahlil.klinikXulosa}</p>
        </section>
      )}

      {tahlil.faktorlar && tahlil.faktorlar.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-4 uppercase text-xs tracking-wider">
            {t('Xavf omillari', language)}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tahlil.faktorlar.map((f, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-sm text-slate-800">{f.nomi}</span>
                  <span className="text-xs font-mono font-bold text-indigo-600 shrink-0">
                    {f.tasirKuchi}%
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{f.tafsilot}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {Object.keys(shaxsiy).length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">
            {t('Shaxsiy tavsiyalar', language)}
          </h3>
          {Object.entries(shaxsiy).map(([key, val]) => (
            <div key={key} className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
              <p className="text-[10px] font-bold uppercase text-emerald-800">{key}</p>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{asText(val)}</p>
            </div>
          ))}
        </section>
      )}

      {tahlil.actionPlan && tahlil.actionPlan.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-3 uppercase text-xs tracking-wider flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-emerald-600" />
            Harakatlar rejasi
          </h3>
          <ul className="space-y-2">
            {tahlil.actionPlan.map((item, i) => renderActionItem(item, i))}
          </ul>
        </section>
      )}

      {tahlil.taxminiyTasir && tahlil.taxminiyTasir.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-3 uppercase text-xs tracking-wider">
            Taxminiy ta&apos;sir
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tahlil.taxminiyTasir.map((item, i) => renderTasirItem(item, i))}
          </div>
        </section>
      )}

      {tahlil.statistika?.matn && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-2 uppercase text-xs tracking-wider">Statistika</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{tahlil.statistika.matn}</p>
        </section>
      )}

      {tahlil.xulosaVaTavsiyalar && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
          <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">Xulosa va tavsiyalar</h3>
          {tahlil.xulosaVaTavsiyalar.xulosa && (
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{tahlil.xulosaVaTavsiyalar.xulosa}</p>
          )}
          {tahlil.xulosaVaTavsiyalar.tavsiyalar?.length ? (
            <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
              {tahlil.xulosaVaTavsiyalar.tavsiyalar.map((tv, i) => (
                <li key={i}>{tv}</li>
              ))}
            </ul>
          ) : null}
        </section>
      )}
    </div>
  );
}
