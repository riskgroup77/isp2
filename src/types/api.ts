export type ApiUserRole = 'xodim' | 'shifokor' | 'admin';
export type Gender = 'erkak' | 'ayol';
export type RiskZone = 'yashil' | 'sariq' | 'sargish' | 'qizil';
export type QuestionType = 'single_choice' | 'multi_choice' | 'text' | 'number' | 'date';

export interface ShowIf {
  questionId: number | string;
  equals?: string;
  in?: string[];
}

export interface Question {
  id: number | string;
  text: string;
  type: QuestionType;
  section: string;
  options: string[];
  required: boolean;
  description?: string | null;
  showIf?: ShowIf | null;
}

export interface Questionnaire {
  version: string;
  title: string;
  totalQuestions: number;
  sections: string[];
  questions: Question[];
}

export interface ApiUserProfile {
  id: string;
  ism: string;
  login: string;
  rol: ApiUserRole;
  jins: Gender;
  yosh: number;
  shifoxona: string | null;
  mutaxassislik: string | null;
  tasdiqlangan: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterRequest {
  ism: string;
  login: string;
  password: string;
  rol: ApiUserRole;
  jins: Gender;
  yosh: number;
  shifoxona?: string | null;
  mutaxassislik?: string | null;
}

export interface ClinicalData {
  sistolik: number;
  diastolik: number;
  vazn: number;
  boy: number;
  glyukoza?: number;
  xolesterin?: number;
}

export interface RiskFactor {
  nomi: string;
  tafsilot: string;
  tasirKuchi: number;
  boshqariladimi: boolean;
}

export interface ReportStatistics {
  matn: string;
  koersatkichlar?: Record<string, unknown>;
}

export interface ReportCorrelation {
  matn: string;
  solishtirish: Array<{ omilA: string; omilB: string; tavsif: string }>;
}

export interface ReportConclusion {
  xulosa: string;
  tavsiyalar: string[];
}

export interface AIReport {
  tmi?: number | null;
  tmiKategoriya?: string | null;
  riskFoizi: number;
  zona: RiskZone | string;
  faktorlar?: RiskFactor[];
  shaxsiyTavsiyalar?: Record<string, string>;
  klinikXulosa?: string | null;
  statistika?: ReportStatistics | null;
  korrelyatsiya?: ReportCorrelation | null;
  natijalar?: string | null;
  munozara?: string | null;
  xulosaVaTavsiyalar?: ReportConclusion | null;
}

export interface SurveyResponseOut {
  id: string;
  user_id: string;
  version: string;
  answers: Record<string, unknown>;
  score_total: number;
  risk_zonasi?: RiskZone | string | null;
  klinik_xulosa?: string | null;
  shaxsiy_tavsiyalar?: Record<string, string> | null;
  ai_response?: AIReport | null;
  ai_xato?: string | null;
  answered_count: number;
  created_at: string;
}

export interface SurveySubmitResponse {
  message: string;
  bmi?: number | null;
  response: SurveyResponseOut;
  tahlil?: AIReport | null;
}

export interface PatientListItem {
  id: string;
  ism: string;
  login: string;
  yosh: number;
  jins: Gender;
  latest_risk_zone?: RiskZone | string | null;
  latest_risk_score?: number | null;
}

export interface DashboardStats {
  total_employees: number;
  high_risk_percentage: number;
  pending_doctors: number;
}

export interface ComplaintAnalysisResponse {
  aniqlanganParametrlar: Record<string, unknown>;
  tahlilMatni: string;
  tavsiyalar: string[];
  yanaMalumotKerakmi: boolean;
  aniqlashtiruvchiSavollar: string[];
}

export interface AdvisorChatResponse {
  javob: string;
  tarix: Array<{ role: string; content: string }>;
}

export interface DoctorAdviceDraftResponse {
  advice_text: string;
  recipe_json?: Record<string, unknown> | null;
  klinikXulosa?: string | null;
  tavsiyalar: string[];
}

export interface DoctorAdviceSubmitResponse {
  id: string;
  status: string;
}
