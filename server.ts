import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { FactorImportance, RiskBenefit, RiskAnalysisResult, TextAnalysisResponse, UserProfile, PatientAdvice } from "./src/types";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3000;

// Initialize Google Gen AI
let aiClient: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  try {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini SDK successfully initialized.");
  } catch (err) {
    console.error("Failed to initialize Gemini SDK:", err);
  }
} else {
  console.warn("WARNING: GEMINI_API_KEY not configured or set to default placeholder.");
}

// ----------------------------------------------------
// Endpoints
// ----------------------------------------------------

// ----------------------------------------------------
// Persistent Database (JSON File-based)
// ----------------------------------------------------
const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const ADVICES_FILE = path.join(DATA_DIR, "advices.json");

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Seed Initial Data if empty
function initializeDatabase() {
  if (!fs.existsSync(USERS_FILE)) {
    const seedUsers: UserProfile[] = [
      {
        id: "admin-1",
        login: "admin",
        parol: "admin123",
        ism: "Gulnora Toshmatova",
        rol: "admin",
        yaratilganSana: "2026-06-01"
      },
      {
        id: "doc-1",
        login: "shifokor",
        parol: "shifokor123",
        ism: "Dr. Alisher Qodirov",
        rol: "shifokor",
        yaratilganSana: "2026-06-02",
        mutaxassislik: "Kardiolog, Milliy kardiologiya markazi",
        shifoxona: "Farg'ona viloyat kardiologiya dispanseri",
        tasdiqlangan: true
      },
      {
        id: "doc-2",
        login: "nozimajon",
        parol: "shifokor123",
        ism: "Dr. Nozima Ergasheva",
        rol: "shifokor",
        yaratilganSana: "2026-06-03",
        mutaxassislik: "Preventiv Terapiya professori",
        shifoxona: "Farg'ona jamoat salomatligi tibbiyot institutu",
        tasdiqlangan: false // Needs admin approval! Showcases the workflow!
      },
      {
        id: "user-1",
        login: "foydalanuvchi",
        parol: "foydalanuvchi123",
        ism: "Sardor Salimov",
        rol: "xodim",
        yaratilganSana: "2026-06-05",
        shaharTuman: "Farg'ona shahri",
        yosh: 48,
        jins: "erkak",
        boy: 172,
        vazn: 81,
        soglik_skrining_tarixi: [
          {
            data: {
              yosh: 48,
              jins: "erkak",
              boy: 172,
              vazn: 81,
              sistolik: 142,
              diastolik: 91,
              glyukoza: 6.2,
              xolesterin: 5.4,
              tuzIstemi: "yuqori",
              shakarVaXamir: "ortacha",
              sabzavotMeva: "kam_yoki_yoq",
              jismoniyFaollik: "kam",
              chekish: "ha",
              nosvoy: "yoq",
              oiladaKasallik: ["gipertoniya", "yurak_xastaligi"],
              tibbiyotXodimi: false,
              nazariyBilimDarajasi: "yaxshi",
              realKomplayens: "ortacha",
              shaharTuman: "Farg'ona shahri"
            },
            riskResult: {
              tmi: 27.4,
              tmiKategoriya: "Ortiqcha vazn (Xavf ortgan)",
              riskFoizi: 65,
              zona: "qizil",
              hududiyStatistika: {
                hududXavfi: 58.2,
                populyatsiyaEtalonBosim: "135/85 mmHg",
                tavsiyaEtilganSkriningKuni: "Har oyda bir marta"
              },
              faktorlar: [
                { nomi: "Arterial qon bosimi", tafsilot: "Bosim 142/91 mmHg gipertoniya ko'rsatkichidir", tasirKuchi: 9, boshqariladimi: true },
                { nomi: "Tuz iste'moli", tafsilot: "Milliy taomlarda o'ta sho'r pishirish kardiologik xavfni oshirmoqda", tasirKuchi: 8, boshqariladimi: true }
              ],
              shaxsiyTavsiyalar: {
                kritikOmillar: ["Tuz iste'moli", "Zararli odatlar", "Baland bosim"],
                ovqatlanish: ["Kunda faqat 5 gramgacha tuz bering", "Qaynatilgan go'sht iste'mol qiling", "Ko'k choy va sabzavotlar ko'paytiring"],
                jismoniyMashq: ["Har kuni kamida 45 daqiqa o'rtacha piyoda tez yurish", "Ertalabki yengil kardiomashqlar"],
                tibbiyReja: ["Kardiolog shifokor bilan uchrashib bosim dorilarini (Komplayens) muvofiqlashtiring"],
                kutilayotganEffekt: [{ ozgarish: "Zararli odatlardan voz kechish va tuzsiz parhez", kamayadiganXavf: 25 }],
                komplayensTahlili: { daraja: "O'rtacha", nomutanosiblikKuzatildimi: false, maslahat: "" }
              },
              klinikXulosa: "Bemorda o'rtacha-yuqori daxldorlikdagi kardiovaskulyar asoratlarga moyillik aniqlandi. Zudlik bilan profilaktika mezonlarini bajarish talab qilinadi."
            },
            sana: "2026-06-08"
          }
        ],
        soglik_kundaligi: [
          {
            id: "journal-init-1",
            sana: "2026-06-09",
            vaqt: "08:15",
            sistolik: 138,
            diastolik: 88,
            puls: 76,
            glyukoza: 6.0,
            vazn: 81,
            uyqu: "ortacha",
            stress: "ortacha",
            alomatlar: ["yurak_oynashi"],
            dorilar: [{ nomi: "Lozap", doza: "50 mg", ichildi: true }],
            qaydlar: "Ertalab nonushtadan avval dori ichdim, tuz kam solingan sho'rva yedim."
          }
        ]
      },
      {
        id: "user-2",
        login: "dilshod",
        parol: "foydalanuvchi123",
        ism: "Dilshodbek Rahmonov",
        rol: "xodim",
        shaharTuman: "Qo'qon shahri",
        yosh: 52,
        jins: "ayol",
        boy: 165,
        vazn: 74,
        yaratilganSana: "2026-06-06",
        soglik_skrining_tarixi: [],
        soglik_kundaligi: []
      }
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(seedUsers, null, 2), "utf8");
  }

  if (!fs.existsSync(ADVICES_FILE)) {
    const seedAdvices: PatientAdvice[] = [
      {
        id: "advice-1",
        bemorId: "user-1",
        shifokorId: "doc-1",
        shifokorIsm: "Dr. Alisher Qodirov",
        shifokorMutaxassislik: "Kardiolog, Milliy kardiologiya markazi",
        matn: "Sardorbek salomatligingizni diqqat bilan o'rganib chiqdim. Bosimingiz 142 mm simob ustuniga yetishi gipertoniya ishoratidir. Tuz iste'molini minimallashtirganingiz uchun tashakkur! Lozap dorisini ertalab uzluksiz ichib borishingizni so'rayman. Profilaktik o'lchovlarni davom ettiring.",
        sana: "2026-06-09",
        vaqt: "14:20"
      }
    ];
    fs.writeFileSync(ADVICES_FILE, JSON.stringify(seedAdvices, null, 2), "utf8");
  }
}

initializeDatabase();

function getUsers(): UserProfile[] {
  try {
    const data = fs.readFileSync(USERS_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading users database:", err);
    return [];
  }
}

function saveUsers(users: UserProfile[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving users database:", err);
  }
}

function getAdvices(): PatientAdvice[] {
  try {
    const data = fs.readFileSync(ADVICES_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading advices database:", err);
    return [];
  }
}

function saveAdvices(advices: PatientAdvice[]) {
  try {
    fs.writeFileSync(ADVICES_FILE, JSON.stringify(advices, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving advices database:", err);
  }
}

// ----------------------------------------------------
// Authentication API Endpoints
// ----------------------------------------------------

// 1. User Registration
app.post("/api/auth/register", (req, res) => {
  try {
    const { login, parol, ism, rol, shaharTuman, yosh, jins, boy, vazn, mutaxassislik, shifoxona } = req.body;

    if (!login || !parol || !ism || !rol) {
      return res.status(400).json({ error: "Barcha majburiy maydonlarni to'ldiring (login, parol, ism, rol)." });
    }

    const users = getUsers();
    const cleanLogin = login.trim().toLowerCase();

    // Check if user already exists
    if (users.some(u => u.login.toLowerCase() === cleanLogin)) {
      return res.status(400).json({ error: "Ushbu login band. Iltimos, boshqa logindan foydalaning." });
    }

    const newUser: UserProfile = {
      id: "u-" + Math.random().toString(36).substr(2, 9),
      login: cleanLogin,
      parol: parol.trim(), // simple demo plain-text
      ism: ism.trim(),
      rol: rol as any,
      yaratilganSana: new Date().toISOString().split('T')[0]
    };

    if (rol === "xodim") {
      newUser.shaharTuman = shaharTuman || "Farg'ona shahri";
      newUser.yosh = Number(yosh) || 40;
      newUser.jins = (jins === "ayol") ? "ayol" : "erkak";
      newUser.boy = Number(boy) || 170;
      newUser.vazn = Number(vazn) || 70;
      newUser.soglik_skrining_tarixi = [];
      newUser.soglik_kundaligi = [];
    } else if (rol === "shifokor") {
      newUser.mutaxassislik = mutaxassislik || "Kardiolog / Shifokor";
      newUser.shifoxona = shifoxona || "Farg'ona oilaviy poliklinikasi";
      newUser.tasdiqlangan = false; // defaults to unverified, admin approves
    }

    users.push(newUser);
    saveUsers(users);

    return res.status(201).json({ success: true, user: { id: newUser.id, login: newUser.login, ism: newUser.ism, rol: newUser.rol } });
  } catch (err: any) {
    console.error("Registration error:", err);
    return res.status(500).json({ error: "Ro'yxatdan o'tishda xatolik yuz berid. Iltimos qayta urinib ko'ring." });
  }
});

// 2. User Login
app.post("/api/auth/login", (req, res) => {
  try {
    const { login, parol } = req.body;

    if (!login || !parol) {
      return res.status(400).json({ error: "Login va maxfiy so'zni kiriting." });
    }

    const users = getUsers();
    const cleanLogin = login.trim().toLowerCase();
    const user = users.find(u => u.login.toLowerCase() === cleanLogin && u.parol === parol.trim());

    if (!user) {
      return res.status(401).json({ error: "Login yoki parol noto'g'ri kiritildi!" });
    }

    // Safe profile return
    const responseUser = { ...user };
    // delete responseUser.parol; // safe practice

    return res.json({ success: true, user: responseUser });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Tizimga kirishda xatolik yuz berdi." });
  }
});

// ----------------------------------------------------
// Health Data Sync & Physician Advisory Endpoints
// ----------------------------------------------------

// 3. Sync Client Data (Scrining logs & physical journals)
app.post("/api/patients/:userId/sync", (req, res) => {
  try {
    const { userId } = req.params;
    const { soglik_skrining_tarixi, soglik_kundaligi, corporate_surveys } = req.body;

    const users = getUsers();
    const userIdx = users.findIndex(u => u.id === userId);

    if (userIdx === -1) {
      return res.status(404).json({ error: "Bemor profili topilmadi." });
    }

    if (users[userIdx].rol !== "xodim") {
      return res.status(400).json({ error: "Faqat bemor profillari sinxronizatsiya qilinadi." });
    }

    // Update arrays
    if (Array.isArray(soglik_skrining_tarixi)) {
      users[userIdx].soglik_skrining_tarixi = soglik_skrining_tarixi;
    }
    if (Array.isArray(soglik_kundaligi)) {
      users[userIdx].soglik_kundaligi = soglik_kundaligi;
    }
    if (Array.isArray(corporate_surveys)) {
      users[userIdx].corporate_surveys = corporate_surveys;
    }

    saveUsers(users);
    return res.json({ success: true, message: "Klinik ma'lumotlar server bilan muvaffaqiyatli sinxronlandi." });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: "Sinxronlashda muammo yuz berdi" });
  }
});

// 4. Get all patients (Visible to Doctors and Admin)
app.get("/api/patients", (req, res) => {
  try {
    const users = getUsers();
    // Return all users who have patient status ('foydalanuvchi')
    const patients = users
      .filter(u => u.rol === "xodim")
      .map(p => ({
        id: p.id,
        ism: p.ism,
        login: p.login,
        rol: p.rol,
        shaharTuman: p.shaharTuman,
        yosh: p.yosh,
        jins: p.jins,
        boy: p.boy,
        vazn: p.vazn,
        yaratilganSana: p.yaratilganSana,
        skriningSoni: p.soglik_skrining_tarixi ? p.soglik_skrining_tarixi.length : 0,
        kundalikSoni: p.soglik_kundaligi ? p.soglik_kundaligi.length : 0,
        soglik_skrining_tarixi: p.soglik_skrining_tarixi || [],
        soglik_kundaligi: p.soglik_kundaligi || []
      }));

    return res.json({ success: true, patients });
  } catch (err) {
    console.error("Get patients error:", err);
    return res.status(500).json({ error: "Bemorlar ro'yxatini yuklashda xatolik." });
  }
});

// 5. Submit doctor's advice
app.post("/api/patients/:userId/advice", (req, res) => {
  try {
    const { userId } = req.params;
    const { shifokorId, shifokorIsm, shifokorMutaxassislik, matn } = req.body;

    if (!shifokorId || !matn || !shifokorIsm) {
      return res.status(400).json({ error: "Shifokor ma'lumotlari va maslahat matni kiritilishi shart." });
    }

    const advices = getAdvices();
    const newAdvice: PatientAdvice = {
      id: "a-" + Math.random().toString(36).substr(2, 9),
      bemorId: userId,
      shifokorId,
      shifokorIsm,
      shifokorMutaxassislik: shifokorMutaxassislik || "Kardiolog",
      matn: matn.trim(),
      sana: new Date().toISOString().split('T')[0],
      vaqt: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false })
    };

    advices.push(newAdvice);
    saveAdvices(advices);

    return res.status(201).json({ success: true, advice: newAdvice });
  } catch (err) {
    console.error("Post advice error:", err);
    return res.status(500).json({ error: "Maslahat yozishda muammo yuz berdi" });
  }
});

// 6. Get doctor's advice for patient
app.get("/api/patients/:userId/advices", (req, res) => {
  try {
    const { userId } = req.params;
    const advices = getAdvices();
    const filtered = advices.filter(a => a.bemorId === userId);
    return res.json({ success: true, advices: filtered });
  } catch (err) {
    console.error("Get advices error:", err);
    return res.status(500).json({ error: "Maslahatlar yuklanmadi." });
  }
});

// ----------------------------------------------------
// Admin Specific Control Endpoints
// ----------------------------------------------------

// 7. Get all system accounts
app.get("/api/admin/users", (req, res) => {
  try {
    const users = getUsers();
    // Return users (mask secrets or return safely for simulated settings)
    const sanitized = users.map(u => {
      const copy = { ...u };
      // keep parol here in small demo for easy view, but we can return safely
      return copy;
    });
    return res.json({ success: true, users: sanitized });
  } catch (err) {
    console.error("Admin list users error:", err);
    return res.status(500).json({ error: "Foydalanuvchilarni olishda xato." });
  }
});

// 8. Update account details, verify doctor, promote/demote fields
app.put("/api/admin/users/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    const users = getUsers();
    const idx = users.findIndex(u => u.id === userId);

    if (idx === -1) {
      return res.status(404).json({ error: "Foydalanuvchi topilmadi." });
    }

    // Merge only permitted properties
    if (updateData.ism !== undefined) users[idx].ism = updateData.ism.trim();
    if (updateData.rol !== undefined) users[idx].rol = updateData.rol;
    if (updateData.tasdiqlangan !== undefined) users[idx].tasdiqlangan = !!updateData.tasdiqlangan;
    if (updateData.mutaxassislik !== undefined) users[idx].mutaxassislik = updateData.mutaxassislik.trim();
    if (updateData.shifoxona !== undefined) users[idx].shifoxona = updateData.shifoxona.trim();
    if (updateData.shaharTuman !== undefined) users[idx].shaharTuman = updateData.shaharTuman;

    saveUsers(users);
    return res.json({ success: true, user: users[idx] });
  } catch (err) {
    console.error("Admin update user error:", err);
    return res.status(500).json({ error: "Foydalanuvchini yangilashda xato." });
  }
});

// 9. Delete account
app.delete("/api/admin/users/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    const users = getUsers();
    const filtered = users.filter(u => u.id !== userId);

    if (users.length === filtered.length) {
      return res.status(404).json({ error: "Foydalanuvchi topilmadi." });
    }

    saveUsers(filtered);
    return res.json({ success: true, message: "Foydalanuvchi tizimdan butunlay o'chirildi." });
  } catch (err) {
    console.error("Admin delete user error:", err);
    return res.status(500).json({ error: "O'chirishda xatolik." });
  }
});

/**
 * Endpoint 1: Medical Risk Predictor and Stratifier (Scenario 1)
 * Uses multi-factorial scoring adjusted for Fergana Valley populations (Innovation 3)
 * analyzes health worker compliance gaps (Innovation 4)
 */
app.post("/api/predict-risk", async (req, res) => {
  try {
    const data = req.body as any;
    
    // Parse values Safely
    const yosh = Number(data.yosh) || 40;
    const jins = data.jins || 'erkak';
    const boy = Number(data.boy) || 170;
    const vazn = Number(data.vazn) || 75;
    const sistolik = Number(data.sistolik) || 120;
    const diastolik = Number(data.diastolik) || 80;
    const glyukoza = data.glyukoza !== '' ? Number(data.glyukoza) : null;
    const xolesterin = data.xolesterin !== '' ? Number(data.xolesterin) : null;
    
    const tuzIstemi = data.tuzIstemi || 'ortacha';
    const shakarVaXamir = data.shakarVaXamir || 'ortacha';
    const sabzavotMeva = data.sabzavotMeva || 'har_kuni';
    const jismoniyFaollik = data.jismoniyFaollik || 'ortacha';
    const chekish = data.chekish || 'yoq';
    const nosvoy = data.nosvoy || 'yoq';
    const oiladaKasallik = Array.isArray(data.oiladaKasallik) ? data.oiladaKasallik : [];
    const tibbiyotXodimi = !!data.tibbiyotXodimi;
    const nazariyBilimDarajasi = data.nazariyBilimDarajasi || 'yaxshi';
    const realKomplayens = data.realKomplayens || 'ortacha';
    const shaharTuman = data.shaharTuman || "Farg'ona shahri";

    // 1. Calculate BMI (TMI)
    const tmi = vazn / Math.pow(boy / 100, 2);
    let tmiKategoriya = "Me'yor";
    if (tmi < 18.5) tmiKategoriya = "Vazn yetishmasligi";
    else if (tmi >= 25 && tmi < 30) tmiKategoriya = "Ortiqcha vazn (Xavf ortgan)";
    else if (tmi >= 30) tmiKategoriya = "Semizlik (Yuqori xavf)";

    // 2. Risk score cumulative calculations (dissertation model)
    let points = 0;

    // Age factor
    if (yosh >= 45 && yosh < 55) points += 2;
    else if (yosh >= 55 && yosh < 65) points += 4;
    else if (yosh >= 65) points += 6;

    // BMI factor
    if (tmi >= 25 && tmi < 30) points += 2;
    else if (tmi >= 30) points += 5;

    // Blood Pressure factor (very dominant)
    if (sistolik >= 140 && sistolik < 160) points += 5;
    else if (sistolik >= 160) points += 9;
    else if (sistolik >= 130 && sistolik < 140) points += 2;

    if (diastolik >= 90 && diastolik < 100) points += 4;
    else if (diastolik >= 100) points += 8;

    // Glycemia
    if (glyukoza !== null) {
      if (glyukoza >= 5.6 && glyukoza < 7.0) points += 3;
      else if (glyukoza >= 7.0) points += 6;
    } else {
      // If not tested, we add +1 point as potential risk due to lack of screening
      points += 1;
    }

    // Cholesterol
    if (xolesterin !== null) {
      if (xolesterin >= 5.2 && xolesterin < 6.2) points += 2;
      else if (xolesterin >= 6.2) points += 5;
    }

    // Fergana Valley specific high salt factor (Innovation 3 - Nutritiv maqom, local culinary culture)
    if (tuzIstemi === 'yuqori') points += 4;
    else if (tuzIstemi === 'ortacha') points += 1;

    // High Carbohydrate / Uzbek diet pattern (Shorva, palov, tea with sugar)
    if (shakarVaXamir === 'kop') points += 3;
    else if (shakarVaXamir === 'ortacha') points += 1;

    // Low veggies
    if (sabzavotMeva === 'kam_yoki_yoq') points += 3;

    // Sedentary lifestyle
    if (jismoniyFaollik === 'kam') points += 4;
    else if (jismoniyFaollik === 'ortacha') points += 1;

    // Tobacco & Nosvoy (Nosvoy is prevalent locally and monitored intensely per Innovation 3)
    if (chekish === 'ha') points += 4;
    else if (chekish === 'chekar_edi') points += 1;

    if (nosvoy === 'ha') points += 3;

    // Hereditary
    points += oiladaKasallik.length * 1.5;

    // Innovation 4 behavior gap analysis
    let discrepancyTriggered = false;
    let complianceAdvice = "Sog'liqni saqlash talablariga rioya eting, muntazam ravishda ko'riklardan o'tib turing.";
    let complianceRating = "O'rtacha";

    if (tibbiyotXodimi) {
      if ((nazariyBilimDarajasi === 'mukammal' || nazariyBilimDarajasi === 'yaxshi') && realKomplayens === 'past') {
        discrepancyTriggered = true;
        points += 3.5; // Added risk due to high self-neglect despite highest medical knowledge
        complianceRating = "Zaif (Yuqori nomutanosiblik)";
        complianceAdvice = "Diqqat: Tibbiyot pedagog xodimidagi 'Nazariy Bilim va Amaliy Komplayens' o'rtasidagi nomutanosiblik aniqlandi (Dissertatsiya 4-ilmiy yangiligi). Nazariy bilimlaringiz mukammal bo'lishiga qaramasdan, o'z salomatligingizni asrash bo'yicha amaliy harakatlaringiz juda past. Iltimos, birinchi galda o'zingiz korporativ sog'lomlashtirish algoritmini boshlang va shaxsiy namuna bo'ling!";
      } else if (realKomplayens === 'yaxshi') {
        complianceRating = "A'lo";
        complianceAdvice = "Tabriklaymiz. Tibbiy xodim sifatida amaliy va nazariy komplayensingiz mutanosib (O'z sog'lig'iga mas'uliyatli xulq-atvor shakllangan).";
      } else {
        complianceAdvice = "Tibbiyot xodimi sifatida nazariy bilimlarni amaliy komplayens (profilaktik tekshiruvlar, dori qabul qilish) bilan kuchaytirishingiz zarur.";
      }
    }

    // Convert Points to a non-linear Risk Percentage
    let riskFoizi = 5;
    if (points <= 8) {
      riskFoizi = Math.round(points * 3); // 0 to 24%
    } else if (points > 8 && points <= 22) {
      riskFoizi = Math.round(25 + (points - 8) * 3); // 25 to 67%
    } else {
      riskFoizi = Math.round(Math.min(99, 68 + (points - 22) * 1.8)); // 68 to 99%
    }

    // Determine traffic-light zone
    let zona: 'yashil' | 'sariq' | 'qizil' = 'yashil';
    if (riskFoizi >= 30 && riskFoizi < 70) zona = 'sariq';
    else if (riskFoizi >= 70) zona = 'qizil';

    // Regional populations statistics context (Innovation 3)
    let hududXavfi = 38; // Average baseline risk for Fergana populations
    if (shaharTuman.includes("Farg'ona shahri") || shaharTuman.includes("Marg'ilon")) {
      hududXavfi = 42; // Urban metabolic risks are higher
    } else if (shaharTuman.includes("Oltiariq") || shaharTuman.includes("Quva")) {
      hududXavfi = 35; // Better agricultural dietary habits, slightly lower hypertension
    }

    // 3. Dynamically rank and sort factor importance
    const barchaFaktorlar: FactorImportance[] = [
      { nomi: "Arterial qon bosimi", tafsilot: `Sizda arterial qon bosimi ko'rsatkichi ${sistolik}/${diastolik} mmHg ni tashkil qiladi.`, tasirKuchi: sistolik >= 140 ? 9.5 : (sistolik >= 130 ? 6.5 : 2), boshqariladimi: true },
      { nomi: "Tana massasi indeksi (TMI)", tafsilot: `Sizning TMI ko'rsatkichingiz ${tmi.toFixed(1)} (${tmiKategoriya}). Semizlik tomir kasalliklarini qo'zg'atadi.`, tasirKuchi: tmi >= 30 ? 9 : (tmi >= 25 ? 6 : 1), boshqariladimi: true },
      { nomi: "Tuz va sho'r ovqatlar qabul qilish", tafsilot: "Vodiydagi sho'r taomlar va har bir ovqatga tuz qo'shish odati gipertoniya xavfini 4 barobarga oshiradi.", tasirKuchi: tuzIstemi === 'yuqori' ? 8.5 : 2, boshqariladimi: true },
      { nomi: "Uglevod va xamirli taomlar", tafsilot: "Non, palov va shakarli choylar ko'p iste'mol qilinishi metabolik sindrom va insulin chidamliligiga olib keladi.", tasirKuchi: shakarVaXamir === 'kop' ? 7.5 : 3, boshqariladimi: true },
      { nomi: "Jismoniy harakatsizlik", tafsilot: "Kam harakatlilik kardiologik risklarni oshiradi va energetik nomutanosiblikni keltirib chiqaradi.", tasirKuchi: jismoniyFaollik === 'kam' ? 8 : (jismoniyFaollik === 'ortacha' ? 4 : 1), boshqariladimi: true },
      { nomi: "Zararli odatlar (Chekish / Nosvoy)", tafsilot: "Nosvoy tamakining bir turi sifatida og'iz bo'shlig'i shilliq qavati va qon tomirlariga kuchli salbiy ta'sir ko'rsatadi.", tasirKuchi: (chekish === 'ha' || nosvoy === 'ha') ? 9 : 1, boshqariladimi: true },
      { nomi: "Nasliy moyillik", tafsilot: `Oilangizda qayd etilgan: ${oiladaKasallik.join(', ') || "Hech qanday moyillik yo'q"}. Boshqarib bo'lmaydigan xavf guruhi.`, tasirKuchi: oiladaKasallik.length * 2.5, boshqariladimi: false },
    ];

    const faktorlar = barchaFaktorlar
      .filter(f => f.tasirKuchi > 2.5)
      .sort((a, b) => b.tasirKuchi - a.tasirKuchi);

    // 4. Generate Personalized preventive suggestions
    const kritikOmillar: string[] = [];
    if (sistolik >= 135 || diastolik >= 85) kritikOmillar.push("Yuqori qon bosimi (Gipertoniya xavfi)");
    if (tmi >= 25) kritikOmillar.push("Ortiqcha tana vazni (TMI yuqori)");
    if (tuzIstemi === 'yuqori') kritikOmillar.push("Me'yordan ortiq tuz iste'moli");
    if (shakarVaXamir === 'kop') kritikOmillar.push("Sodda uglevod va shakar yuklamasi");
    if (jismoniyFaollik === 'kam') kritikOmillar.push("Harakatsiz hayot tarzi (Gipodinamiya)");
    if (chekish === 'ha' || nosvoy === 'ha') kritikOmillar.push("Tamaki yoki Nosvoy iste'moli");
    if (glyukoza && glyukoza >= 5.6) kritikOmillar.push("Pre-diabet yoki qondagi yuqori qand miqdori");

    const ovqatlanish: string[] = [
      "Tuz iste'molini kuniga 5 grammdan (bir choy qoshiq) kamaytiring (ayniqsa, taom pishgandan keyin tuz qo'shmaslik ko'nikmasini shakllantiring).",
      "Haftalik menyuda shakarli va xamirli taomlarni (issiq non, lag'mon, shirinliklar) kamida 40% ga kamaytiring. Ularning o'rnini yashil sabzavotlar va mevalar bilan to'ldiring.",
      "Milliy taom (palov, sho'rva) tayyorlashda paxta yog'ini kamaytirib, zaytun yoki kungaboqar yog'idan foydalaning va faqat kam yog'li go'shtlarni tanlang."
    ];

    const jismoniyMashq: string[] = [
      "Haftada kamida 5 marta 30-45 daqiqadan o'rtacha tezlikda jadal piyoda yurishni yo'lga qo'ying (bu sizning joriy jismoniy faolligingizni normallashtirish uchun eng xavfsiz uslub).",
      "Kunda kamida 8000 qadam yurishni odat qiling. Buning uchun mobil ilovalardan foydalaning.",
      "Agar sharoit bo'lsa, haftada 2-3 marta suzish yoki yengil kardiomashg'ulotlar bilan shug'ullaning."
    ];

    const tibbiyReja: string[] = [
      "Yilda bir marta qondagi glyukoza va xolesterin miqdorini tahlil qildirib turing.",
      sistolik >= 130 || diastolik >= 80 
        ? "Har kuni ertalab va kechqurun arterial bosimingizni o'lchab, kundalikka yozib boring, shifokor nazoratidan o'ting." 
        : "Salomatlik ko'rsatkichingizni va arterial bosimingizni barqaror saqlash uchun profilaktik ko'riklardan o'tib turing.",
      "Klinik tahlillarni va tekshiruvlar ro'yxatini tahlil qilishi uchun hududiy oilaviy shifokorga (poliklinikaga) murojaat qiling."
    ];

    // Interventions Expected Benefit Calculator (Dissertation Practical Value)
    const kutilayotganEffekt: RiskBenefit[] = [];
    if (tmi >= 25) {
      kutilayotganEffekt.push({ ozgarish: "Tana vaznini 5% ga kamaytirish", kamayadiganXavf: Math.round(riskFoizi * 0.15) });
    }
    if (tuzIstemi === 'yuqori') {
      kutilayotganEffekt.push({ ozgarish: "Tuz iste'molini kuniga 5g gacha tushirish", kamayadiganXavf: Math.round(riskFoizi * 0.18) });
    }
    if (chekish === 'ha' || nosvoy === 'ha') {
      kutilayotganEffekt.push({ ozgarish: "Tamaki / Nosvoydan butunlay voz kechish", kamayadiganXavf: Math.round(riskFoizi * 0.22) });
    }
    if (jismoniyFaollik === 'kam') {
      kutilayotganEffekt.push({ ozgarish: "Kunlik 30 daqiqa piyoda yurishni boshlash", kamayadiganXavf: Math.round(riskFoizi * 0.12) });
    }
    if (kutilayotganEffekt.length === 0) {
      kutilayotganEffekt.push({ ozgarish: "Muntazam sog'lom turmush tarzi rejasiga rioya qilish", kamayadiganXavf: 5 });
    }

    // Comprehensive Clinical conclusion
    let klinikXulosa = "";
    if (zona === 'yashil') {
      klinikXulosa = "Sizda xronik noinfeksion kasalliklar rivojlanish xavfi juda past darajada. Salomatlik ko'rsatkichlaringiz populyatsiya etaloni doirasida. Sog'lom turmush tarzi tamoyillarini saqlab qolish va ovqatlanishdagi to'g'ri odatlarni davom ettirish tavsiya etiladi. Sog'lom va uzoq umr ko'rish asosi — faollikdir.";
    } else if (zona === 'sariq') {
      klinikXulosa = "Diqqat: Sizda o'rtacha darajadagi xavf (risk) omillari shakllangan. Agar milliy taomlar iste'moli, tuz yuklamasi va jismoniy harakatsizlik odatlarini o'zgartirmasangiz, yaqin 5 yil ichida gipertoniya yoki metabolik kasalliklar rivojlanishi mumkin. Hududiy poliklinikangizga borib dastlabki kardiologik tekshiruvdan o'tishingiz va parhez rejasini boshlashingiz tavsiya etiladi.";
    } else {
      klinikXulosa = "ZUDLIK BILAN MUROJAAT QILING: Sizda xronik noinfeksion kasalliklar, xususan gipertoniya va metabolik sindrom rivojlanishi xavfi o'ta yuqori (profilaktik chegaradan oshgan). Arzimas deb hisoblangan shikoyatlaringiz jiddiy asoratlarni keltirib chiqarishi mumkin. Hududiy oilaviy shifokor nazoratida to'liq kardiomonitoring, EKG, glyukoza va Lipid profili tekshiruvlarini o'tkazishingiz, shuningdek zudlik bilan dorilar va parhez rejasini belgilashingiz kerak.";
    }

    const tahlilVaqti = new Date().toISOString();

    // AI schema for comprehensive analysis
    const predictAiSchema = {
      type: Type.OBJECT,
      properties: {
        klinikXulosa: {
          type: Type.STRING,
          description: "Bemorning barcha ko'rsatkichlari (yosh, vazn, qon bosimi, tahlillar, zararli odatlar) va ayniqsa uning erkin shikoyatlarini chuqur, mukammal va har tomonlama klinik-profilaktik semantik tahlil qilgan holda tayyorlangan kardiologik-terapevtik xulosasi. O'ta chuqur tahliliy va mazmundor, 2-3 ta keng ko'lamli o'zbekona samimiy va ilmiy isbotlangan xatboshi (paragraf) bo'lishi kerak."
        },
        kritikOmillar: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Bemor hayoti va salomatligidagi eng jiddiy yoki xavfli 3-5 ta omillar/belgilar."
        },
        ovqatlanish: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Bemor uchun shaxsiylashtirilgan o'ta muhim nutritiv / parhezga oid 4-5 ta maslahat."
        },
        jismoniyMashq: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Bemorning jismoniy faolligi va holatiga mos ravishda tavsiya etilgan 3-4 ta kardio-mashqlar / piyoda yurish rejasi."
        },
        tibbiyReja: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Klinik tekshiruvlar, tonometriya, laborator tahlillar yoki hududiy poliklinika kardiolog / shifokoriga ko'rinish kabi 3-4 ta tibbiy reja koalitsiyalari."
        },
        komplayensSharhi: {
          type: Type.STRING,
          description: "Bemor pedagog yoki tibbiyot xodimi bo'lsa, bilim va amaliyot nomutanosibligi haqida maxsus yumshoq profilaktik fikr."
        }
      },
      required: ["klinikXulosa", "kritikOmillar", "ovqatlanish", "jismoniyMashq", "tibbiyReja"]
    };

    if (aiClient) {
      try {
        const systemPrompt = `Siz Farg'ona vodiysi profilaktik tibbiyot va kardiologiya ilmiy dissertatsiyasi asosida ishlaydigan professional Sun'iy Intellekt-shifokor, kardiolog va jamoat salomatligi professorisiz.
Salomatlik skriningi to'ldirgan bemorning barcha ob'ektiv parametrlarini, antropometrik ma'lumotlarini (yoshi, jinsi, bo'yi, vazni), klinik ko'rsatkichlarini (qon bosimi, glyukoza, xolesterin), xulq-atvor odatlarini (sho'r/uglevod iste'moli, chekish/nosvoy, harakat) va bemor tomonidan erkin tarzda yozilgan shikoyatlarni (shikoyat matni) eng yuqori darajada ilmiy, tahliliy va professional tushuntirib bering.
Bemorning yashash hududi bo'lgan Farg'ona vodiysi populyatsion kardiologik xususiyatlarini (an'anaviy osh xamir ovqatlar, sho'rlik darajasi yuqoriligi) va agar u tibbiyot xodimi bo'lsa, uning amaliy salomatlik komplayensida unga yo'nalish bering.
Javobni faqat taqdim etilgan JSON sxemasi bo'yicha toza qaytarishingiz shart.`;

        const userPrompt = `Bemor ma'lumotlari:
- Yosh: ${yosh} yosh
- Jins: ${jins === 'erkak' ? 'Erkak' : 'Ayol'}
- Boy: ${boy} sm, Vazn: ${vazn} kg, TMI: ${tmi.toFixed(1)} (${tmiKategoriya})
- Qon Bosimi: ${sistolik}/${diastolik} mmHg
- Glyukoza: ${glyukoza !== null ? glyukoza + ' mmol/l' : 'Kiritilmagan'}
- Xolesterin: ${xolesterin !== null ? xolesterin + ' mmol/l' : 'Kiritilmagan'}
- Tuz iste'moli: ${tuzIstemi} (sho'r eyishi)
- Uglevod va qand iste'moli: ${shakarVaXamir}
- Sabzavot-meva: ${sabzavotMeva === 'har_kuni' ? 'Har kuni' : 'Kam yoki yoq'}
- Jismoniy harakat: ${jismoniyFaollik}
- Tamaki: ${chekish === 'ha' ? 'Chekadi' : 'Chekmaydi'}, Nosvoy: ${nosvoy === 'ha' ? 'Otadi' : 'Otmaydi'}
- Oiladagi kardiologik kasalliklar: ${oiladaKasallik.join(', ') || 'yoq'}
- Tibbiyot yoki pedagogik xodim: ${tibbiyotXodimi ? 'Ha' : 'Yoq'} (Bilimi: ${nazariyBilimDarajasi}, Amalda amal qilishi/komplayens: ${realKomplayens})
- Yashash joyi: ${shaharTuman}
- Bemorning erkin yozgan shikoyatlari (erkin shikoyat qismi): "${data.erkinShikoyat || "Mavjud emas"}"

Birlamchi hisoblangan kardiologik xavfli ball / xavf foizi: ${riskFoizi}% (Xavf darajasi: ${zona.toUpperCase()} zona)`;

        console.log("Analyzing full screening with Gemini API...");
        const aiResponse = await aiClient.models.generateContent({
          model: "gemini-3.5-flash",
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: predictAiSchema,
            temperature: 0.35
          }
        });

        const aiParsed = JSON.parse(aiResponse.text.trim());
        
        if (aiParsed.klinikXulosa) {
          klinikXulosa = aiParsed.klinikXulosa;
        }
        if (aiParsed.kritikOmillar && aiParsed.kritikOmillar.length > 0) {
          kritikOmillar.length = 0;
          kritikOmillar.push(...aiParsed.kritikOmillar);
        }
        if (aiParsed.ovqatlanish && aiParsed.ovqatlanish.length > 0) {
          ovqatlanish.length = 0;
          ovqatlanish.push(...aiParsed.ovqatlanish);
        }
        if (aiParsed.jismoniyMashq && aiParsed.jismoniyMashq.length > 0) {
          jismoniyMashq.length = 0;
          jismoniyMashq.push(...aiParsed.jismoniyMashq);
        }
        if (aiParsed.tibbiyReja && aiParsed.tibbiyReja.length > 0) {
          tibbiyReja.length = 0;
          tibbiyReja.push(...aiParsed.tibbiyReja);
        }
        if (aiParsed.komplayensSharhi) {
          complianceAdvice = aiParsed.komplayensSharhi;
        }
      } catch (err) {
        console.error("Gemini full-screening query failed, fallback used:", err);
      }
    }

    const result: RiskAnalysisResult = {
      tmi,
      tmiKategoriya,
      riskFoizi,
      zona,
      hududiyStatistika: {
        hududXavfi,
        populyatsiyaEtalonBosim: "120/80 mmHg (Fergana Valley benchmark)",
        tavsiyaEtilganSkriningKuni: new Date(Date.now() + 180 * 24 * 3600 * 1000).toLocaleDateString() // next screening in 6 months
      },
      faktorlar,
      shaxsiyTavsiyalar: {
        kritikOmillar: kritikOmillar.length > 0 ? kritikOmillar : ["Kritik xavf omillari aniqlanmadi"],
        ovqatlanish,
        jismoniyMashq,
        tibbiyReja,
        kutilayotganEffekt,
        komplayensTahlili: {
          daraja: complianceRating,
          nomutanosiblikKuzatildimi: discrepancyTriggered,
          maslahat: complianceAdvice
        }
      },
      klinikXulosa
    };

    return res.json(result);
  } catch (err: any) {
    console.error("Risk prediction error:", err);
    return res.status(500).json({ error: "Riskni hisoblashda xatolik yuz berdi: " + err.message });
  }
});

/**
 * Endpoint 2: AI Complaint Text Parser (Scenario 2)
 * Connects to Gemini API to extract symptoms, parameters and localized recommendations
 */
app.post("/api/analyze-complaint", async (req, res) => {
  const { complaintText, userContext } = req.body;

  if (!complaintText || complaintText.trim().length < 5) {
    return res.status(400).json({ error: "Iltimos, salomatligingiz bo'yicha batafsilroq shikoyat yozing." });
  }

  // Define structured JSON schema for Gemini response to ensure reliability
  const schema = {
    type: Type.OBJECT,
    properties: {
      muvaffaqiyatli: {
        type: Type.BOOLEAN,
        description: "Matndan qandaydir tibbiy parametr yoki shikoyat aniqlanganligi."
      },
      aniqlanganParametrlar: {
        type: Type.OBJECT,
        properties: {
          yosh: { type: Type.INTEGER, description: "Bemorning yoshi (agar matnda bo'lsa)." },
          jins: { type: Type.STRING, description: "Bemorning jinsi (faqat 'erkak' yoki 'ayol')." },
          boy: { type: Type.INTEGER, description: "Bemorning bo'yi, santimetrda (agar o'lchov bo'lsa)." },
          vazn: { type: Type.INTEGER, description: "Bemorning vazni, kgda (agar kiritilgan bo'lsa)." },
          sistolik: { type: Type.INTEGER, description: "Arterial qon bosimining yuqori (sistolik) ko'rsatkichi (mmHg)." },
          diastolik: { type: Type.INTEGER, description: "Arterial qon bosimining quyi (diastolik) ko'rsatkichi (mmHg)." },
          tuzIstemi: { type: Type.STRING, description: "Tuz iste'moli darajasi: 'yuqori' (ko'p tuz, sho'r xush ko'rsa), 'ortacha' yoki 'past'." },
          shakarVaXamir: { type: Type.STRING, description: "Uglevodlar: 'kop' (shakar, xamir, shirinlik ko'p iste'mol qilsa), 'ortacha' yoki 'kam'." },
          jismoniyFaollik: { type: Type.STRING, description: "Faollik darajasi: 'kam' (kam harakat, ofis xodimi), 'ortacha' (piyoda yuradi) yoki 'yuqori'." },
          chekish: { type: Type.STRING, description: "Tamakiga munosabat: 'ha' (agar cheksa), 'yoq' (chekmaydi)." },
          nosvoy: { type: Type.STRING, description: "Nosvoy otishi: 'ha' (nosvoy cheksa), 'yoq' (otmasa)." },
          shaharTuman: { type: Type.STRING, description: "Farg'ona vodiysidagi shahar yoki tuman nomi (agar zikr etilgan bo'lsa)." }
        },
        description: "Matn tarkibidan topilgan antropometrik va klinik ko'rsatkichlar."
      },
      tahlilMatni: {
        type: Type.STRING,
        description: "Shikoyatlarning klinik-profilaktik semantik tahlili (o'zbek tilida, tushunarli tilda)."
      },
      tavsiyalar: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Bemorga berilgan 3-4 ta shaxsiylashtirilgan birlamchi profilaktik maslahatlar ro'yxati."
      },
      yanaMalumotKerakmi: {
        type: Type.BOOLEAN,
        description: "TMI yoki riskni aniq baholash uchun muhim parametrlar (yosh, vazn, bo'y, bosim) yetishmayaptimi?"
      },
      aniqlashtiruvchiSavollar: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Bemorga qolgan muhim parametrlarni kiritishga yo'naltiruvchi qo'shimcha yumshoq savollar."
      }
    },
    required: ["muvaffaqiyatli", "aniqlanganParametrlar", "tahlilMatni", "tavsiyalar", "yanaMalumotKerakmi", "aniqlashtiruvchiSavollar"]
  };

  const systemPrompt = `Siz Farg'ona vodiysi profilaktik tibbiyot va sog'liqni saqlash ilmiy dissertatsiyasi asosida ishlaydigan professional Sun'iy Intellekt-shifokor (profilaktika olimi) va semantik klinitsistsiz.
Vazifangiz: Bemorning o'zbek tilidagi norasmiy va erkin yozilgan shikoyat matnini har tomonlama chuqur klinik tahlil qilish, asab, kardiologik, nutritiv va xulq-atvor muammolarini sirtqi aniqlash, uning tarkibidan antropometrik qiymatlarni (yosh, vazn, qon bosimi va h.k.) va hayot tarzi odatlarini (nosvoy, tuz solish, sedentary hayot) ajratib olish hamda taqdim etilgan JSON sxemasi bo'yicha toza hisobot qaytarish.
O'zbek shahar-tumanlarida (masalan, Qo'qon, Marg'ilon, Rishton, Oltiariq) yashash sharoiti va milliy nutritiv odatlar (sho'r taomlar, palov, choyxonadagi o'tirishlar) riskga ta'sirini inobatga oling.`;

  if (aiClient) {
    try {
      console.log("Analyzing text with Gemini API...");
      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Bemor shikoyati: "${complaintText}" \n\nQo'shimcha ma'lumotlar: ${JSON.stringify(userContext || {})}`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.3
        }
      });

      const parsedResponse = JSON.parse(response.text.trim());
      return res.json(parsedResponse);
    } catch (err: any) {
      console.error("Gemini query error, falling back to local heuristic parser:", err);
      // Fallback is handled below
    }
  }

  // --- LOCAL SEMANTIC HEURISTIC FALLBACK PARSER ---
  // Runs if Gemini API is not configured or fails. Allows full app usage.
  console.log("Running Local Heuristic Parser...");
  const text = complaintText.toLowerCase();
  
  const extractedParams: any = {};
  const symptoms: string[] = [];
  const questions: string[] = [];

  // Parse age
  const ageMatch = text.match(/(\d+)\s*(?:yosh|da|yash)/) || text.match(/(?:yoshim|man)\s*(\d+)\s*(?:da|da)/);
  if (ageMatch) extractedParams.yosh = parseInt(ageMatch[1]);

  // Parse weight/height
  const weightMatch = text.match(/(\d+)\s*(?:kg|vazn|kilogram|vaznim)/) || text.match(/(?:vaznim|vazn)\s*(\d+)/);
  if (weightMatch) extractedParams.vazn = parseInt(weightMatch[1]);

  const heightMatch = text.match(/(\d+)\s*(?:cm|sm|bo|boy|boyim)/) || text.match(/(?:boyim|bo'yim)\s*(\d+)/);
  if (heightMatch) extractedParams.boy = parseInt(heightMatch[1]);

  // Parse blood pressure
  const bpMatch = text.match(/(\d{2,3})\s*[\/\-]\s*(\d{2,3})/);
  if (bpMatch) {
    extractedParams.sistolik = parseInt(bpMatch[1]);
    extractedParams.diastolik = parseInt(bpMatch[2]);
  } else {
    if (text.includes("bosim") || text.includes("davlen") || text.includes("qon bosim")) {
      symptoms.push("O'zgaruvchan qon bosimi");
    }
  }

  // Symptoms extraction
  if (text.includes("bosh") && (text.includes("ogri") || text.includes("g'ri"))) symptoms.push("Bosh og'rig'i (sefalgiya)");
  if (text.includes("yurak") || text.includes("ko'krak") || text.includes("siqish") || text.includes("qis")) symptoms.push("Ko'krak sohasidagi yoqimsiz qisuvchi og'riqlar (kardiologik taranglik)");
  if (text.includes("charch") || text.includes(" holsiz") || text.includes(" darmon")) symptoms.push("Tez charchash va surunkali asteniya");
  if (text.includes("uyqu") || text.includes("uyqum") || text.includes("uxla")) symptoms.push("Kechki uyqu buzilishi (insomniya)");
  if (text.includes("semiz") || text.includes("vazn ko'p") || text.includes("vaznim yuqori")) symptoms.push("Metabolik yuklama (ortiqcha tana vazni)");

  // Nutritional & habits extraction
  if (text.includes("shor") || text.includes("sho'r") || text.includes("tuz")) {
    extractedParams.tuzIstemi = 'yuqori';
    symptoms.push("Tuz yuklamasi (sho'r taomlarga moyillik)");
  }
  if (text.includes("shirin") || text.includes("non") || text.includes("shakar") || text.includes("osh xamir")) {
    extractedParams.shakarVaXamir = 'kop';
    symptoms.push("Sodda uglevodlar yuklamasi");
  }
  if (text.includes("nos") || text.includes("nosvoy")) {
    extractedParams.nosvoy = 'ha';
    symptoms.push("Nosvoy tamakisi qabul qilish odati");
  }
  if (text.includes("sigaret") || text.includes("chekaman") || text.includes("kashanda")) {
    extractedParams.chekish = 'ha';
    symptoms.push("Tamaki kashandaligi");
  }

  // Fergana region triggers
  let locationText = "Farg'ona tumanlari";
  const regions = ["qo'qon", "qooqon", "marg'ilon", "margilon", "quva", "rishton", "oltiariq", "farg'ona", "fargona"];
  for (const r of regions) {
    if (text.includes(r)) {
      locationText = r.charAt(0).toUpperCase() + r.slice(1);
      extractedParams.shaharTuman = locationText;
      break;
    }
  }

  // Generate recommendations
  const recs: string[] = [
    "Dastlabki tahlillarga ko'ra, xavf tug'diruvchi omillarni kamaytirish uchun tuzli taomlar va yog'li vodiycha palov iste'molini minimallashtiring.",
    "Kunda kamida 30 daqiqa (taxminan 4-5 km) shoshilmasdan o'rtacha jadal piyoda yurish rejimini joriy qiling.",
    "Arterial qon bosimingizni tonggi soat 8:00 va kechki soat 20:00 da o'lchab borishni odat qiling."
  ];

  if (extractedParams.nosvoy === 'ha' || extractedParams.chekish === 'ha') {
    recs.push("Qon tomirlari tonusi va shilliq pardalar salomatligi uchun zudlik bilan tamaki/nosvoydan butunlay voz kechish choralari talab qilinadi.");
  }

  // Missing properties check
  let needsMore = false;
  if (!extractedParams.yosh) { needsMore = true; questions.push("Yoshingizni kiritsangiz, yosh guruhiga oid statistik etalonlar bilan taqqoslaymiz."); }
  if (!extractedParams.boy || !extractedParams.vazn) { needsMore = true; questions.push("Aniq Tana massasi indeksini (TMI) aniqlashimiz uchun bo'yingiz va vazningizni ham kiriting."); }
  if (!extractedParams.sistolik) { needsMore = true; questions.push("Gipertoniya xavf darajasini to'g'ri baholashga oxirgi marta o'lchalgan qon bosimi ko'rsatkichi (masalan: 130/80) juda zarur."); }

  const fallbackResult: TextAnalysisResponse = {
    muvaffaqiyatli: true,
    aniqlanganParametrlar: extractedParams,
    tahlilMatni: `Matn tahliliga ko'ra bemorda quyidagi klinik belgilar mavjudligi taxmin qilinadi: ${symptoms.length > 0 ? symptoms.join(", ") : "aniqlanmagan salomatlik shikoyatlari"} Hamda Farg'ona vodiysi profilaktika modellari asosida birlamchi tahlil o'tkazildi. (Izoh: Sun'iy Intellekt API kaliti sozlanmaganligi tufayli lokal tahlilchi xizmatidan foydalanildi).`,
    tavsiyalar: recs,
    yanaMalumotKerakmi: needsMore,
    aniqlashtiruvchiSavollar: questions
  };

  return res.json(fallbackResult);
});

/**
 * Endpoint 3: AI Advisor Chat (Dynamic personalization and Q&A)
 * Leverages Gemini API to simulate an expert preventive medicine consultant
 */
app.post("/api/advisor-chat", async (req, res) => {
  try {
    const { messages, patientData, riskResult } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Xabarlar tarixi topilmadi." });
    }

    const lastMessage = messages[messages.length - 1];
    const userText = lastMessage?.text || "";

    const pat = patientData || {};
    const ris = riskResult || {};

    const systemPrompt = `Siz Farg'ona vodiysi profilaktik tibbiyot va sog'liqni saqlash ilmiy dissertatsiyasi asosida ishlaydigan va bemorlarga o'zbek tilida professional maslahat beruvchi mehribon, tajribali Sun'iy Intellekt-shifokori va kardiologiya sohasi maslahatchisiz.
Bemor ma'lumotlari:
- Yosh: ${pat.yosh || "Kiritilmagan"}
- Jins: ${pat.jins || "Kiritilmagan"}
- Bo'yi va vazni: ${pat.boy || "Noaniq"} sm, ${pat.vazn || "Noaniq"} kg (TMI: ${(pat.vazn / Math.pow((pat.boy || 170) / 100, 2)).toFixed(1)} kg/m²)
- Arterial Qon bosimi: ${pat.sistolik || "Noaniq"}/${pat.diastolik || "Noaniq"} mmHg
- Tuz iste'moli: ${pat.tuzIstemi || "ortacha"}
- Nosvoy / Chekish: Nosvoy: ${pat.nosvoy || "yoq"}, Chekish: ${pat.chekish || "yoq"}
- Shahar/Tuman: ${pat.shaharTuman || "Farg'ona"}

Tahlil natijasi:
- Xavf (risk) ko'rsatkichi: ${ris.riskFoizi || "Hisoblanmagan"}%
- Salomatlik zonasi: ${ris.zona || "Noaniq"}

Sizning vazifangiz: Bemorning o'zbek tilida bergan savollariga o'zbekona mehmondo'stlik, chuqur tibbiy kompetensiya, parhez yo'riqnomalari (xususan palov, somsa, qozon kabob kabi milliy taomlardagi tuz/yog' muvozanatini saqlash bo'yicha maslahatlar), faol harakat rejasi va vrach komplayensini shakllantirish bo'yicha batafsil javob berish. Agar nosvoy ishlatsa, nosvoyning arterial qon tomir spazmiga keltiradigan halokatli asoratlarini isbotlar bilan (ilmiy 3-yangilik asosida) tushuntiring.
Suhbat uslubi: Professional kardiolog shifokor kabi o'ta samimiy, dono va ilmiy isbotlarga tayangan holda o'zbek tilida bo'lishi lozim.`;

    if (aiClient) {
      try {
        console.log("Advisor chat querying Gemini API...");
        const response = await aiClient.models.generateContent({
          model: "gemini-3.5-flash",
          contents: messages.map((m: any) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.text }]
          })),
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.5
          }
        });

        const replyText = response.text || "Kechirasiz, javob olishda xatolik bo'ldi.";
        return res.json({ text: replyText });
      } catch (err: any) {
        console.error("Gemini Advisor Query Error, using local fallback:", err);
      }
    }

    // LOCAL HEURISTIC DYNAMIC CHAT BACKUP
    console.log("Running local fallback chat responder...");
    const msgLower = userText.toLowerCase();
    let answer = "";

    if (msgLower.includes("salom") || msgLower.includes("assalo")) {
      answer = `Assalomu alaykum! Men sizning shaxsiy salomatlik va kardiologik profilaktika bo'yicha sun'iy intellekt maslahatchingizman. 

Sizning yoshingiz ${pat.yosh || 40} da, qon bosimingiz esa ${pat.sistolik || 120}/${pat.diastolik || 80} mmHg atrofida. 

Sizga kardiologik xavfli omillaringizni kamaytirish va Farg'ona vodiysi sharoitidagi to'g'ri taomlanish (yog'siz palov, kam tuzli sho'rva), nosvoydan voz kechish yoki jismoniy faollik haqida qanday yordam bera olaman?`;
    } else if (msgLower.includes("palov") || msgLower.includes("osh") || msgLower.includes("ovqat") || msgLower.includes("taom") || msgLower.includes("go'sht") || msgLower.includes("gosht")) {
      answer = `Farg'ona vodiysi oshxona madaniyatida palov va xamirli taomlar juda mashhur, ammo ular tarkibidagi yuqori oziq-ovqat tuzi va hayvon yog'lari qon bosimini keskin oshirib, tomirlarda ateroskleroz keltirib chiqaradi.

Sizga amaliy tavsiyalarimiz (Dissertatsiya 3-ilmiy yangiligi mezonlari):
1. **Yog' miqdorini kamaytirish:** Palov tayyorlashda hayvon (dumbba) yog'i va o'ta qizdirilgan paxta yog'idan butunlay voz kechib, kungaboqar yoki zaytun yog'idan me'yorida foydalaning.
2. **Kamroq tuz:** Palov guruchi va sabzavotlari dimlanayotganda tuz solish darajasini minimumga (kuniga 5g tuzi standarti) keltiring.
3. **Porsiya nazorati:** Palovni sabzavotli salat (achchiq-chuchuk, lekin tuzsiz) va yangi ko'katlar bilan 1:1 nisbatda iste'mol qiling. Bu to'qlik hissini beradi va uglevod yuklamasini kamaytiradi.`;
    } else if (msgLower.includes("tuz") || msgLower.includes("shor") || msgLower.includes("sho'r")) {
      answer = `Tuz (natriy xlorid) qon tomirlarida suvni ushlab qolib, aylanma qon hajmini oshiradi va to'g'ridan-to'g'ri arterial gipertoniyaga (qon bosimining yuqorilab ketishiga) olib keladi.

Farg'ona vodiysi aholisi odatda kuniga 12-15 grammgacha tuz iste'mol qiladi, holbuki JSST standarti va bizning dissertatsion modelimiz bo'yicha me'yor **5 grammdan (bir choy qoshiq)** oshmasligi lozim!

Tuz iste'moli bo'yicha shaxsiy maslahatimiz:
- Ovqat pishgandan keyin likopchada qo'shimcha tuz sepmang.
- Sho'r bodring, chips, va uzoq saqlanadigan konservalarni cheklang.
- Tuz o'rniga taomga tabiiy limon suvi, sarimsoq, kashnich va turli xushbuy ko'katlarni ko'proq ishlating. Bu taom ta'mini yaxshilaydi va bosimni pasaytiradi.`;
    } else if (msgLower.includes("nos") || msgLower.includes("nosvoy")) {
      answer = `Diqqat: Nosvoy - tamaki mahsulotining eng zaharli va qon tomirlarga zudlik bilan shikast yetkazuvchi shakllaridan biridir! 

Ilmiy tadqiqotlarimizda (Innovation 3) aniqlanishicha, nosvoy otilganda tarkibidagi nikotin va ishqorlar ta'sirida og'iz bo'shlig'i shilliq qavati orqali qonga tez so'riladi va 2-3 daqiqa ichida qon tomirlarining o'tkir spazmini (qisilishini) keltirib chiqaradi.

Buning natijasida:
- Arterial qon bosimi birdaniga **15-25 mmHg** ga ko'tariladi.
- Yurak urishi tezlashib, yurak mushagida kislorod yetishmasligi boshlanadi (Ishemiya xavfi).
- Tomir devorlari mo'rtlashadi.

Nosvoy tashlash siz uchun hozirgi salomatligingizda eng birinchi darajali vazifadir. Nosvoy o'rniga yalpizli konfetlar iste'moli yoki shifokor bilan maslahatlashib nikotin plasterlarini qo'llashni tavsiya qilamiz.`;
    } else if (msgLower.includes("bosim") || msgLower.includes("davlen") || msgLower.includes("gipertoniya") || msgLower.includes("sistolik") || msgLower.includes("diastolik")) {
      answer = `Sizda arterial qon bosimi ko'rsatkichi ${pat.sistolik || 120}/${pat.diastolik || 80} mmHg ga teng. 

Bosimni doimiy ravishda normal (120/80) saqlab turish uchun quyidagi qoidalarga amal qilishingiz shart:
1. **Kundalik monitoring:** Har kuni ertalabki nonushtadan oldin va kechqurun uyquga ketishdan oldin qon bosimingizni o'lchang va yozib boring.
2. **Pedagog va Shifokor bo'lsangiz (Komplayens):** Agar siz tibbiyot pedagog xodimi bo'lsangiz, o'z bilimlaringiz mukammal bo'lsa ham shaxsiy hayotda buna rioya qilmaslik (nomutanosiblik) aniqlangan. Dori qabul qilish va parhezga qat'iy munosabat yarating.
3. **Shifokor tavsiyasi:** Bosim 140/90 mmHg dan baland turganda oilaviy shifokor belgilagan kardiologik dorilarni o'z vaqtida, uzluksiz ichish shart. Semptomlar yo'qolganda dorilarni o'zboshimchalik bilan tashlab yubormang!`;
    } else if (msgLower.includes("harakat") || msgLower.includes("sport") || msgLower.includes("yurish") || msgLower.includes("piyoda") || msgLower.includes("fizika") || msgLower.includes("mashq")) {
      answer = `Piyoda yurish va kardiomashqlar qon tomir tonusini yaxshilaydi, qon aylanishini faollashtiradi va yurak mushagini baquvvat qiladi.

Bizning tavsiyamiz:
- Kuniga kamida **8,000 - 10,000 qadam** piyoda yuring.
- Haftasiga kamida 5 marta 30-45 daqiqa davomida jadal (o'rtacha tezlikda terlaydigan darajada) yurish rejimini odatga aylantiring.
- Lift o'rniga pillapoyalardan foydalaning va har 1 soatlik ofis ishidan so'ng 5 daqiqa davomida turib yengil gimnastika qiling.`;
    } else {
      answer = `Tushunarli. Biz sizning salomatlik va profilaktika bo'yicha bergan savolingizni diqqat bilan o'rgandik.

Sizning yoshingiz (${pat.yosh || "Noaniq"} yosh), oilaviy pretsedentlar va nutritiv status ko'rsatkichlaringiz (TMI, tuz miqdori, hayot tarzi) salomatligingizda muhim ahamiyat kasb etadi. Doimiy ravishda tuzsiz parhezga, jismoniy faollikka (piyoda yurish) va agar tibbiyot sohasi mutaxassisi bo'lsangiz - shaxsiy salomatlik komplayensiga mas'uliyat bilan yondashishingizni ommaviy profilaktika algoritmlari doirasida qat'iy tavsiya qilamiz.

Salomatligingiz bo'yicha yana qanday batafsil maslahat kerak? Masalan, palovni parhez qilish yoki nosvoyni tashlash usullari haqida quyida so'rashingiz mumkin.`;
    }

    return res.json({ text: answer });
  } catch (err: any) {
    console.error("Advisor chat general error:", err);
    return res.status(500).json({ error: "Maslahat chat tizimida xatolik yuz berdi" });
  }
});

// ----------------------------------------------------
// Serve App
// ----------------------------------------------------

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Mounted Vite development middleware.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log(`Mounted production build directory: ${distPath}`);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
