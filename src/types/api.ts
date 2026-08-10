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
  textCyrl?: string | null;
  type: QuestionType;
  section: string;
  sectionCyrl?: string | null;
  options: string[];
  optionsCyrl?: string[] | null;
  required: boolean;
  description?: string | null;
  descriptionCyrl?: string | null;
  showIf?: ShowIf | null;
}

export interface Questionnaire {
  version: string;
  languages?: string[];
  title: string;
  titleCyrl?: string | null;
  totalQuestions: number;
  sections: string[];
  sectionsCyrl?: string[] | null;
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

// ── Excel AI tahlil ───────────────────────────────────

export type ManbaTuri =
  | 'milliy_standart'
  | 'xalqaro'
  | 'ilmiy_adabiyot'
  | 'statistika'
  | 'gemini_tahlil';

export interface ExcelVaraqInfo {
  nomi: string;
  qatorlarSoni: number;
  ustunlar: string[];
}

export interface StatistikaXulosaBoLim {
  boLim: string;
  asosiyKoRsatkichlar: string[];
  xulosa: string;
}

export interface ExcelTahlilFormula {
  nomi: string;
  formula: string;
  izoh: string;
  qoLlanilganQism: string;
}

export interface ExcelTahlilManba {
  nomi: string;
  turi: ManbaTuri | string;
  havola: string | null;
  izoh: string;
}

export interface ExcelTahlilActionItem {
  bosqich?: string;
  harakat?: string;
  muddat?: string;
  masul?: string;
  [key: string]: unknown;
}

export interface ExcelTahlilTasir {
  omil?: string;
  tasir?: string;
  foiz?: number | string;
  [key: string]: unknown;
}

export interface ExcelAnalysisTahlil extends AIReport {
  actionPlan?: ExcelTahlilActionItem[] | string[];
  taxminiyTasir?: ExcelTahlilTasir[] | string[];
}

export interface ExcelAnalysisResponse {
  faylNomi: string;
  varaqlar: ExcelVaraqInfo[];
  umumiyXulosa: string;
  statistikaXulosasi: StatistikaXulosaBoLim[];
  tahlil: ExcelAnalysisTahlil | null;
  formulalar: ExcelTahlilFormula[];
  manbalar: ExcelTahlilManba[];
  aiXato: string | null;
}
