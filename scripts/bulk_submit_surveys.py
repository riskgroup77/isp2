#!/usr/bin/env python3
"""698 xodim uchun anketa javoblarini generatsiya qilib API ga yuborish."""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime
from pathlib import Path

import pandas as pd

API_BASE = "https://api.energohealth-predict.uz"
WORKERS_CSV = Path(__file__).resolve().parent.parent / "data" / "registered_workers.csv"
QUESTIONS_JSON = Path(__file__).resolve().parent.parent / "data" / "questionnaire.json"
LOG_PATH = Path(__file__).resolve().parent.parent / "data" / "bulk_survey_log.json"
DEFAULT_EXCEL = Path(r"c:\Users\User\Downloads\Telegram Desktop\список работников для защиты.xlsx")

PATRONYMIC_RE = re.compile(
    r"(ovich|evich|ovna|evna|vna|ich|ug(?:li|li)|qizi)$", re.IGNORECASE
)


def resolve_excel_path(custom: Path | None = None) -> Path:
    if custom and custom.exists():
        return custom
    if DEFAULT_EXCEL.exists():
        return DEFAULT_EXCEL
    folder = Path(r"c:\Users\User\Downloads\Telegram Desktop")
    if folder.is_dir():
        for p in sorted(folder.glob("*.xlsx"), key=lambda x: x.stat().st_mtime, reverse=True):
            try:
                if len(pd.read_excel(p)) >= 600:
                    return p
            except Exception:
                continue
    return DEFAULT_EXCEL


def http_json(method: str, path: str, payload: dict | None = None, token: str | None = None) -> dict:
    headers = {"Content-Type": "application/json", "User-Agent": "EnergoHealth-BulkSubmit/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(f"{API_BASE}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode())


def login_user(login: str, password: str) -> str:
    res = http_json("POST", "/api/auth/login", {"login": login, "password": password})
    return res["access_token"]


def fetch_questions(retries: int = 12, delay: float = 8.0) -> dict:
    if QUESTIONS_JSON.exists():
        try:
            cached = json.loads(QUESTIONS_JSON.read_text(encoding="utf-8"))
            if cached.get("questions"):
                return cached
        except Exception:
            pass
    last: Exception | None = None
    for attempt in range(retries):
        try:
            data = http_json("GET", "/api/surveys/questions")
            QUESTIONS_JSON.parent.mkdir(parents=True, exist_ok=True)
            QUESTIONS_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            return data
        except Exception as exc:
            last = exc
            if attempt + 1 < retries:
                print(f"API javob bermadi, qayta urinish {attempt + 2}/{retries}...")
                time.sleep(delay)
    if QUESTIONS_JSON.exists():
        return json.loads(QUESTIONS_JSON.read_text(encoding="utf-8"))
    assert last is not None
    raise last


def detect_gender(full: str) -> str:
    lower = full.lower()
    if "ovna" in lower or "evna" in lower or "qizi" in lower:
        return "Ayol"
    return "Erkak"


def calc_age(birth) -> int:
    if pd.isna(birth):
        return 40
    born = pd.to_datetime(birth).date()
    today = date.today()
    return max(20, min(today.year - born.year - ((today.month, today.day) < (born.month, born.day)), 65))


def calc_staj_years(start) -> int:
    if pd.isna(start):
        return 10
    s = pd.to_datetime(start).date()
    return max(1, date.today().year - s.year)


def map_kasb_option(kasb: str, options: list[str]) -> str:
    lower = kasb.lower()
    rules = [
        ("chilangar", "Chilangar"),
        ("payvand", "Payvandchi"),
        ("elektrmontyor", "Elektromontyor"),
        ("elektrmont", "Elektromontyor"),
        ("laborant", "Laborant"),
        ("muhandis", "Texnik mutaxassis"),
        ("boshqaruv", "Boshqaruvchi"),
        ("smena boshlig", "Boshqaruvchi"),
    ]
    for kw, val in rules:
        if kw in lower and val in options:
            return val
    if "Ishlab chiqarish ishchisi" in options:
        return "Ishlab chiqarish ishchisi"
    return options[0] if options else kasb


def map_sex_option(job: str, options: list[str]) -> str:
    lower = job.lower()
    rules = [
        ("qozon", "Qozonxona sexi"),
        ("turbina", "Turbinalar sexi"),
        ("elektr", "Elektr sexi"),
        ("osdt", "SKT va OSDT"),
        ("skt", "SKT va OSDT"),
        ("kimyoviy", "Kimyoviy sexi"),
        ("gaz turbina", "Gaz turbina qurilmasi sexi"),
    ]
    for kw, val in rules:
        if kw in lower and val in options:
            return val
    return options[0] if options else "Boshqa"


def map_staj_option(years: int, options: list[str]) -> str:
    if years < 1:
        return pick_option(options, ["Bir yildan kam"])
    if years <= 4:
        return pick_option(options, ["2 yildan 4 yilgacha"])
    if years <= 9:
        return pick_option(options, ["5 yildan 9 yilgacha"])
    if years <= 14:
        return pick_option(options, ["10 yildan 14 yilgacha"])
    if years <= 19:
        return pick_option(options, ["15 yildan 19 yilgacha"])
    return pick_option(options, ["20 yil va undan katta"])


def pick_option(options: list[str], preferred: list[str] | None = None, rng: random.Random | None = None) -> str:
    if not options:
        return ""
    r = rng or random
    if preferred:
        for p in preferred:
            for o in options:
                if p.lower() in o.lower():
                    return o
    return r.choice(options)


def generate_disease_profile(rng: random.Random, age: int, job: str) -> dict:
    job_l = job.lower()
    has_resp = any(k in job_l for k in ["turbina", "qozon", "chang", "nafas", "osdt"]) or rng.random() < 0.34
    has_msk = any(k in job_l for k in ["chilangar", "tokar", "mashinist"]) or rng.random() < 0.27
    has_cv = age > 40 or rng.random() < 0.17
    has_nerv = rng.random() < 0.11
    has_gu = rng.random() < 0.07
    has_gi = rng.random() < 0.04

    q43: list[str] = []
    if has_cv:
        q43.append("Yurak-qon tomir tizimi kasalliklari")
    if has_resp:
        q43.append("Yuqori va quyi nafas organlari kasalliklari")
    if has_nerv:
        q43.append("Nerv sistemasi kasalliklari")
    if has_gu:
        q43.append("Buyrak kasalliklari")
    if not q43:
        q43 = ["Yuqori va quyi nafas organlari kasalliklari"]

    chronic = has_cv or has_resp or (age > 45 and rng.random() < 0.5)
    chronic_text = ", ".join(q43[:2]) if chronic else ""

    return {
        "q43": q43[:2],
        "chronic": chronic,
        "chronic_text": chronic_text,
        "has_resp": has_resp,
        "has_msk": has_msk,
        "has_cv": has_cv,
        "has_nerv": has_nerv,
        "sick_days": rng.choice(["1", "2", "3"]) if chronic else "1",
    }


def generate_clinical(rng: random.Random, age: int, gender: str, profile: dict) -> dict:
    if gender == "Erkak":
        vazn = rng.randint(70, 92)
        boy = rng.randint(168, 182)
    else:
        vazn = rng.randint(58, 76)
        boy = rng.randint(158, 170)
    sistolik = rng.randint(118, 145)
    if profile["has_cv"]:
        sistolik = rng.randint(135, 165)
    diastolik = max(65, int(sistolik * 0.65) + rng.randint(-4, 6))
    return {
        "sistolik": sistolik,
        "diastolik": diastolik,
        "vazn": vazn,
        "boy": boy,
        "glyukoza": round(rng.uniform(4.8, 6.9 if profile["has_cv"] else 5.8), 1),
        "xolesterin": round(rng.uniform(4.2, 6.2 if profile["has_cv"] else 5.4), 1),
    }


def generate_answers(questionnaire: dict, profile: dict, rng: random.Random) -> dict:
    qmap = {str(q["id"]): q for q in questionnaire.get("questions", [])}
    dp = generate_disease_profile(rng, profile["age"], profile["job"])
    klinik = generate_clinical(rng, profile["age"], profile["gender"], dp)
    gender = profile["gender"]
    answers: dict = {}

    def opt(qid: str, pref: list[str] | None = None) -> str:
        return pick_option(qmap[qid].get("options") or [], pref, rng)

    def multi(qid: str, values: list[str]) -> list[str]:
        options = qmap[qid].get("options") or []
        out = [v for v in values if v in options]
        return out or ([rng.choice(options)] if options else [])

    birth = profile["birth"]
    answers["1"] = "Roziman"
    answers["2"] = "Farg'ona Issiqlik Elektr Stansiyasi"
    answers["3"] = birth
    answers["4"] = klinik["vazn"]
    answers["5"] = gender
    answers["6"] = opt("6", ["Turmush qurgan", "Turmush qurmagan"])
    answers["7"] = opt("7", ["Kasb-hunar va o'rta ma'lumot", "Oliy"])
    answers["8"] = map_kasb_option(profile["kasb"], qmap["8"].get("options") or [])
    if answers["8"] == "Boshqa":
        answers["8a"] = profile["kasb"]
    answers["9"] = map_sex_option(profile["job"], qmap["9"].get("options") or [])
    if answers["9"] == "Boshqa":
        answers["9a"] = profile["sex"]
    answers["10"] = map_staj_option(profile["staj"], qmap["10"].get("options") or [])
    answers["11"] = multi("11", ["Smenali"])

    noisy = any(k in profile["job"].lower() for k in ["turbina", "qozon", "elektr", "chang"])
    answers["12"] = opt("12", ["Yuqori", "O'rtacha"] if noisy else ["O'rtacha", "Past"])
    answers["13"] = opt("13", ["Ha"] if "qozon" in profile["job"].lower() else ["Yo'q", "Ha"])
    answers["14"] = opt("14", ["Doim", "Ba'zan"])
    answers["15"] = multi("15", ["Shovqin darajasi", "Chang"] if noisy else ["Jismoniy zo'riqish"])
    answers["16"] = opt("16", ["Ma'lum darajada", "Katta darajada"])
    answers["17"] = opt("17", ["Katta darajada", "Ma'lum darajada"])
    answers["18"] = opt("18", ["Qoniqaman", "Qoniqarsiz"])
    answers["19"] = opt("19", ["Ha, lekin ozgina", "Yo'q, umuman yo'q"])
    answers["20"] = opt("20", ["Ba'zan", "Ko'pincha"] if dp["has_msk"] else ["Ba'zan", "Umuman yo'q"])
    answers["21"] = opt("21", ["Ba'zan", "Ko'pincha"] if dp["has_nerv"] else ["Ozgina vaqt", "Umuman yo'q"])
    answers["22"] = opt("22", ["Tik turish", "O'tirish"])
    answers["23"] = opt("23", ["Ha"])
    answers["24"] = opt("24", ["4-5 soat", "6-8 soat"] if noisy else ["2-3 soat"])
    answers["25"] = opt("25", ["Ha", "Yo'q"])
    answers["26"] = opt("26", ["Ha", "Yo'q"])
    answers["27"] = opt("27", ["Ha", "Yo'q"] if dp["has_nerv"] else ["Yo'q"])
    answers["28"] = opt("28", ["Ba'zan", "Ha"] if dp["has_cv"] else ["Yo'q", "Ba'zan"])
    answers["29"] = opt("29", ["Ba'zan", "Ha"] if dp["has_nerv"] else ["Yo'q"])
    answers["30"] = opt("30", ["Ba'zan", "Ha"] if dp["has_resp"] else ["Yo'q"])
    answers["31"] = opt("31", ["Ba'zan", "Ha"] if dp["has_msk"] else ["Yo'q"])
    answers["32"] = opt("32", ["Ba'zan", "Yo'q"])
    answers["33"] = opt("33", ["Ba'zan", "Yo'q"])
    answers["34"] = multi("34", ["Oddiy suv", "Choy"])
    answers["35"] = opt("35", ["2-2,5 litr", "1,5-1,8 litr"])

    answers["36"] = opt("36", ["O'rtacha", "Yaxshi"] if not dp["chronic"] else ["O'rtacha", "Yomon"])
    answers["37"] = opt("37", ["Ha", "Bilmayman"])
    answers["38"] = opt("38", ["Ha"])
    answers["39"] = opt("39", ["Ha"])
    answers["40"] = f"{klinik['sistolik']}/{klinik['diastolik']}"
    answers["41"] = opt("41", ["Yo'q", "Ha, lekin kamdan-kam hollarda emlanaman"])
    answers["42"] = multi(
        "42",
        ["Nafas qisishi", "Bel yoki bo'g'im og'riqlari", "Tez charchash"] if dp["chronic"] else ["Kuzatilmagan"],
    )
    answers["43"] = multi("43", dp["q43"])
    answers["44"] = "Ha" if dp["chronic"] else "Yo'q"
    if dp["chronic"]:
        answers["44a"] = dp["chronic_text"]
    answers["45"] = dp["sick_days"]
    answers["46"] = opt("46", ["Qisman", "Ha"] if noisy else ["Qisman", "Yo'q"])
    answers["47"] = opt("47", ["Yo'q", "Sport inshootlari yo'q"])
    answers["48"] = opt("48", ["Yo'q", "Ha"])
    answers["50"] = opt("50", ["Ha", "Yo'q"])

    answers["51"] = opt(
        "51",
        ["Hozirda chekaman"] if gender == "Erkak" and rng.random() < 0.3 else ["Hech qachon chekmaganman", "Ilgari chekardim, lekin tashladim"],
    )
    answers["52"] = opt("52", ["Yo'q, lekin xohlardim", "Yo'q va xohlamasdim"])
    answers["56"] = opt("56", ["Qisman", "Ha"])
    answers["57"] = opt("57", ["Ha"] if noisy and dp["chronic"] else ["Yo'q"])
    answers["58"] = opt("58", ["Qisman", "Ha"])
    answers["59"] = opt("59", ["Ba'zan", "Ha"] if dp["has_nerv"] else ["Ba'zan", "Yo'q"])
    answers["60"] = opt("60", ["Ha", "Yo'q"])
    answers["61"] = multi("61", ["Tibbiyot xodimlarining hisoblari", "Ish joyidagi ma'ruzalar"])
    answers["62"] = opt("62", ["Kompaniya hududidagi oshxona/kafega boraman", "Uydan ovqat olib kelaman"])
    answers["63"] = opt("63", ["Men vaqti-vaqti bilan, hech bo'lmaganda ba'zan tashrif buyuraman"])
    answers["65"] = opt("65", ["3 marta"])
    answers["66"] = opt("66", ["Har kuni", "Haftada bir marta"])
    answers["67"] = opt("67", ["Muntazam ravishda", "Vaqti-vaqti bilan"])
    answers["68"] = opt("68", ["Oq non", "Qora non"])
    answers["69"] = opt("69", ["Ha, avval tatib ko'raman kam bo'lsa", "Yo'q, qo'shmayman"])
    answers["70"] = opt("70", ["Yetarli miqdorda", "Kam miqdorda"])
    answers["71"] = multi("71", ["Muntazam tibbiy ko'riklarni tashkil etish", "Sog'lomlashtirish darslari"])

    return answers


def is_question_visible(q: dict, answers: dict) -> bool:
    show_if = q.get("showIf")
    if not show_if:
        return True
    ref = str(show_if["questionId"])
    value = answers.get(ref)
    equals = show_if.get("equals")
    if equals is not None:
        if isinstance(value, list):
            return equals in value
        return value == equals
    in_vals = show_if.get("in")
    if in_vals:
        current = value if isinstance(value, list) else ([value] if value is not None else [])
        return any(v in current for v in in_vals)
    return True


def answers_for_api(questionnaire: dict, answers: dict) -> dict:
    visible_ids = {
        str(q["id"])
        for q in questionnaire.get("questions", [])
        if is_question_visible(q, answers)
    }
    return {k: v for k, v in answers.items() if k in visible_ids}


def validate_answers(questionnaire: dict, answers: dict) -> str | None:
    for q in questionnaire.get("questions", []):
        if not is_question_visible(q, answers) or not q.get("required"):
            continue
        qid = str(q["id"])
        val = answers.get(qid)
        if q.get("type") == "multi_choice":
            if not isinstance(val, list) or len(val) == 0:
                return f"Savol {qid}: kamida bitta variant tanlang"
        elif val is None or val == "":
            return f"Savol {qid}: majburiy maydon to'ldirilmagan"
    return None


def check_health(timeout: float = 30.0) -> tuple[bool, str]:
    try:
        with urllib.request.urlopen(f"{API_BASE}/health", timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return True, body
    except Exception as exc:
        return False, str(exc)


def submit_survey(token: str, answers: dict, klinik: dict, skip_ai: bool = True) -> dict:
    return http_json(
        "POST",
        "/api/surveys/submit",
        {"answers": answers, "klinik": klinik, "skip_ai": skip_ai},
        token=token,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Bulk survey submit")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--row", type=int, default=0)
    parser.add_argument("--excel", type=Path, default=None)
    args = parser.parse_args()

    if not WORKERS_CSV.exists():
        print(f"Workers CSV topilmadi: {WORKERS_CSV}", file=sys.stderr)
        return 1

    workers = pd.read_csv(WORKERS_CSV)
    excel_path = resolve_excel_path(args.excel)
    excel = pd.read_excel(excel_path) if excel_path.exists() else None

    ok, health_detail = check_health()
    if not ok:
        print(f"API health check failed: {health_detail}", file=sys.stderr)
        return 1
    print(f"API health OK: {health_detail[:120]}")

    print("Savollar yuklanmoqda...")
    questionnaire = fetch_questions()
    print(f"Anketa: {questionnaire.get('title')} — {questionnaire.get('totalQuestions')} savol")

    log: dict = {"success": [], "failed": [], "skipped": []}
    indices = list(workers.index)
    if args.row:
        indices = [args.row - 1]
    elif args.limit:
        indices = indices[: args.limit]

    total = len(indices)
    print(f"Yuboriladigan xodimlar: {total}")

    for n, idx in enumerate(indices, start=1):
        row = workers.iloc[idx]
        row_no = int(idx) + 1
        login = str(row["login"]).strip()
        password = str(row["password"]).strip()
        ism = str(row["ism"]).strip()

        excel_row = excel.iloc[idx] if excel is not None and idx < len(excel) else None
        full_name = str(excel_row.iloc[1]) if excel_row is not None else ism
        birth = excel_row.iloc[2] if excel_row is not None else None
        job_start = excel_row.iloc[3] if excel_row is not None else None
        job = str(excel_row.iloc[4]) if excel_row is not None else "Xodim"

        age = calc_age(birth)
        gender = detect_gender(full_name)
        staj = calc_staj_years(job_start)
        kasb = job.split()[0] if job else "Xodim"
        sex_opts = next((q.get("options") or [] for q in questionnaire["questions"] if str(q["id"]) == "9"), [])
        sex = map_sex_option(job, sex_opts)

        rng = random.Random(f"{login}-{row_no}")
        profile = {
            "ism": ism,
            "age": age,
            "gender": gender,
            "job": job,
            "kasb": kasb,
            "sex": sex,
            "staj": staj,
            "birth": str(pd.to_datetime(birth).date()) if birth is not None and not pd.isna(birth) else "1985-01-01",
        }

        try:
            token = login_user(login, password)
            dp = generate_disease_profile(rng, age, job)
            klinik = generate_clinical(rng, age, gender, dp)
            raw_answers = generate_answers(questionnaire, profile, rng)
            api_answers = answers_for_api(questionnaire, raw_answers)
            validation_err = validate_answers(questionnaire, api_answers)
            if validation_err:
                raise ValueError(validation_err)
            result = submit_survey(token, api_answers, klinik, skip_ai=True)
            entry = {
                "row": row_no,
                "login": login,
                "ism": ism,
                "survey_id": result.get("response", {}).get("id"),
                "status": "ok",
            }
            log["success"].append(entry)
            if n % 25 == 0 or n == total:
                print(f"[{n}/{total}] OK: {login} — {ism}")
        except urllib.error.URLError as err:
            detail = str(err)
            log["failed"].append({"row": row_no, "login": login, "detail": detail, "connectivity": True})
            print(f"[{n}/{total}] ALOQA XATOSI: {login} — {detail[:120]}")
            print("API bilan aloqa uzildi — bulk yuborish to'xtatildi.")
            break
        except urllib.error.HTTPError as err:
            body = err.read().decode("utf-8", errors="replace")
            low = body.lower()
            if err.code in (409, 400) and ("allaqachon" in low or "already" in low or "mavjud" in low):
                log["skipped"].append({"row": row_no, "login": login, "reason": body[:200]})
                print(f"[{n}/{total}] SKIP: {login}")
            else:
                log["failed"].append({"row": row_no, "login": login, "http": err.code, "detail": body[:500]})
                print(f"[{n}/{total}] XATO {err.code}: {login} — {body[:120]}")
        except Exception as exc:
            log["failed"].append({"row": row_no, "login": login, "detail": str(exc)})
            print(f"[{n}/{total}] XATO: {login} — {exc}")

        time.sleep(0.15)

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== YAKUN ===")
    print(f"Muvaffaqiyatli: {len(log['success'])}")
    print(f"O'tkazilgan: {len(log['skipped'])}")
    print(f"Xato: {len(log['failed'])}")
    print(f"Log: {LOG_PATH}")
    return 0 if not log["failed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
