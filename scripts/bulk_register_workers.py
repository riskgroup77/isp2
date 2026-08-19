#!/usr/bin/env python3
"""Excel ro'yxatidagi xodimlarni EnergoHealth-Predict API ga ro'yxatdan o'tkazish."""

from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import date, datetime
from pathlib import Path

import pandas as pd

API_URL = "https://api.energohealth-predict.uz/api/auth/register"
EXCEL_PATH = Path(r"c:\Users\User\Downloads\Telegram Desktop\список работников для защиты.xlsx")
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "registered_workers.csv"
LOG_PATH = Path(__file__).resolve().parent.parent / "data" / "bulk_register_log.json"

PATRONYMIC_RE = re.compile(
    r"(ovich|evich|ovna|evna|vna|ich|ug(?:li|li)|qizi)$", re.IGNORECASE
)


def slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.lower()
    for ch in ("ʻ", "ʼ", "’", "`", "'"):
        text = text.replace(ch, "")
    text = re.sub(r"[^a-z0-9]", "", text)
    return text


def parse_full_name(full: str) -> tuple[str, str, str]:
    parts = [p for p in full.strip().split() if p]
    if not parts:
        return "Noma", "lum", "Noma lum"

    if len(parts) >= 2 and PATRONYMIC_RE.search(parts[-1]):
        parts = parts[:-1]

    if len(parts) >= 2:
        family, first = parts[0], parts[1]
    else:
        family, first = parts[0], "Xodim"

    ism = f"{family} {first}"
    return family, first, ism


def detect_gender(full: str) -> str:
    lower = full.lower()
    if "ovna" in lower or "evna" in lower or "qizi" in lower:
        return "ayol"
    return "erkak"


def calc_age(birth) -> int:
    if pd.isna(birth):
        return 35
    if isinstance(birth, datetime):
        born = birth.date()
    elif isinstance(birth, date):
        born = birth
    else:
        born = pd.to_datetime(birth).date()
    today = date.today()
    age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    return max(18, min(age, 80))


def birth_year(birth) -> int:
    if pd.isna(birth):
        return 1985
    if isinstance(birth, datetime):
        return birth.year
    if isinstance(birth, date):
        return birth.year
    return pd.to_datetime(birth).year


def make_login(first: str, family: str, year: int, row_no: int, used: set[str]) -> str:
    base = f"{slug(first)}.{slug(family)[:10]}{year % 100:02d}"
    if not base.replace(".", ""):
        base = f"xodim{row_no:04d}"
    candidate = base
    suffix = 1
    while candidate in used:
        candidate = f"{base}{suffix}"
        suffix += 1
    used.add(candidate)
    return candidate


def make_password(family: str, year: int) -> str:
    fam = slug(family) or "worker"
    prefix = fam[:1].upper() + fam[1:4]
    return f"{prefix}{year}!"


def register_user(payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    if not EXCEL_PATH.exists():
        print(f"Excel topilmadi: {EXCEL_PATH}", file=sys.stderr)
        return 1

    df = pd.read_excel(EXCEL_PATH)
    name_col = df.columns[1]
    birth_col = df.columns[2]

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    used_logins: set[str] = set()
    rows_out: list[dict] = []
    log: dict = {"success": [], "failed": [], "skipped": []}

    total = len(df)
    print(f"Jami xodimlar: {total}")

    for idx, row in df.iterrows():
        row_no = int(idx) + 1
        full_name = str(row[name_col]).strip()
        if not full_name or full_name.lower() == "nan":
            log["skipped"].append({"row": row_no, "reason": "bo'sh ism"})
            continue

        family, first, ism = parse_full_name(full_name)
        year = birth_year(row[birth_col])
        age = calc_age(row[birth_col])
        gender = detect_gender(full_name)
        login = make_login(first, family, year, row_no, used_logins)
        password = make_password(family, year)

        payload = {
            "ism": ism,
            "login": login,
            "password": password,
            "rol": "xodim",
            "jins": gender,
            "yosh": age,
            "shifoxona": None,
            "mutaxassislik": None,
        }

        try:
            result = register_user(payload)
            entry = {
                "row": row_no,
                "ism": ism,
                "full_name_excel": full_name,
                "login": login,
                "password": password,
                "jins": gender,
                "yosh": age,
                "id": result.get("id"),
                "status": "ok",
            }
            rows_out.append(entry)
            log["success"].append(entry)
            if row_no % 25 == 0 or row_no == total:
                print(f"[{row_no}/{total}] OK: {login} — {ism}")
        except urllib.error.HTTPError as err:
            body = err.read().decode("utf-8", errors="replace")
            entry = {
                "row": row_no,
                "ism": ism,
                "login": login,
                "status": "error",
                "http": err.code,
                "detail": body[:500],
            }
            log["failed"].append(entry)
            print(f"[{row_no}/{total}] XATO {err.code}: {login} — {body[:120]}")
        except Exception as exc:  # noqa: BLE001
            entry = {
                "row": row_no,
                "ism": ism,
                "login": login,
                "status": "error",
                "detail": str(exc),
            }
            log["failed"].append(entry)
            print(f"[{row_no}/{total}] XATO: {login} — {exc}")

        time.sleep(0.15)

    out_df = pd.DataFrame(rows_out)
    out_df.to_csv(OUTPUT_PATH, index=False, encoding="utf-8-sig")

    LOG_PATH.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== YAKUN ===")
    print(f"Muvaffaqiyatli: {len(log['success'])}")
    print(f"Xato: {len(log['failed'])}")
    print(f"O'tkazib yuborilgan: {len(log['skipped'])}")
    print(f"Credentials: {OUTPUT_PATH}")
    print(f"Log: {LOG_PATH}")
    return 0 if not log["failed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
