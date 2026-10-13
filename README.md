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
