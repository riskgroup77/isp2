#!/usr/bin/env python3
"""Opaga yuborish — oxirgi tartibli paket (papka tuzilmasi bilan)."""

from __future__ import annotations

import shutil
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "public" / "reports" / "n400"
DESKTOP = Path.home() / "Desktop"
PACK = DESKTOP / f"Opaga_topshirish_{date.today().isoformat()}"


def copy_tree_if_exists(src: Path, dst: Path) -> int:
    if not src.exists():
        return 0
    if src.is_dir():
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
        return sum(1 for _ in dst.rglob("*") if _.is_file())
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return 1


def build_readme() -> str:
    return f"""OPAGA YUBORISH PAKETI (OXIRGI FORMAT)
{'=' * 52}
Sana: {date.today().strftime('%d.%m.%Y')}
Korxona: Farg'ona Issiqlik Elektr Stansiyasi (IEM)
Namuna: N = 400 | Jami anketa: N = 698

PAPKA TUZILMASI
---------------

01_asosiy_hisobotlar/
  Dissertatsiya va Anketa (Word + Excel)
  Foiz + 95% CI | Dissertatsiyada 4.2-jadval ham bor

02_ilmiy_statistika/
  95% CI, p-qiymat, OR, Cronbach α
  Dissertatsiya/maqola uchun

03_jadval_4_2/  ★ ASOSIY YANGILIK
  4.2-jadval — ICD sinflari × Hodisa/Nazorat
  100 ishchiga MVL holatlari va kunlari (M ± m formatida)
  Masalan: 29 ± 1,2

04_diagrammalar_dissertatsiya/
  5 ta PNG

05_diagrammalar_anketa/
  8 ta PNG (7 bo'lim + xavf zonasi)

06_malumotnoma/
  Formulalar va hisoblash usullari

YUBORISH: Telegram ZIP yoki USB
"""


def main() -> None:
    if PACK.exists():
        shutil.rmtree(PACK)
    PACK.mkdir(parents=True)

    folders = [
        "01_asosiy_hisobotlar",
        "02_ilmiy_statistika",
        "03_jadval_4_2",
        "04_diagrammalar_dissertatsiya",
        "05_diagrammalar_anketa",
        "06_malumotnoma",
    ]
    copied = 0
    for folder in folders:
        src = PUB / folder
        dst = PACK / folder
        copied += copy_tree_if_exists(src, dst)

    readme_src = PUB / "OQISH_BUYURMASI.txt"
    if readme_src.exists():
        shutil.copy2(readme_src, PACK / "OQISH_BUYURMASI.txt")
    (PACK / "OQISH_BUYURMASI.txt").write_text(build_readme(), encoding="utf-8")

    tg = Path(r"c:\Users\User\Downloads\Telegram Desktop") / PACK.name
    if tg.parent.is_dir():
        if tg.exists():
            shutil.rmtree(tg)
        shutil.copytree(PACK, tg)

    print(f"Tayyor: {PACK}")
    print(f"Jami fayllar: {copied}")
    print(f"Telegram: {tg}")


if __name__ == "__main__":
    main()
