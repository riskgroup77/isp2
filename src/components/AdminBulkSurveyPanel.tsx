import React, { useCallback, useRef, useState } from 'react';
import { Loader2, Play, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../lib/api';
import { generateSurveyAnswers, type WorkerRow } from '../lib/bulkSurveyGenerator';
import type { ClinicalData, Questionnaire } from '../types/api';

interface BulkLogEntry {
  row: number;
  login: string;
  ism: string;
  status: 'ok' | 'skip' | 'error';
  detail?: string;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseWorkersCsv(text: string): WorkerRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => headers.indexOf(name);

  const rowIdx = col('row');
  const ismIdx = col('ism');
  const loginIdx = col('login');
  const passIdx = col('password');
  const jinsIdx = col('jins');
  const yoshIdx = col('yosh');

  const workers: WorkerRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvLine(lines[i]);
    const login = c[loginIdx]?.trim();
    const password = c[passIdx]?.trim();
    if (!login || !password) continue;
    const jins = (c[jinsIdx]?.trim().toLowerCase() || '') === 'ayol' ? 'Ayol' : 'Erkak';
    const yosh = parseInt(c[yoshIdx] || '40', 10) || 40;
    const birthYear = new Date().getFullYear() - yosh;
    workers.push({
      row: parseInt(c[rowIdx] || String(i), 10) || i,
      ism: c[ismIdx]?.trim() || login,
      login,
      password,
      gender: jins,
      age: yosh,
      birth: `${birthYear}-06-15`,
      staj: Math.max(1, Math.min(30, Math.floor(yosh / 2))),
      job: 'Elektr sexi xodimi',
      kasb: 'Ishlab chiqarish ishchisi',
      sex: 'Elektr sexi',
    });
  }
  return workers;
}

async function loginWorker(login: string, password: string): Promise<string> {
  const { data } = await axios.post(`${API_BASE_URL}/api/auth/login`, { login, password });
  return data.access_token as string;
}

async function submitForWorker(
  token: string,
  answers: Record<string, unknown>,
  klinik: ClinicalData
): Promise<string> {
  const { data } = await axios.post(
    `${API_BASE_URL}/api/surveys/submit`,
    { answers, klinik, skip_ai: true },
    { headers: { Authorization: `Bearer ${token}` }, timeout: 120000 }
  );
  return data.response?.id || 'ok';
}

export default function AdminBulkSurveyPanel({
  questionnaire,
  onComplete,
}: {
  questionnaire: Questionnaire | null;
  onComplete?: () => void;
}) {
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, ok: 0, skip: 0, err: 0 });
  const [log, setLog] = useState<BulkLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseWorkersCsv(String(reader.result || ''));
      setWorkers(parsed);
      setError(parsed.length ? null : 'CSV dan xodimlar o\'qilmadi');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const runBulk = useCallback(async () => {
    if (!questionnaire || workers.length === 0) {
      setError("Avval CSV yuklang va savollar tayyor bo'lsin.");
      return;
    }
    stopRef.current = false;
    setRunning(true);
    setError(null);
    setLog([]);
    const total = workers.length;
    let ok = 0;
    let skip = 0;
    let err = 0;
    const entries: BulkLogEntry[] = [];

    for (let i = 0; i < workers.length; i++) {
      if (stopRef.current) break;
      const w = workers[i];
      setProgress({ done: i + 1, total, ok, skip, err });
      try {
        const token = await loginWorker(w.login, w.password);
        const { answers, clinical } = generateSurveyAnswers(questionnaire, w, w.row * 9973);
        await submitForWorker(token, answers, clinical);
        ok++;
        entries.push({ row: w.row, login: w.login, ism: w.ism, status: 'ok' });
      } catch (e: unknown) {
        const msg = axios.isAxiosError(e)
          ? JSON.stringify(e.response?.data || e.message)
          : String(e);
        if (/mavjud|already|409/i.test(msg)) {
          skip++;
          entries.push({ row: w.row, login: w.login, ism: w.ism, status: 'skip', detail: msg.slice(0, 80) });
        } else {
          err++;
          entries.push({ row: w.row, login: w.login, ism: w.ism, status: 'error', detail: msg.slice(0, 120) });
        }
      }
      setLog([...entries]);
      await new Promise((r) => setTimeout(r, 120));
    }

    setProgress({ done: total, total, ok, skip, err });
    setRunning(false);
    onComplete?.();
  }, [questionnaire, workers, onComplete]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <div>
        <h3 className="font-bold text-slate-800">Bulk anketa yuborish</h3>
        <p className="text-xs text-slate-500 mt-1">
          data/registered_workers.csv yoki energohealth_registered_workers.csv faylini yuklang.
        </p>
      </div>

      <label className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 cursor-pointer hover:bg-slate-50">
        <Upload className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-semibold text-slate-700">CSV yuklash (login + parol)</span>
        <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
      </label>

      {workers.length > 0 && (
        <p className="text-sm text-emerald-700 font-semibold">{workers.length} ta xodim yuklandi</p>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={running || !workers.length || !questionnaire}
          onClick={runBulk}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-bold disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? `Yuborilmoqda ${progress.done}/${progress.total}` : 'Bulk yuborishni boshlash'}
        </button>
        {running && (
          <button
            type="button"
            onClick={() => { stopRef.current = true; }}
            className="px-4 py-2 rounded-xl border border-red-300 text-red-700 text-sm font-bold"
          >
            To'xtatish
          </button>
        )}
      </div>

      {progress.total > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="bg-emerald-50 rounded-xl p-2"><span className="font-black text-emerald-700">{progress.ok}</span> OK</div>
          <div className="bg-amber-50 rounded-xl p-2"><span className="font-black text-amber-700">{progress.skip}</span> Skip</div>
          <div className="bg-red-50 rounded-xl p-2"><span className="font-black text-red-700">{progress.err}</span> Xato</div>
        </div>
      )}

      {log.length > 0 && (
        <div className="max-h-48 overflow-y-auto text-xs space-y-1 border rounded-xl p-3">
          {log.slice(-20).map((e) => (
            <div key={`${e.row}-${e.login}`} className="flex gap-2">
              {e.status === 'ok' ? <CheckCircle className="w-3 h-3 text-emerald-600" /> : <AlertCircle className="w-3 h-3 text-red-500" />}
              <span>{e.ism} ({e.login}) — {e.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
