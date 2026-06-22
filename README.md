# EnergoHealth-Predict Frontend

React + Vite frontend for [EnergoHealth-Predict](https://api.energohealth-predict.uz/docs) FastAPI backend.

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

