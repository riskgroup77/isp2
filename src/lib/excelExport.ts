import * as XLSX from 'xlsx';
import type { SurveyResponseOut } from '../types/api';
import { getRespondentName } from './surveyFilter';

export function exportSurveysToExcel(
  surveys: SurveyResponseOut[],
  filename?: string
): void {
  if (!surveys || surveys.length === 0) {
    throw new Error("Eksport qilish uchun natijalar yo'q");
  }

  const rows = surveys.map((s) => {
    const tahlil = s.ai_response;
    return {
      'F.I.SH.': getRespondentName(s),
      'User ID': s.user_id,
      'Sana': new Date(s.created_at).toLocaleString('uz-UZ'),
      'Xavf %': tahlil?.riskFoizi ?? s.score_total,
      'Zona': s.risk_zonasi || tahlil?.zona || '',
      'TMI': tahlil?.tmi ?? '',
      'Javoblar soni': s.answered_count,
      'Klinik xulosa': (tahlil?.klinikXulosa || s.klinik_xulosa || '').slice(0, 500),
      'AI xato': s.ai_xato || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 28 },
    { wch: 38 },
    { wch: 22 },
    { wch: 10 },
    { wch: 12 },
    { wch: 8 },
    { wch: 12 },
    { wch: 60 },
    { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "So'rovnomalar");

  const detailRows: Record<string, string | number>[] = [];
  surveys.forEach((s) => {
    Object.entries(s.answers).forEach(([qId, ans]) => {
      const val = Array.isArray(ans) ? ans.join(', ') : String(ans ?? '');
      detailRows.push({
        'F.I.SH.': getRespondentName(s),
        'Savol ID': qId,
        Javob: val,
        Sana: new Date(s.created_at).toLocaleDateString('uz-UZ'),
      });
    });
  });
  if (detailRows.length > 0) {
    const ws2 = XLSX.utils.json_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Javoblar');
  }

  const name =
    filename ||
    `EnergoHealth_So_rovnomalar_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, name);
}

export function exportJournalToExcel(
  entries: Array<Record<string, unknown>>,
  filename?: string
): void {
  if (!entries.length) {
    throw new Error("Eksport qilish uchun kundalik yozuvlari yo'q");
  }
  const ws = XLSX.utils.json_to_sheet(entries);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kundalik');
  XLSX.writeFile(
    wb,
    filename || `Salomatlik_Kundaligi_${new Date().toISOString().split('T')[0]}.xlsx`
  );
}
