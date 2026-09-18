#!/usr/bin/env python3
"""Opaga yuborish uchun bitta papkaga barcha materiallarni yig'ish."""

from __future__ import annotations

import shutil
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DESKTOP = Path.home() / "Desktop"
PACK = DESKTOP / f"Opaga_topshirish_{date.today().isoformat()}"


def latest(pattern: str) -> Path | None:
    files = sorted(DATA.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def copy_if_exists(src: Path | None, dst: Path) -> bool:
    if src and src.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        return True
    return False


def build_readme() -> str:
    return f"""OPAGA YUBORISH PAKETI
{'=' * 50}
Sana: {date.today().strftime('%d.%m.%Y')}
Korxona: Farg'ona Issiqlik Elektr Stansiyasi (IEM)
Namuna: N = 400 (jami anketa N = 698)

PAPKA TARKIBI
-------------

01_Asal_hisobotlar/
  Asosiy Word va Excel fayllar — prezentatsiya va dissertatsiya uchun.

  1) Dissertatsiya_Tahlil_N400.docx / .xlsx
     — Dissertatsiya bob'i: kasalliklar (jami n=400, foiz 100%),
       ICD-10, sexlar, 400 ro'yxat.

  2) Anketa_Tahlili_N400.docx / .xlsx
     — 7 bo'lim anketa tahlili + xavf zonasi (yashil/sariq/qizil)
       har bo'limda jadval + diagramma + izoh.

  3) Anketa_Tahlili_Sex_Ishchilari.docx
     — 7 ta jadval (shablon formatida, N=400).

  4) Anketa_Ilmiy_Statistika_N400.docx / .xlsx
     — 95% ishonch oralig'i, p-qiymat, OR, Cronbach α (dissertatsiya/maqola).

02_Diagrammalar_dissertatsiya/
  — 5 ta PNG (kasalliklar, ICD, sexlar, jins, hodisa/nazorat)

03_Diagrammalar_anketa/
  — 8 ta PNG (har bo'lim + xavf zonasi)

04_Usullar_va_dasturlar/
  — Dissertatsiya_Usullar_va_Dasturlar.docx
     (qaysi dastur, qanday hisoblangan — dissertatsiyaga kiriting)

MUHIM
-----
• Foizlar 400 ta ishchiga nisbatan (100% bazada).
• Kasalliklar jadvalida har bir ishchiga FAQAT 1 ta asosiy kasallik.
• Eski fayllar (2026-08-21, 2026-08-22) ishlatilmaydi — faqat ushbu papkadagi fayllar.

YUBORISH
--------
• Telegram: butun papkani ZIP qilib yuborish mumkin
• USB: papkani to'liq nusxalash (Ctrl+C → USB → Ctrl+V)
• Email: ZIP fayl sifatida

Savol bo'lsa: Hojakbar bilan bog'laning.
"""


def main() -> None:
    if PACK.exists():
        shutil.rmtree(PACK)
    PACK.mkdir(parents=True)

    # Asosiy hisobotlar
    asol = PACK / "01_Asal_hisobotlar"
    files_main = [
        (latest("Dissertatsiya_Tahlil_N400_*.docx"), "Dissertatsiya_Tahlil_N400.docx"),
        (latest("Dissertatsiya_Tahlil_N400_*.xlsx"), "Dissertatsiya_Tahlil_N400.xlsx"),
        (latest("Anketa_Tahlili_N400_*.docx"), "Anketa_Tahlili_N400.docx"),
        (latest("Anketa_Tahlili_N400_*.xlsx"), "Anketa_Tahlili_N400.xlsx"),
        (latest("Anketa_Tahlili_Sex_Ishchilari_*.docx"), "Anketa_Tahlili_Sex_Ishchilari.docx"),
        (latest("Anketa_Ilmiy_Statistika_N400_*.docx"), "Anketa_Ilmiy_Statistika_N400.docx"),
        (latest("Anketa_Ilmiy_Statistika_N400_*.xlsx"), "Anketa_Ilmiy_Statistika_N400.xlsx"),
    ]
    copied = 0
    for src, name in files_main:
        if copy_if_exists(src, asol / name):
            copied += 1

    # Diagrammalar
    d1 = PACK / "02_Diagrammalar_dissertatsiya"
    d1.mkdir(parents=True, exist_ok=True)
    for p in sorted((DATA / "diagrammalar").glob("*.png")):
        shutil.copy2(p, d1 / p.name)
        copied += 1

    d2 = PACK / "03_Diagrammalar_anketa"
    d2.mkdir(parents=True, exist_ok=True)
    for p in sorted((DATA / "diagrammalar_anketa_n400").glob("*.png")):
        shutil.copy2(p, d2 / p.name)
        copied += 1

    # Uslubiy hujjat — kengash paketidan yoki qayta yaratish
    usul_dir = PACK / "04_Usullar_va_dasturlar"
    usul_dir.mkdir(parents=True, exist_ok=True)
    kengash_usul = DESKTOP / f"Kengash_topshirish_{date.today().isoformat()}" / "03_Usullar_va_dasturlar" / "Dissertatsiya_Usullar_va_Dasturlar.docx"
    if not kengash_usul.exists():
        # boshqa sanadagi kengash
        for p in DESKTOP.glob("Kengash_topshirish_*/03_Usullar_va_dasturlar/Dissertatsiya_Usullar_va_Dasturlar.docx"):
            kengash_usul = p
            break
    if kengash_usul.exists():
        shutil.copy2(kengash_usul, usul_dir / "Dissertatsiya_Usullar_va_Dasturlar.docx")
        copied += 1
    else:
        from prepare_kengash_paket import build_methodology_doc
        build_methodology_doc(usul_dir / "Dissertatsiya_Usullar_va_Dasturlar.docx")
        copied += 1

    (PACK / "OQISH_BUYURMASI.txt").write_text(build_readme(), encoding="utf-8")

    # Telegram Desktop nusxa
    tg = Path(r"c:\Users\User\Downloads\Telegram Desktop") / PACK.name
    if Path(r"c:\Users\User\Downloads\Telegram Desktop").is_dir():
        if tg.exists():
            shutil.rmtree(tg)
        shutil.copytree(PACK, tg)

    total = sum(1 for _ in PACK.rglob("*") if _.is_file())
    print(f"Tayyor: {PACK}")
    print(f"Jami fayllar: {total}")
    print(f"Telegram nusxa: {tg}")


if __name__ == "__main__":
    main()
