import axios from 'axios';
import type {
  AdvisorChatResponse,
  ApiUserProfile,
  ClinicalData,
  ComplaintAnalysisResponse,
  DashboardStats,
  DoctorAdviceDraftResponse,
  DoctorAdviceSubmitResponse,
  ExcelAnalysisResponse,
  PatientListItem,
  Questionnaire,
  RegisterRequest,
  SurveyResponseOut,
  SurveySubmitResponse,
  TokenResponse,
} from '../types/api';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://api.energohealth-predict.uz';

const TOKEN_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/api/auth/login')) {
      clearTokens();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('login')) {
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
    }
    return Promise.reject(error);
  }
);

export function saveTokens(tokens: TokenResponse) {
  localStorage.setItem(TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function hasToken(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

// ── Auth ──────────────────────────────────────────────

export async function login(login: string, password: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/api/auth/login', { login, password });
  saveTokens(data);
  return data;
}

export async function register(payload: RegisterRequest): Promise<ApiUserProfile> {
  const { data } = await apiClient.post<ApiUserProfile>('/api/auth/register', payload);
  return data;
}

export async function getProfile(): Promise<ApiUserProfile> {
  const { data } = await apiClient.get<ApiUserProfile>('/api/auth/profile');
  return data;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/api/auth/logout');
  } finally {
    clearTokens();
  }
}

// ── Surveys ───────────────────────────────────────────

export async function getSurveyQuestions(): Promise<Questionnaire> {
  const { data } = await apiClient.get<Questionnaire>('/api/surveys/questions');
  return data;
}

export async function submitSurvey(
  answers: Record<string, unknown>,
  klinik: ClinicalData,
  skipAi = false
): Promise<SurveySubmitResponse> {
  const { data } = await apiClient.post<SurveySubmitResponse>('/api/surveys/submit', {
    answers,
    klinik,
    skip_ai: skipAi,
  });
  return data;
}

export async function reanalyzeSurvey(responseId: string): Promise<SurveySubmitResponse> {
  const { data } = await apiClient.post<SurveySubmitResponse>(
    `/api/surveys/responses/${responseId}/analyze`
  );
  return data;
}

export async function getMySurveys(): Promise<SurveyResponseOut[]> {
  const { data } = await apiClient.get<SurveyResponseOut[]>('/api/surveys/my');
  return data;
}

export async function getAllSurveyResponses(): Promise<SurveyResponseOut[]> {
  const { data } = await apiClient.get<SurveyResponseOut[]>('/api/surveys/responses');
  return data;
}

export async function getSurveyResponse(id: string): Promise<SurveyResponseOut> {
  const { data } = await apiClient.get<SurveyResponseOut>(`/api/surveys/responses/${id}`);
  return data;
}

// ── Doctor ────────────────────────────────────────────

export async function getDoctorPatients(params?: {
  search?: string;
  risk_zone_filter?: string;
}): Promise<PatientListItem[]> {
  const { data } = await apiClient.get<PatientListItem[]>('/api/doctor/patients', { params });
  return data;
}

export async function submitDoctorAdvice(payload: {
  patient_id: string;
  advice_text: string;
  recipe_json?: Record<string, unknown>;
}): Promise<DoctorAdviceSubmitResponse> {
  const { data } = await apiClient.post<DoctorAdviceSubmitResponse>(
    '/api/doctor/advice/submit',
    payload
  );
  return data;
}

// ── Admin ─────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await apiClient.get<DashboardStats>('/api/admin/dashboard-stats');
  return data;
}

export async function verifyDoctor(doctorId: string): Promise<Record<string, string>> {
  const { data } = await apiClient.put<Record<string, string>>(
    `/api/admin/verify-doctor/${doctorId}`
  );
  return data;
}

export async function getSystemLogs(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/api/admin/system-logs');
  return data;
}

const EXCEL_MAX_BYTES = 30 * 1024 * 1024;

export async function analyzeExcel(
  file: File,
  izoh?: string
): Promise<ExcelAnalysisResponse> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Faqat .xlsx formatdagi Excel fayllar qabul qilinadi.');
  }
  if (file.size > EXCEL_MAX_BYTES) {
    throw new Error('Fayl hajmi 30 MB dan oshmasligi kerak.');
  }

  const form = new FormData();
  form.append('file', file);

  const { data } = await apiClient.post<ExcelAnalysisResponse>(
    '/api/admin/statistics/excel/analyze',
    form,
    {
      params: izoh?.trim() ? { izoh: izoh.trim() } : undefined,
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
    }
  );
  return data;
}

// ── AI ────────────────────────────────────────────────

export async function analyzeComplaint(matn: string): Promise<ComplaintAnalysisResponse> {
  const { data } = await apiClient.post<ComplaintAnalysisResponse>('/api/ai/analyze-complaint', {
    matn,
  });
  return data;
}

export async function advisorChat(
  xabar: string,
  tarix: Array<{ role: string; content: string }> = []
): Promise<AdvisorChatResponse> {
  const { data } = await apiClient.post<AdvisorChatResponse>('/api/ai/advisor-chat', {
    xabar,
    tarix,
  });
  return data;
}

export async function doctorAdviceDraft(
  patientId: string,
  qoshimchaIzoh?: string
): Promise<DoctorAdviceDraftResponse> {
  const { data } = await apiClient.post<DoctorAdviceDraftResponse>(
    '/api/ai/doctor-advice-draft',
    { patient_id: patientId, qoshimcha_izoh: qoshimchaIzoh || null }
  );
  return data;
}

export async function predictRisk(payload: Record<string, unknown>) {
  const { data } = await apiClient.post('/api/ai/predict-risk', payload);
  return data;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const { data } = await apiClient.get<{ status?: string }>('/health', { timeout: 10000 });
    return data?.status === 'healthy' || data?.status === 'ok';
  } catch {
    return false;
  }
}

// ── Helpers ───────────────────────────────────────────

export function apiProfileToUser(profile: ApiUserProfile) {
  return {
    id: profile.id,
    login: profile.login,
    ism: profile.ism,
    rol: profile.rol,
    jins: profile.jins,
    yosh: profile.yosh,
    shifoxona: profile.shifoxona ?? undefined,
    mutaxassislik: profile.mutaxassislik ?? undefined,
    tasdiqlangan: profile.tasdiqlangan,
    created_at: profile.created_at,
    yaratilganSana: profile.created_at.split('T')[0],
  };
}
