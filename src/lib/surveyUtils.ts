import type { Question } from '../types/api';

export function isQuestionVisible(q: Question, answers: Record<string, unknown>): boolean {
  if (!q.showIf) return true;
  const ref = String(q.showIf.questionId);
  const value = answers[ref];
  if (q.showIf.equals !== undefined) {
    if (Array.isArray(value)) return value.includes(q.showIf.equals);
    return value === q.showIf.equals;
  }
  if (q.showIf.in) {
    const current = Array.isArray(value) ? value : value != null ? [value] : [];
    return q.showIf.in.some((v) => current.includes(v));
  }
  return true;
}

export const RISK_ZONE_CONFIG: Record<string, { color: string; label: string; bg: string }> = {
  yashil: { color: '#22c55e', label: 'Past xavf', bg: 'bg-emerald-100' },
  sariq: { color: '#eab308', label: "O'rtacha xavf", bg: 'bg-yellow-100' },
  sargish: { color: '#f97316', label: 'Yuqori xavf', bg: 'bg-orange-100' },
  qizil: { color: '#ef4444', label: 'Juda yuqori xavf', bg: 'bg-red-100' },
};

export function getRiskZoneStyle(zona?: string | null) {
  return RISK_ZONE_CONFIG[zona || 'sariq'] || RISK_ZONE_CONFIG.sariq;
}

export function formatApiError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as { response?: { data?: { detail?: unknown }; status?: number }; code?: string; message?: string };
    const detail = axiosErr.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join('; ');
    }
    const status = axiosErr.response?.status;
    if (status === 401) return "Sessiya muddati tugagan. Qayta kiring.";
    if (status === 403) return "Ruxsat yo'q.";
    if (status === 429) return "Juda ko'p so'rov. Keyinroq urinib ko'ring.";
    if (status === 502) return 'API vaqtincha ishlamayapti (502 Bad Gateway). Keyinroq urinib ko\'ring.';
    if (status === 503) return 'AI vaqtincha ishlamayapti.';
    if (status === 504) return 'AI tahlil vaqti tugadi. Qayta urinib ko\'ring.';
    if (status && status >= 500) return `Server xatosi (${status}). Administrator bilan bog\'laning.`;
    if (!axiosErr.response) {
      if (axiosErr.code === 'ECONNABORTED') return 'So\'rov vaqti tugadi. Keyinroq urinib ko\'ring.';
      return 'Server bilan aloqa yo\'q. Internet yoki API holatini tekshiring.';
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return "Noma'lum xatolik yuz berdi.";
}
