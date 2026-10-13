import React from 'react';
import type { LiveTable } from '../lib/liveReport';

/** Statistik jadval kartasi: jami va ishonchli (p < 0,05) qatorlar qalin */
export default function StatTableCard({ table }: { key?: string; table: LiveTable }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="p-4 border-b border-slate-100">
        <h4 className="font-bold text-slate-800 text-sm">{table.title}</h4>
        {table.note && <p className="text-[11px] text-slate-500 mt-1">{table.note}</p>}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              {table.headers.map((h, i) => (
                <th key={i} className="text-left p-2.5 font-bold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, ri) => {
              const isTotal = table.totalRow && ri === table.rows.length - 1;
              const isSig = !!table.boldRows?.includes(ri);
              return (
                <tr
                  key={ri}
                  className={`border-b border-slate-100 ${isTotal ? 'bg-emerald-50 font-bold' : isSig ? 'bg-amber-50/60 font-bold' : 'hover:bg-slate-50'}`}
                >
                  {r.map((c, ci) => (
                    <td key={ci} className="p-2.5 text-slate-700 align-top whitespace-pre-wrap">
                      {c}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
