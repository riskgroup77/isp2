#!/usr/bin/env python3
"""Xodimlarga yangi tasodifiy parol berish (eski "Fami1985!" ko'rinishidagi parollar o'rniga).

Serverda, API konteyneri ichida ishga tushiriladi: u yerda bazaga ulanish
(DATABASE_URL, asyncpg) va bcrypt allaqachon bor.

  Sinov (hech narsa o'zgarmaydi):
    docker exec -i energohealth-api python - < scripts/reset_worker_passwords.py

  Haqiqiy almashtirish (yangi parollar faqat shu CSV faylga yoziladi):
    umask 077; docker exec -i energohealth-api python - --apply \
      < scripts/reset_worker_passwords.py > ~/yangi_parollar.csv

Faqat rol = 'xodim' akkauntlari o'zgaradi; admin va shifokorga tegilmaydi.
Avval bitta akkaunt almashtirilib, API orqali kirish tekshiriladi. Kirish
ishlamasa, o'sha akkauntning eski paroli qaytariladi va boshqalariga tegilmaydi.
Qolganlari bitta tranzaksiyada yangilanadi: xato bo'lsa, hammasi bekor qilinadi.
"""

from __future__ import annotations

import asyncio
import csv
import json
import os
import re
import secrets
import sys
import urllib.error
import urllib.request

# O, 0, I, l, 1 kabi adashtiriladigan belgilarsiz
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
PASSWORD_LEN = 10
LOGIN_URL = "http://127.0.0.1:8000/api/auth/login"


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def new_password() -> str:
    while True:
        pw = "".join(secrets.choice(ALPHABET) for _ in range(PASSWORD_LEN))
        # kamida bitta katta, kichik harf va raqam bo'lsin
        if re.search(r"[A-Z]", pw) and re.search(r"[a-z]", pw) and re.search(r"\d", pw):
            return pw


def bcrypt_cost(sample_hash: str) -> int:
    m = re.match(r"^\$2[aby]\$(\d{2})\$", sample_hash or "")
    if not m:
        raise SystemExit(
            "Bazadagi parol xeshi bcrypt emas (boshi: %r). To'xtatildi, hech narsa o'zgarmadi."
            % (sample_hash or "")[:7]
        )
    return int(m.group(1))


def hash_password(pw: str, cost: int) -> str:
    import bcrypt

    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt(rounds=cost)).decode("ascii")


def api_login_ok(login: str, password: str) -> bool:
    req = urllib.request.Request(
        LOGIN_URL,
        data=json.dumps({"login": login, "password": password}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status == 200 and "access_token" in resp.read().decode("utf-8")
    except urllib.error.HTTPError:
        return False


async def main() -> int:
    apply = "--apply" in sys.argv[1:]
    try:
        import asyncpg  # noqa: F401
        import bcrypt  # noqa: F401
    except ImportError as exc:
        log("Kerakli kutubxona topilmadi: %s. Hech narsa o'zgarmadi." % exc)
        return 2
    import asyncpg

    dsn = os.environ.get("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://")
    if not dsn:
        log("DATABASE_URL topilmadi. Hech narsa o'zgarmadi.")
        return 2

    conn = await asyncpg.connect(dsn)
    try:
        rows = await conn.fetch(
            "SELECT id, ism, login, password_hash FROM users WHERE rol = 'xodim' ORDER BY ism, login"
        )
        others = await conn.fetchval("SELECT count(*) FROM users WHERE rol <> 'xodim'")
        if not rows:
            log("Xodim akkauntlari topilmadi.")
            return 1
        cost = bcrypt_cost(rows[0]["password_hash"])
        bad = [r["login"] for r in rows if not re.match(r"^\$2[aby]\$", r["password_hash"] or "")]
        if bad:
            log("%d ta akkauntda bcrypt bo'lmagan xesh bor. To'xtatildi." % len(bad))
            return 2

        log("Xodim akkauntlari: %d (o'zgaradi)" % len(rows))
        log("Admin/shifokor akkauntlari: %d (tegilmaydi)" % others)
        log("Xesh turi: bcrypt, cost = %d" % cost)
        if not apply:
            log("SINOV rejimi: hech narsa o'zgarmadi. Almashtirish uchun --apply qo'shing.")
            return 0

        # 1) Bitta akkauntda sinab ko'rish
        canary = rows[0]
        canary_pw = new_password()
        await conn.execute(
            "UPDATE users SET password_hash = $1 WHERE id = $2",
            hash_password(canary_pw, cost),
            canary["id"],
        )
        if not api_login_ok(canary["login"], canary_pw):
            await conn.execute(
                "UPDATE users SET password_hash = $1 WHERE id = $2",
                canary["password_hash"],
                canary["id"],
            )
            log("Yangi parol bilan API orqali kirib bo'lmadi. Eski parol qaytarildi, boshqalarga tegilmadi.")
            return 3
        log("Sinov akkaunti yangi parol bilan kirdi. Qolganlari yangilanmoqda...")

        # 2) Qolganlari bitta tranzaksiyada
        result = [(canary, canary_pw)]
        updates = []
        for i, r in enumerate(rows[1:], start=2):
            pw = new_password()
            updates.append((hash_password(pw, cost), r["id"]))
            result.append((r, pw))
            if i % 50 == 0:
                log("  %d/%d" % (i, len(rows)))
        async with conn.transaction():
            await conn.executemany("UPDATE users SET password_hash = $1 WHERE id = $2", updates)
    finally:
        await conn.close()

    out = csv.writer(sys.stdout)
    out.writerow(["ism", "login", "yangi_parol"])
    for r, pw in result:
        out.writerow([r["ism"], r["login"], pw])
    sys.stdout.flush()
    log("Tayyor: %d ta xodimga yangi parol berildi." % len(result))
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
