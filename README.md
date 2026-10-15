# Donozologik Monitoring va Kasbiy Riskni Prognozlash Milliy Portali

React + Vite frontend for the national multi-role portal API ([FastAPI docs](https://api.energohealth-predict.uz/docs)).

**Production:** https://energohealth-predict.uz  
**API:** https://api.energohealth-predict.uz

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and set `VITE_API_URL` (default: `https://api.energohealth-predict.uz`)
3. `npm run dev` — opens Vite dev server (usually http://localhost:5173)

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (connects to remote FastAPI) |
| `npm run dev:legacy` | Old Express+Gemini local server |
| `npm run build` | Production build |
| `npm run lint` | TypeScript check |

## API

- Swagger: https://api.energohealth-predict.uz/docs
- Auth: JWT Bearer token (`access_token` in localStorage)
- Roles: `xodim`, `shifokor`, `admin`

## Admin panel — Hisobot konstruktori

`Hisobot konstruktori` bo'limi (admin) so'rovnoma javoblaridan istalgan kesimda hisobot tuzish imkonini beradi:

- **Ustunlar** — tayyor o'zgaruvchilar (`q1..q71`, `risk`, `zona`, `bmi`, `sistolik`, `yosh`, `jins` ...) yoki o'z formulangiz.
- **Filtr** — mantiqiy shart, masalan `jins = "Erkak" and risk >= 50`.
- **Guruhlash** — `q9`, `BUCKET(yosh, 30, 45, 60)` va h.k.; har bir ustun uchun agregat: M ± m, mediana, 95% IO, % va boshqalar.
- **Eksport** — Excel (hisobot + metodika varag'i), CSV, chop etish/PDF. Shablonlar brauzerda saqlanadi.

Formula dvigateli: `src/lib/formulaEngine.ts` (xavfsiz, `eval`siz). Funksiyalar ro'yxati paneldagi "Funksiyalar" bo'limida.

## Biostatistika

- **Testlar** (`src/lib/stats.ts`): Styudent t (klassik) va Welch t, bir omilli ANOVA, Pearson χ² (r×c; 2×2 da kutilgan < 5 bo'lsa Fisher), Puasson darajalar bir xilligi χ², OR (95% IO), Wilson IO. Natijalar SciPy bilan solishtirib tekshirilgan. p yonida `*` (<0,05), `**` (<0,01), `***` (<0,001); ishonchli qatorlar qalin.
- **Konstruktor → 4. Taqqoslash**: guruhlar bo'yicha yoki ikki guruh (A/B formula) — har bir ustun uchun M ± m + t/ANOVA yoki n (%) + χ². Excel, Word va chop etishga qo'shiladi.
- **Intensiv / ekstensiv**: agregatlar "Intensiv, % (100 ga)", "Intensiv, ‰ (1000 ga)", "Ekstensiv, % (jami)".
- **Kasallanish va gigiyena** (admin bo'limi): 5 yillik VMLK (shablon yoki 16-VN shakli) va gigiyenik o'lchovlar importi — dinamika, tuzilma, intensiv ko'rsatkichlar, guruhlar taqqoslash; Excel/Word eksport. Ma'lumot brauzerda saqlanadi.
- **SPSS (.sav)**: konstruktor (filtrdan o'tganlar, taqqoslash guruhi `GURUH`) va jonli N=400 tanlamasi; o'zgaruvchi/qiymat yorliqlari, UTF-8.

## Hisob-kitob isboti (har bir anketa)

"So'rovnomalar" hisobotida va xodimning natija sahifasida har bir ko'rsatkich qadam-baqadam isbotlanadi (`src/lib/riskEvidence.ts`, `src/components/RiskEvidencePanel.tsx`). Hisob brauzerda, anketa javoblaridan bajariladi, shuning uchun har bir yangi anketaga ham avtomatik qo'llanadi.

- **Validatsiya**: oraliqdan tashqaridagi qiymatlar (yosh, vazn, bo'y, bosim, glyukoza) xato deb topiladi va hisobga olinmaydi; yashirin standart qiymat ishlatilmaydi.
- **TVI**, **AQB toifasi**, **integral ballar** (Ha = 2, Ba'zan = 1, Yo'q = 0; 0–10 shkala), **A guruhi omillari** (1/0), **Fine-Kinney** R = P × E × C va R_itog.
- **Framingham 2008** (TVI asosidagi model) — 10 yillik yurak-qon tomir kasalligi xavfi, koeffitsientlar va har bir ko'paytma bilan.
- **Zona** — mijoz hujjatidagi qizil / sariq / yashil mezonlar jadvali, har bir mezon bajarilgan-bajarilmagani bilan.
- **Kasallik risk prognozlari** (`src/lib/diseaseRisk.ts`) — xavf indeksi = Σ ball / (2 × omillar soni) × 100%, har bir omil dalili bilan.
- Fine-Kinney uchun javob → P, E, C jadvali (`FINE_KINNEY_TABLE`) ekspert taklifi; dissertatsiya muallifi tasdiqlashi kerak.
- Konstruktor o'zgaruvchilari: `zona_isbot`, `framingham`, `r_itog`, `ovqat_ball`, `stress_ball`, `chekish_omil`, `gipodinamiya`, `ovqat_omil`, `stress_omil`, `idx_<kasallik>`.

