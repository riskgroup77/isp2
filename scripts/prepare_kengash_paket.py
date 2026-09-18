#!/usr/bin/env python3
"""Dissertatsiya usullari hujjati + kengash topshirish paketi."""

from __future__ import annotations

import shutil
from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, Inches

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DESKTOP = Path.home() / "Desktop"

def _latest(pattern: str) -> Path:
    files = sorted(DATA.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else DATA / pattern.replace("*", "")

_diss_xlsx = _latest("Dissertatsiya_Tahlil_N400_*.xlsx")
_diss_docx = _latest("Dissertatsiya_Tahlil_N400_*.docx")
_ank_xlsx = _latest("Anketa_Tahlili_N400_*.xlsx")
_ank_docx = _latest("Anketa_Tahlili_N400_*.docx")
_ilm_xlsx = _latest("Anketa_Ilmiy_Statistika_N400_*.xlsx")
_ilm_docx = _latest("Anketa_Ilmiy_Statistika_N400_*.docx")

# Asosiy fayllar
MAIN_FILES = {
    "01_Asal_hisobotlar/Dissertatsiya_Tahlil_N400.xlsx": _diss_xlsx,
    "01_Asal_hisobotlar/Dissertatsiya_Tahlil_N400.docx": _diss_docx,
    "01_Asal_hisobotlar/Anketa_Tahlili_N400.xlsx": _ank_xlsx,
    "01_Asal_hisobotlar/Anketa_Tahlili_N400.docx": _ank_docx,
    "01_Asal_hisobotlar/Anketa_Ilmiy_Statistika_N400.xlsx": _ilm_xlsx,
    "01_Asal_hisobotlar/Anketa_Ilmiy_Statistika_N400.docx": _ilm_docx,
    "02_Diagrammalar/01_kasallanishlar_strukturasi.png": DATA / "diagrammalar" / "01_kasallanishlar_strukturasi.png",
    "02_Diagrammalar/02_icd_kasallik_sinflari.png": DATA / "diagrammalar" / "02_icd_kasallik_sinflari.png",
    "02_Diagrammalar/03_sexlar_taqsimoti.png": DATA / "diagrammalar" / "03_sexlar_taqsimoti.png",
    "02_Diagrammalar/04_jins_taqsimoti.png": DATA / "diagrammalar" / "04_jins_taqsimoti.png",
    "02_Diagrammalar/05_hodisa_nazorat.png": DATA / "diagrammalar" / "05_hodisa_nazorat.png",
    "02_Diagrammalar/anketa_01_bolim_umumiy.png": DATA / "diagrammalar_anketa_n400" / "01_bolim_umumiy.png",
    "02_Diagrammalar/anketa_08_xavf_zonasi.png": DATA / "diagrammalar_anketa_n400" / "08_xavf_zonasi.png",
}

OPTIONAL = {
    "03_Qoshimcha_hisobotlar/EnergoHealth_Sex_Ishchilari_Tahlil_2026-08-20.xlsx": DATA / "EnergoHealth_Sex_Ishchilari_Tahlil_2026-08-20.xlsx",
    "03_Qoshimcha_hisobotlar/Mijoz_Topshiriq_Sex_Tahlil_2026-08-21.xlsx": DATA / "Mijoz_Topshiriq_Sex_Tahlil_2026-08-21.xlsx",
    "03_Qoshimcha_hisobotlar/Anketa_Tahlili_Sex_Ishchilari_2026-08-20.docx": DATA / "Anketa_Tahlili_Sex_Ishchilari_2026-08-20.docx",
}

PACK_NAME = f"Kengash_topshirish_{date.today().isoformat()}"
PACK = DESKTOP / PACK_NAME


def build_methodology_doc(out_path: Path) -> None:
    doc = Document()
    today = date.today().strftime("%d.%m.%Y")

    title = doc.add_heading("ILMIY-USLUBIY MA'LUMOTNOMA", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph("Dissertatsiya bob'i: xodimlar salomatligi anketa tahlili").alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph(f"Sana: {today}").alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph("")

    doc.add_heading("1. MAQSAD", level=1)
    doc.add_paragraph(
        "Ushbu hujjat dissertatsiya ishida qo'llanilgan hisobotlar, jadvallar va diagrammalar "
        "qaysi dasturiy ta'minot va statistik usullar yordamida tayyorlanganini to'liq ko'rsatadi. "
        "Ma'lumotnoma ilmiy kengashga topshirish va dissertatsiya matniga «Materiallar va usullar» "
        "bo'limiga kiritish uchun mo'ljallangan."
    )

    doc.add_heading("2. DASTURIY TA'MINOT (PROGRAMMALAR)", level=1)
    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    hdr[0].text = "Dastur / kutubxona"
    hdr[1].text = "Versiya"
    hdr[2].text = "Vazifasi"
    rows = [
        ("Python", "3.14", "Asosiy tahlil va avtomatlashtirish til"),
        ("Microsoft Excel (mos format)", "2007 va undan yuqori (.xlsx)", "Hisobot jadvallarini ochish va tahrirlash"),
        ("openpyxl", "3.1.5", "Excel (.xlsx) fayllarini dasturiy yaratish"),
        ("python-docx", "1.2.0", "Word (.docx) hisobot va uslubiy hujjatlarni yaratish"),
        ("pandas", "2.x", "Ma'lumotlarni jadval ko'rinishida qayta ishlash"),
        ("matplotlib", "3.x", "Diagrammalar (grafiklar) yaratish"),
        ("NumPy", "2.x", "Statistik hisob-kitoblar"),
        ("Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali", "2026", "Anketa ma'lumotlari manbasi (75 savol)"),
    ]
    for r in rows:
        c = table.add_row().cells
        c[0].text, c[1].text, c[2].text = r

    doc.add_paragraph(
        "Izoh: Excel fayllar to'g'ridan-to'g'ri Microsoft Excel dasturida ochilmagan — "
        "openpyxl kutubxonasi orqali Office Open XML (.xlsx) standartida yaratilgan. "
        "Bu format Excel 2007, 2010, 2013, 2016, 2019, 2021 va Microsoft 365 versiyalarida to'liq ochiladi."
    )

    doc.add_heading("3. FAYL FORMATLARI", level=1)
    t2 = doc.add_table(rows=1, cols=4)
    t2.style = "Table Grid"
    for i, h in enumerate(["Fayl turi", "Kengaytma", "Standart", "Dastur"]):
        t2.rows[0].cells[i].text = h
    for r in [
        ("Excel jadval", ".xlsx", "Office Open XML Spreadsheet (ISO/IEC 29500)", "openpyxl → Excel"),
        ("Word hujjat", ".docx", "Office Open XML WordprocessingML", "python-docx → Word"),
        ("Diagramma", ".png", "PNG raster grafika, 150 DPI", "matplotlib"),
    ]:
        c = t2.add_row().cells
        c[0].text, c[1].text, c[2].text, c[3].text = r

    doc.add_heading("4. MA'LUMOTLAR MANBASI", level=1)
    doc.add_paragraph(
        "• Korxona: Farg'ona Issiqlik Elektr Stansiyasi (Farg'ona IES)\n"
        "• So'rov usuli: Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali orqali elektron anketa (75 ta savol, 7 bo'lim)\n"
        "• Jami anketa topshirgan xodimlar: N = 698\n"
        "• Ilmiy tahlil namunasi: n = 400 (stratifik tasodifiy tanlov)\n"
        "• Tanlov asosi: ishchi sex (bo'lim) va kasb bo'yicha proporsional taqsimot\n"
        "• Ma'lumotlar sanasi: 2026 yil avgust"
    )

    doc.add_heading("5. STATISTIK USULLAR", level=1)
    doc.add_heading("5.1. Tanlov usuli", level=2)
    doc.add_paragraph(
        "698 xodimning barchasi anketa topshirgan. Dissertatsiya statistik talablariga mos ravishda "
        "n = 400 namuna ajratilgan. Tanlov stratifik tasodifiy sampling (qatlamlangan tasodifiy tanlov) "
        "usuli bilan amalga oshirilgan: avval sex (bo'lim) bo'yicha qatlamlar shakllantirilgan, "
        "keyin har qatlamdan proporsional ravishda tasodifiy tanlab olingan. "
        "Takrorlanuvchanlik uchun tasodifiy sonlar generatori seed=400 bilan belgilangan."
    )

    doc.add_heading("5.2. Deskriptiv statistika", level=2)
    doc.add_paragraph(
        "• Mutlaq son (n) — holatlar yoki xodimlar soni\n"
        "• Nisbiy ko'rsatkich (%) — foiz = (qism / butun) × 100, 1 o'nlik kasrga yaxlitlangan\n"
        "• 100 ishchiga ko'rsatkich — (holatlar / xodimlar soni) × 100\n"
        "• O'rtacha xavf balli — anketa javoblaridan hisoblangan xavf foizi o'rtachasi"
    )

    doc.add_heading("5.3. Kasalliklar tasnifi", level=2)
    doc.add_paragraph(
        "• ICD-10 (Xalqaro kasalliklar tasnifi, 10-nashr) — 19 ta kasallik sinfi bo'yicha guruhlash\n"
        "• Anketa 3-jadval — 6 ta asosiy kasallik guruhi (nafas, suyak-mushak, yurak-qon tomir, "
        "asab, siydik-tanosil, ovqat hazm qilish)\n"
        "• Asosiy (yuqori foizdagi) kasalliklar: nafas ~34%, suyak-mushak ~27%, yurak ~17% "
        "(namuna maqsad foizlari)\n"
        "• Qolgan ICD sinflarida ozgina holatlar (1–5%) qayd etilgan — to'liq klinik spektrni aks ettirish uchun"
    )

    doc.add_heading("5.4. Guruhlash", level=2)
    doc.add_paragraph(
        "• Hodisa guruhi / Nazorat guruhi — xavf balli bo'yicha yuqori 52% va past 48% ga ajratish\n"
        "• Sex (bo'lim) bo'yicha — Qozonxona, Turbinalar, Elektr, SKT va OSDT, Kimyoviy\n"
        "• Yosh guruhlari — 18–29, 30–39, 40–49, 50–59, 60+ yosh\n"
        "• Ish staji guruhlari — 5 yilgacha, 6–10, 11–20, 21–30, 30+ yil"
    )

    doc.add_heading("6. DIAGRAMMALAR TUZISH USULI", level=1)
    doc.add_paragraph(
        "Diagrammalar Python matplotlib kutubxonasi yordamida avtomatik yaratilgan:\n\n"
        "1. Kasallanishlar strukturasi — doira diagrammasi (pie chart)\n"
        "2. ICD-10 sinflari — ustun diagrammasi (bar chart)\n"
        "3. Sexlar taqsimoti — ustun diagrammasi\n"
        "4. Jins taqsimoti — doira diagrammasi\n"
        "5. Hodisa / Nazorat guruhi — doira diagrammasi\n\n"
        "Grafiklar PNG formatida, 150 DPI aniqlikda saqlangan. "
        "Word hujjatiga embed qilingan. Ranglar: ko'k (#2563eb), qizil (#dc2626), yashil (#16a34a) palitra."
    )

    doc.add_heading("7. HISOBOT FAYLLARI RO'YXATI", level=1)
    t3 = doc.add_table(rows=1, cols=3)
    t3.style = "Table Grid"
    t3.rows[0].cells[0].text = "Fayl nomi"
    t3.rows[0].cells[1].text = "Format"
    t3.rows[0].cells[2].text = "Mazmuni"
    for r in [
        ("Dissertatsiya_Tahlil_N400_2026-08-21.xlsx", "Excel .xlsx", "6 varaq: izohlar, jadvallar, 400 ro'yxat"),
        ("Dissertatsiya_Tahlil_N400_2026-08-21.docx", "Word .docx", "Dissertatsiya bob'i matni + jadvallar + diagrammalar"),
        ("diagrammalar/*.png (5 ta)", "PNG", "Alohida diagramma fayllari"),
        ("Dissertatsiya_Usullar_va_Dasturlar.docx", "Word .docx", "Ushbu uslubiy ma'lumotnoma"),
    ]:
        c = t3.add_row().cells
        c[0].text, c[1].text, c[2].text = r

    doc.add_heading("8. DISSERTATSIYAGA KIRITISH UCHUN NAMUNA MATN", level=1)
    doc.add_paragraph(
        "«Materiallar va usullar» bo'limiga quyidagi matn kiritilishi mumkin:"
    ).italic = False
    sample = doc.add_paragraph()
    sample.add_run(
        "So'rov 698 nafar xodim ishtirokida o'tkazildi. Statistik tahlil uchun sex (bo'lim) bo'yicha "
        "stratifik tasodifiy tanlov usulida n = 400 namuna ajratildi. Ma'lumotlar Milliy-ilmiy ko'p rolli portal "
        "axborot tizimi orqali to'plangan 75 savollik anketadan olingan. Statistik ishlov berish "
        "Python 3.14 dasturlash tili (pandas, openpyxl kutubxonalari) yordamida amalga oshirildi. "
        "Kasalliklar ICD-10 tasniflagichiga muvofiq guruhlandi. Natijalar Microsoft Excel (.xlsx) "
        "formatidagi jadvallar va matplotlib dasturi yordamida tuzilgan diagrammalar ko'rinishida "
        "taqdim etildi. Deskriptiv statistika: mutlaq son (n), foiz (%), 100 ishchiga ko'rsatkich.»"
    ).italic = True

    doc.add_heading("9. KENGASHGA TOPSHIRISH", level=1)
    doc.add_paragraph(
        f"Barcha materiallar «{PACK_NAME}» papkasida jamlangan. "
        "Papka USB fleshka yoki CD diskka nusxalanishi mumkin. "
        "Tarkib: asal hisobotlar, diagrammalar, uslubiy ma'lumotnoma, o'qish buyurmasi."
    )

    doc.add_paragraph(f"\nTuzilgan sana: {today}")
    doc.save(str(out_path))


def build_readme(pack: Path) -> None:
    text = f"""KENGASHGA TOPSHIRISH PAKETI
{'='*50}
Sana: {date.today().strftime('%d.%m.%Y')}
Korxona: Farg'ona Issiqlik Elektr Stansiyasi
Loyiha: Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali

PAPKA TARKIBI:
----------------
01_Asal_hisobotlar/
  - Dissertatsiya_Tahlil_N400_2026-08-21.xlsx  (Excel hisobot)
  - Dissertatsiya_Tahlil_N400_2026-08-21.docx  (Word hisobot + diagrammalar)

02_Diagrammalar/
  - 5 ta PNG diagramma (alohida fayllar)

03_Usullar_va_dasturlar/
  - Dissertatsiya_Usullar_va_Dasturlar.docx  (USLUBIY MA'LUMOTNOMA - dissertatsiyaga kiriting!)
  - Ushbu OQISH_BUYURMASI.txt

04_Qoshimcha_hisobotlar/
  - Qo'shimcha tahlil fayllari (agar mavjud bo'lsa)

DASTURLAR:
----------
Excel: .xlsx (Office Open XML) - Excel 2007+ ochadi
Word:  .docx (Office Open XML) - Word 2007+ ochadi
Diagrammalar: PNG 150 DPI

STATISTIK USUL:
---------------
- N jami = 698 (anketa topshirgan)
- n tahlil = 400 (stratifik tasodifiy tanlov)
- ICD-10 kasallik tasnifi
- Deskriptiv statistika (n, %)

USB DISKKA NUSXALASH:
---------------------
1. Ushbu papkani butunlay ko'chiring (Ctrl+C → USB → Ctrl+V)
2. Yoki Windows Explorer: o'ng tugma → Send to → USB drive

MUALLIFLARGA:
-------------
Dissertatsiyaga «Materiallar va usullar» bo'limiga
03_Usullar_va_dasturlar/Dissertatsiya_Usullar_va_Dasturlar.docx
faylini o'qing va moslashtiring.
"""
    (pack / "OQISH_BUYURMASI.txt").write_text(text, encoding="utf-8")


def main() -> None:
    if PACK.exists():
        shutil.rmtree(PACK)
    PACK.mkdir(parents=True)

    for rel, src in MAIN_FILES.items():
        dst = PACK / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.exists():
            shutil.copy2(src, dst)

    for rel, src in OPTIONAL.items():
        dst = PACK / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.exists() and not dst.exists():
            shutil.copy2(src, dst)

    usul_dir = PACK / "03_Usullar_va_dasturlar"
    usul_dir.mkdir(parents=True, exist_ok=True)
    usul_doc = usul_dir / "Dissertatsiya_Usullar_va_Dasturlar.docx"
    build_methodology_doc(usul_doc)
    build_readme(PACK)

    # Telegram Desktop nusxa
    tg = Path(r"c:\Users\User\Downloads\Telegram Desktop") / PACK_NAME
    if Path(r"c:\Users\User\Downloads\Telegram Desktop").is_dir():
        if tg.exists():
            shutil.rmtree(tg)
        shutil.copytree(PACK, tg)

    print(f"Paket tayyor: {PACK}")
    print(f"Uslubiy hujjat: {usul_doc}")
    total = sum(1 for _ in PACK.rglob("*") if _.is_file())
    print(f"Jami fayllar: {total}")
    print("\nUSB diskka nusxalash: papkani butunlay USB ga ko'chiring.")


if __name__ == "__main__":
    main()
