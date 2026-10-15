import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, CircleSlash, FileSearch, XCircle } from 'lucide-react';
import { formatNum, ZONE_STYLE, type Criterion, type Evidence, type Zone } from '../lib/riskEvidence';

interface RiskEvidencePanelProps {
  evidence: Evidence;
  /** Server hisoblagan ball va zona (formulasi backend'da) */
  serverBall?: number | null;
  serverZona?: string | null;
}

const ZONE_TITLE: Record<Zone, string> = { qizil: 'QIZIL', sariq: 'SARIQ', yashil: 'YASHIL' };

function Section({
  n,
  title,
  defaultOpen = false,
  children,
}: {
  n: number;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-slate-800 hover:bg-slate-50 rounded-xl"
      >
        {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
        <span className="text-indigo-600 font-mono">{n}.</span> {title}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

function Mark({ met }: { met: boolean | null }) {
  if (met === true) return <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" aria-label="bajarildi" />;
  if (met === false) return <XCircle className="w-4 h-4 text-slate-400 inline" aria-label="bajarilmadi" />;
  return <CircleSlash className="w-4 h-4 text-slate-300 inline" aria-label="ma'lumot yo'q" />;
}

const th = 'p-1.5 text-left border bg-slate-100 text-slate-600 font-semibold';
const td = 'p-1.5 border align-top';

function CriteriaTable({ rows }: { rows: Criterion[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr>
            <th className={th}>Mezon</th>
            <th className={th}>Chegara</th>
            <th className={th}>Xodimda</th>
            <th className={`${th} text-center`}>Natija</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={i} className={c.met === true ? 'bg-amber-50/60 font-semibold' : ''}>
              <td className={td}>{c.label}</td>
              <td className={`${td} font-mono`}>{c.rule}</td>
              <td className={td}>{c.actual}</td>
              <td className={`${td} text-center`}>
                <Mark met={c.met} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RiskEvidencePanel({ evidence: ev, serverBall, serverZona }: RiskEvidencePanelProps) {
  const zs = ev.zone ? ZONE_STYLE[ev.zone] : null;
  const fr = ev.framingham;
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <div className="flex items-center gap-3 border-b pb-3">
        <FileSearch className="w-6 h-6 text-indigo-600" />
        <div>
          <h3 className="font-extrabold text-slate-900">Hisob-kitob isboti</h3>
          <p className="text-xs text-slate-500">
            Har bir ko'rsatkich qaysi javobdan, qaysi formula bilan chiqqani — qadam-baqadam
          </p>
        </div>
      </div>

      <div
        className="p-4 rounded-xl border-2"
        style={{ borderColor: zs?.color ?? '#cbd5e1', background: zs?.bg ?? '#f8fafc' }}
      >
        <p className="text-[10px] uppercase font-bold text-slate-500">Zona (hujjatdagi mezonlar bo'yicha)</p>
        <p className="text-xl font-black" style={{ color: zs?.color ?? '#475569' }}>
          {ev.zone ? ZONE_TITLE[ev.zone] : 'ANIQLANMADI'}
        </p>
        {zs && <p className="text-xs font-semibold" style={{ color: zs.color }}>{zs.label}</p>}
        <p className="text-xs text-slate-700 mt-2">{ev.zoneReason}</p>
        <p className="text-[11px] text-slate-500 mt-2">
          Qoida: avval qizil mezonlar tekshiriladi. Birortasi bajarilsa — qizil. Aks holda sariq mezonlar: birortasi
          bajarilsa — sariq. Yashil zona uchun yashil shartlarning hammasi bajarilishi kerak.
        </p>
      </div>

      <Section n={1} title="Kiritilgan ma'lumotlar va tekshiruv (validatsiya)">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr>
                <th className={th}>Ko'rsatkich</th>
                <th className={th}>Qiymat</th>
                <th className={th}>Manba</th>
                <th className={th}>Holat</th>
              </tr>
            </thead>
            <tbody>
              {ev.facts.map((f) => (
                <tr key={f.key} className={f.status === 'xato' ? 'bg-red-50' : f.status === 'yoq' ? 'text-slate-400' : ''}>
                  <td className={`${td} font-semibold`}>{f.label}</td>
                  <td className={td}>{f.value || '—'}</td>
                  <td className={td}>{f.source}</td>
                  <td className={td}>
                    {f.status === 'ok' ? 'Qabul qilindi' : f.status === 'yoq' ? "Kiritilmagan" : `Xato: ${f.note}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500">
          Ruxsat etilgan oraliqdan tashqaridagi qiymat (masalan, yosh 999 yoki bosim 0) xato deb topiladi va hisobga
          olinmaydi.
        </p>
      </Section>

      <Section n={2} title="Klinik hisob-kitoblar (TVI, qon bosimi)">
        {ev.steps.map((s, i) => (
          <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
            <p className="font-bold text-slate-800">{s.title}</p>
            <p className="font-mono text-[11px]">Formula: {s.formula}</p>
            <p className="font-mono text-[11px]">Qo'yilgan qiymatlar: {s.substitution}</p>
            <p className="font-semibold text-indigo-800">Natija: {s.result}</p>
          </div>
        ))}
      </Section>

      <Section n={3} title="Integral ballar (Ha = 2, Ba'zan = 1, Yo'q = 0)">
        {ev.scores.map((s) => (
          <div key={s.key} className="space-y-1">
            <p className="text-xs font-bold text-slate-800">{s.label}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr>
                    <th className={th}>Savol</th>
                    <th className={th}>Javob</th>
                    <th className={`${th} text-center`}>Ball / maks.</th>
                  </tr>
                </thead>
                <tbody>
                  {s.items.map((it) => (
                    <tr key={it.savol}>
                      <td className={td}>
                        {it.savol}. {it.savolMatn}
                      </td>
                      <td className={td}>{it.javob}</td>
                      <td className={`${td} text-center font-mono`}>
                        {it.ball} / {it.max}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="font-mono text-[11px] bg-indigo-50 border border-indigo-100 rounded px-2 py-1 text-indigo-900">
              Integral ball = Σ ball / Σ maks. × 10 = {s.formula}
              {s.daraja && ` → ${s.daraja === 'past' ? 'past (0–3)' : s.daraja === 'ortacha' ? "o'rtacha (4–7)" : 'yuqori (8–10)'}`}
            </p>
          </div>
        ))}
      </Section>

      <Section n={4} title="A guruhi xavf omillari (1 / 0 kodlash)">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr>
                <th className={th}>Omil</th>
                <th className={th}>Qoida</th>
                <th className={th}>Dalil</th>
                <th className={`${th} text-center`}>Qiymat</th>
              </tr>
            </thead>
            <tbody>
              {ev.factors.map((f) => (
                <tr key={f.key} className={f.value === 1 ? 'bg-amber-50/60' : ''}>
                  <td className={`${td} font-semibold`}>{f.label}</td>
                  <td className={td}>{f.rule}</td>
                  <td className={td}>{f.evidence}</td>
                  <td className={`${td} text-center font-mono font-bold`}>{f.value ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section n={5} title="Kasbiy xavf: Fine-Kinney (R = P × E × C)">
        {ev.fk.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>Omil</th>
                  <th className={th}>Manba va javob</th>
                  <th className={`${th} text-center`}>P</th>
                  <th className={`${th} text-center`}>E</th>
                  <th className={`${th} text-center`}>C</th>
                  <th className={`${th} text-center`}>R = P×E×C</th>
                  <th className={th}>Standart sinf</th>
                </tr>
              </thead>
              <tbody>
                {ev.fk.rows.map((r, i) => (
                  <tr key={i}>
                    <td className={`${td} font-semibold`}>{r.omil}</td>
                    <td className={td}>
                      {r.manba}: "{r.javob}"
                    </td>
                    <td className={`${td} text-center font-mono`}>{formatNum(r.P, r.P % 1 ? 1 : 0)}</td>
                    <td className={`${td} text-center font-mono`}>{r.E}</td>
                    <td className={`${td} text-center font-mono`}>{r.C}</td>
                    <td className={`${td} text-center font-mono font-bold`}>{formatNum(r.R, r.R % 1 ? 1 : 0)}</td>
                    <td className={td}>{r.sinf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="font-mono text-[11px] bg-indigo-50 border border-indigo-100 rounded px-2 py-1 text-indigo-900">
          {ev.fk.formula}
        </p>
        <p className="text-[11px] text-slate-500">
          P — xavf yuzaga kelish ehtimolligi, E — ta'sir chastotasi, C — oqibat og'irligi (Fine-Kinney standart
          shkalalari). Javobni P, E, C qiymatlariga bog'lash ekspert baholash jadvali bo'lib, dissertatsiya muallifi
          tasdiqlashi kerak. Zona chegaralari hujjatdan: R_itog &lt; 20 yashil, 20 dan yuqori sariq, ≥ 1800 qizil.
          Hujjatda 70 dan 1800 gacha oraliq uchun alohida chegara yo'q, shuning uchun bu oraliq sariq hisoblanadi.
        </p>
      </Section>

      <Section n={6} title="Umumiy yurak-qon tomir xavfi — Framingham, 10 yil">
        {fr.ok ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr>
                    <th className={th}>O'zgaruvchi ({fr.sex})</th>
                    <th className={th}>x</th>
                    <th className={`${th} text-center`}>β</th>
                    <th className={`${th} text-center`}>β × x</th>
                  </tr>
                </thead>
                <tbody>
                  {fr.terms.map((t) => (
                    <tr key={t.label}>
                      <td className={`${td} font-semibold`}>{t.label}</td>
                      <td className={`${td} font-mono`}>{t.x}</td>
                      <td className={`${td} text-center font-mono`}>{t.beta}</td>
                      <td className={`${td} text-center font-mono`}>{t.product.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="font-mono text-[11px] bg-indigo-50 border border-indigo-100 rounded px-2 py-1.5 text-indigo-900 space-y-0.5">
              <p>Σ β·x = {fr.sum!.toFixed(4)}</p>
              <p>
                Xavf = 1 − S₀^exp(Σ β·x − o'rtacha) = 1 − {fr.s0}^exp({fr.sum!.toFixed(4)} − {fr.mean}) = 1 −{' '}
                {fr.s0}^{Math.exp(fr.sum! - fr.mean!).toFixed(4)} = 1 −{' '}
                {Math.pow(fr.s0!, Math.exp(fr.sum! - fr.mean!)).toFixed(4)}
              </p>
              <p className="font-bold">= {formatNum(fr.risk!)}% (10 yil ichida yurak-qon tomir kasalligi ehtimoli)</p>
            </div>
            <p className="text-[11px] text-slate-600">
              Chegara (hujjatdan): &lt; 5% yashil · 5–20% sariq · &gt; 20% qizil.
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-600">{fr.reason}</p>
        )}
        <ul className="text-[11px] text-slate-500 list-disc pl-4 space-y-0.5">
          {fr.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </Section>

      <Section n={7} title="Zona mezonlari — bittalab tekshiruv" defaultOpen>
        {(['qizil', 'sariq', 'yashil'] as Zone[]).map((z) => (
          <div key={z} className="space-y-1">
            <p className="text-xs font-black" style={{ color: ZONE_STYLE[z].color }}>
              {ZONE_TITLE[z]} zona mezonlari{z === 'yashil' ? ' (hammasi bajarilishi kerak)' : ' (birortasi yetarli)'}
            </p>
            <CriteriaTable rows={ev.criteria.filter((c) => c.zone === z)} />
          </div>
        ))}
        <p className="text-[11px] text-slate-500 flex flex-wrap gap-3">
          <span><Mark met={true} /> bajarildi</span>
          <span><Mark met={false} /> bajarilmadi</span>
          <span><Mark met={null} /> ma'lumot yo'q yoki hisoblanmaydi</span>
        </p>
      </Section>

      {(serverBall !== undefined && serverBall !== null) || serverZona ? (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <b>Server balli:</b> {serverBall ?? '—'}
          {serverZona ? `, server zonasi: ${serverZona}` : ''}. Bu ball anketa yuborilganda serverda (backend) hisoblanadi.
          Uning formulasi server kodida, shu sahifada qayta hisoblab bo'lmaydi. Yuqoridagi zona esa mijoz hujjatidagi
          mezonlar bo'yicha shu sahifada hisoblangan va har bir qadami ko'rsatilgan.
          {serverZona && ev.zone && serverZona.toLowerCase() !== ev.zone && (
            <span className="block mt-1 font-semibold text-amber-800">
              Diqqat: server zonasi ({serverZona}) hujjat mezonlari bo'yicha zonadan ({ev.zone}) farq qiladi.
            </span>
          )}
        </div>
      ) : null}
    </section>
  );
}
