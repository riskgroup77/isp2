#!/usr/bin/env python3
"""
N=400 hisobotlar uchun hisoblash formulalari va metodologiya ma'lumotnomasi (Word).
Admin panel «Hisobotlar N=400» bo'limida yuklab olish uchun.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "public" / "reports" / "n400" / "Malumotnoma_Formulalar_N400.docx"

PORTAL = "Donozologik Monitoring va Kasbiy Riskni Prognozlash Milliy Portali"
TODAY = date.today().strftime("%d.%m.%Y")


def add_heading(doc: Document, text: str, level: int = 1) -> None:
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.color.rgb = RGBColor(0x1E, 0x3A, 0x5F)


def add_para(doc: Document, text: str, bold: bool = False) -> None:
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.size = Pt(11)
    if bold:
        run.bold = True


def add_formula(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.35)
    run = p.add_run(text)
    run.font.name = "Consolas"
    run.font.size = Pt(10)
    run.italic = True


def add_table(doc: Document, headers: list[str], rows: list[list[str]]) -> None:
    tbl = doc.add_table(rows=1 + len(rows), cols=len(headers))
    tbl.style = "Table Grid"
    for i, h in enumerate(headers):
        cell = tbl.rows[0].cells[i]
        cell.text = h
        for p in cell.paragraphs:
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(9)
    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            tbl.rows[ri + 1].cells[ci].text = val
            for p in tbl.rows[ri + 1].cells[ci].paragraphs:
                for r in p.runs:
                    r.font.size = Pt(9)
    doc.add_paragraph()


def build_document() -> Document:
    doc = Document()

    title = doc.add_heading("MA'LUMOTNOMA", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in title.runs:
        run.font.color.rgb = RGBColor(0x1E, 0x3A, 0x5F)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = sub.add_run(
        f"N=400 hisobotlar bo'yicha hisoblash formulalari va metodologiya\n"
        f"{PORTAL}\n"
        f"Sana: {TODAY}"
    )
    r.font.size = Pt(12)
    r.bold = True

    doc.add_paragraph()

    add_heading(doc, "1. Maqsad va qamrov")
    add_para(
        doc,
        "Ushbu ma'lumotnoma administrator panelidagi «Hisobotlar N=400» bo'limida "
        "yuklab olinadigan barcha Word, Excel va diagramma fayllaridagi raqamlar "
        "qanday formulalar va algoritmlar asosida hisoblanganini tushuntiradi. "
        "Maqsad — natijalar shaffofligi, ilmiy tekshiruv va audit imkoniyatini ta'minlash.",
    )
    add_para(
        doc,
        "Qamrov: Dissertatsiya_Tahlil_N400 (Word/Excel), Anketa_Tahlili_N400 (Word/Excel), "
        "Anketa_Tahlili_Sex_Ishchilari (Word), dissertatsiya va anketa diagrammalari.",
    )

    add_heading(doc, "2. Namuna va ma'lumotlar manbasi")
    add_para(doc, "Asosiy parametrlar:", bold=True)
    add_table(
        doc,
        ["Parametr", "Qiymat", "Izoh"],
        [
            ["Namuna hajmi (N)", "400", "Stratifik tasodifiy tanlov natijasi"],
            ["Umumiy so'rovnoma bazasi", "698", "698 ta ro'yxatdan o'tgan xodim"],
            ["Korxona", "Farg'ona IEM", "Issiqlik elektr stansiyasi"],
            ["Sexlar soni", "7", "Qozonxona, Turbinalar, Elektr, SKT/OSDT, Kimyoviy, Laboratoriya, Ta'mirlash"],
            ["ICD-10 sinflari", "19", "Har bir sinfda kamida 1 holat (0 bo'lmaydi)"],
        ],
    )
    add_para(
        doc,
        "Ma'lumotlar scripts/realistic_n400.py, generate_dissertatsiya_400.py, "
        "generate_anketa_n400_full.py va generate_statistical_excel.py skriptlari "
        "orqali generatsiya qilinadi va public/reports/n400/ papkasiga joylanadi.",
    )

    add_heading(doc, "3. Umumiy foiz hisoblash formulasi")
    add_para(doc, "Barcha foiz ko'rsatkichlarining asosiy formulasi:", bold=True)
    add_formula(doc, "Foiz (%) = round( n / N × 100 , 1 )")
    add_para(
        doc,
        "Bu yerda n — ma'lum belgi yoki holatga ega ishchilar soni, "
        "N — tahlil qilinayotgan guruh hajmi (odatda 400 yoki sex ichidagi xodimlar soni). "
        "Natija 1 o'nlik xonagacha yaxlitlanadi (round, digits=1).",
    )
    add_para(doc, "Python implementatsiyasi (generate_statistical_excel.py, realistic_n400.py):", bold=True)
    add_formula(doc, "def pct(part, whole, digits=1): return round(part / whole * 100, digits)")

    add_heading(doc, "4. Dissertatsiya hisoboti formulalari")
    add_heading(doc, "4.1. Stratifik tasodifiy tanlov (N=400)", level=2)
    add_para(
        doc,
        "698 ta anketa ichidan 400 tasi sex (bo'lim) bo'yicha proporsional tanlanadi "
        "(generate_dissertatsiya_400.py → select_400):",
    )
    add_formula(doc, "take_sex = round( |sex_pool| / |all_records| × 400 )")
    add_para(
        doc,
        "Oxirgi sex uchun qolgan barcha kvota ajratiladi. Agar 400 dan kam bo'lsa, "
        "qolganlar tasodifiy to'ldiriladi; ko'p bo'lsa — tasodifiy qisqartiriladi.",
    )

    add_heading(doc, "4.2. Asosiy kasallik guruhlari (anketa)", level=2)
    add_para(doc, "Har bir ishchida FAQAT BITTA asosiy kasallik guruhi (jami n=400, foizlar yig'indisi 100%):", bold=True)
    add_table(
        doc,
        ["Kasallik guruhi", "Kvota (n)", "Maqsad foiz (%)"],
        [
            ["Nafas olish tizimi kasalliklari", "136", "34,0"],
            ["Suyak-mushak tizimi kasalliklari", "108", "27,0"],
            ["Yurak-qon tomir tizimi kasalliklari", "68", "17,0"],
            ["Asab tizimi kasalliklari", "44", "11,0"],
            ["Siydik-tanosil tizimi kasalliklari", "28", "7,0"],
            ["Ovqat hazm qilish a'zolari kasalliklari", "16", "4,0"],
        ],
    )
    add_formula(doc, "Kasallik foizi (%) = round( n_kasallik / 400 × 100 , 1 )")

    add_heading(doc, "4.3. ICD-10 kasallik sinflari", level=2)
    add_para(
        doc,
        "Barcha 19 ta ICD sinfi bo'yicha holatlar soni va foizi hisoblanadi. "
        "realistic_n400.py da kvotalar aniq belgilangan (jami 400). "
        "Dissertatsiya yo'li (generate_dissertatsiya_400.py) da har sinfga kamida 1–2 holat "
        "va vazn bo'yicha qo'shimcha taqsimot qo'llaniladi.",
    )
    add_formula(doc, "ICD foizi (%) = round( n_ICD / 400 × 100 , 1 )")
    add_formula(doc, "100 ishchiga ICD holat = round( n_ICD / n_sex × 100 , 1 )  (sex bo'yicha tahlilda)")

    add_heading(doc, "4.4. Xavf balli (dissertatsiya yo'li)", level=2)
    add_para(doc, "generate_statistical_excel.py da har bir xodim uchun xavf balli:", bold=True)
    add_formula(
        doc,
        "score = min(92, 28 + |kasalliklar| × 9 + max(0, (yosh − 28) // 4) "
        "+ (8 agar surunkali kasallik bo'lsa) + tasodifiy(0..12))",
    )
    add_para(
        doc,
        "|kasalliklar| — anketa javoblaridan ajratilgan kasalliklar ro'yxati uzunligi. "
        "Ball 92 dan oshmaydi.",
    )

    add_heading(doc, "5. Hodisa va nazorat guruhlarini ajratish")
    add_para(doc, "assign_groups() funksiyasi (generate_statistical_excel.py):", bold=True)
    add_formula(doc, "Ishchilar score bo'yicha kamayish tartibida saralanadi")
    add_formula(doc, "Hodisa guruhi = yuqori 52% (cutoff = int(N × 0.52))")
    add_formula(doc, "Nazorat guruhi = qolgan 48%")
    add_para(
        doc,
        "Demografik jadvalda: Hodisa % = round( n_hodisa / N × 100 , 1 ), "
        "Nazorat % = round( n_nazorat / N × 100 , 1 ).",
    )

    add_heading(doc, "6. Hodisalar va mehnat vaqti yo'qotish (MVL)")
    add_para(doc, "estimate_metrics() — har bir guruh/sexs/kasb uchun:", bold=True)
    add_formula(
        doc,
        "n_cases = max(1, |kasalliklar|)  agar kasalliklar bor; "
        "aks holda: 1 agar score > 50, aks holda 0",
    )
    add_formula(doc, "kunlar_bir_hodisa = 8 + int(score / 10)")
    add_formula(doc, "Jami hodisalar = Σ n_cases")
    add_formula(doc, "Jami kunlar = Σ ( n_cases × (8 + int(score / 10)) )")
    add_para(doc, "100 ishchiga ko'rsatkichlar (MVL — mehnat vaqti yo'qotish darajasi):", bold=True)
    add_formula(doc, "100 ishchiga hodisa = round( hodisalar / n_xodim × 100 , 2 )")
    add_formula(doc, "100 ishchiga kun = round( kunlar / n_xodim , 2 )")
    add_para(
        doc,
        "Sex bo'yicha chuqur tahlilda (generate_mijoz_topshiriq.py): "
        "per100(value, n) = round(value / n × 100, 1).",
    )

    add_heading(doc, "7. Anketa tahlili (7 bo'lim + xavf zonasi)")
    add_heading(doc, "7.1. Bo'limlar bo'yicha foizlar", level=2)
    add_para(
        doc,
        "Har bir bo'lim (umumiy, mehnat, jismoniy, hayot tarzi, tibbiy, ovqat, taklif) "
        "uchun savol-javoblar soni va foizi:",
    )
    add_formula(doc, "Bo'lim foizi (%) = round( n_javob / 400 × 100 , 1 )")
    add_para(
        doc,
        "Ko'p tanlovli savollarda bir xodim bir nechta variant tanlagan bo'lishi mumkin; "
        "har bir variant alohida sanaladi.",
    )

    add_heading(doc, "7.2. Anketa asosida xavf balli", level=2)
    add_para(
        doc,
        "compute_anketa_risk() (generate_anketa_n400_full.py) — anketa javoblariga "
        "vaznli balllar qo'shiladi, keyin masshtablanadi:",
    )
    add_table(
        doc,
        ["Omil (savol)", "Javob", "Ball"],
        [
            ["12 — mehnat sharoiti", "Yuqori", "+6"],
            ["12", "O'rtacha", "+2"],
            ["13 — kasbiy xavf", "Ha", "+5"],
            ["14 — dam olish", "Umuman yo'q", "+4"],
            ["14", "Ba'zan", "+2"],
            ["20 — charchoq", "Doim", "+8"],
            ["20", "Ko'pincha", "+5"],
            ["21 — uyqu buzilishi", "Doim", "+6"],
            ["21", "Ko'pincha", "+4"],
            ["27–29 — alomatlar", "Ha", "+4..+5"],
            ["36 — sog'liq bahosi", "Yomon", "+10"],
            ["36", "O'rtacha", "+5"],
            ["36", "Yaxshi", "−3"],
            ["51 — chekish", "Hozirda chekaman", "+10"],
            ["52 — jismoniy mashq", "Yo'q", "+5"],
            ["59 — stress", "Ha", "+6"],
            ["46 — profilaktika", "Ha", "+7"],
            ["70 — suv iste'moli", "O'ta kam", "+5"],
            ["42 — simptomlar", "Tez charchash/nafas qisishi", "+3"],
            ["24 — ish vaqti", "8 soatdan ko'p", "+4"],
            ["Yosh", "≥55", "+4"],
            ["Yosh", "≥45", "+2"],
            ["18 — qoniqish", "Juda qoniqaman", "−2"],
            ["52 — mashq", "Muntazam", "−4"],
            ["37 — sog'lom ovqat", "Ha", "−2"],
        ],
    )
    add_formula(doc, "Boshlang'ich ball: pts = 8.0")
    add_formula(doc, "Yakuniy xavf % = int( max(8, min(92, round(pts × 1.55))) )")

    add_heading(doc, "7.3. Xavf zonasi (yashil / sariq / qizil)", level=2)
    add_formula(doc, "Qizil zona:  xavf ≥ 70%")
    add_formula(doc, "Sariq zona:  35% ≤ xavf < 70%")
    add_formula(doc, "Yashil zona: xavf < 35%")
    add_para(
        doc,
        "N=400 namunada kvota: yashil ≈35, sariq ≈334, qizil ≈31 "
        "(realistic_n400.py → RISK_ZONE_QUOTAS). Diagramma 08_xavf_zonasi.png shu taqsimotni aks ettiradi.",
    )

    add_heading(doc, "8. Sexlar bo'yicha taqsimot")
    add_para(doc, "7 ta sex uchun 400 ta ishchi kvotalari (realistic_n400.py):", bold=True)
    add_table(
        doc,
        ["Sex", "Xodimlar (n)", "Foiz (%)"],
        [
            ["Qozonxona sexi", "88", "22,0"],
            ["Turbinalar sexi", "72", "18,0"],
            ["Elektr sexi", "56", "14,0"],
            ["Yo'qilg'i tashish (SKT/OSDT)", "56", "14,0"],
            ["Kimyoviy sexi", "48", "12,0"],
            ["Laboratoriya", "40", "10,0"],
            ["Markaziy ta'mirlash sexi", "40", "10,0"],
        ],
    )
    add_formula(doc, "Sex foizi (%) = round( n_sex / 400 × 100 , 1 )")

    add_heading(doc, "9. Diagrammalar")
    add_para(doc, "Diagrammalar matplotlib kutubxonasi bilan generatsiya qilinadi (PNG, 150 DPI):", bold=True)
    add_table(
        doc,
        ["Fayl", "Turi", "Ma'lumot manbai"],
        [
            ["01_kasallanishlar_strukturasi.png", "Pie chart", "Asosiy 6 kasallik guruhi foizlari"],
            ["02_icd_kasallik_sinflari.png", "Bar chart", "ICD-10 19 sinf, n va %"],
            ["03_sexlar_taqsimoti.png", "Bar chart", "7 sex bo'yicha n"],
            ["04_jins_taqsimoti.png", "Pie chart", "Erkak / ayol foizlari"],
            ["05_hodisa_nazorat.png", "Bar chart", "Hodisa 52% / Nazorat 48%"],
            ["01–07_bolim_*.png", "Bar chart", "Anketa 7 bo'lim savollari"],
            ["08_xavf_zonasi.png", "Bar chart", "Yashil / sariq / qizil zonalar"],
        ],
    )

    add_heading(doc, "10. Excel varaqlari tuzilmasi")
    add_para(doc, "Dissertatsiya_Tahlil_N400.xlsx va Anketa_Tahlili_N400.xlsx da:", bold=True)
    add_para(
        doc,
        "• Demografiya, kasalliklar, ICD-10, sexlar, kasblar, staj, hodisa/nazorat jadvallari\n"
        "• Har bir ustunda n (son) va % (foiz) — yuqoridagi formulalar bilan\n"
        "• «100 ishchiga kun» va «100 ishchiga hodisa» — 6-bo'lim formulasi\n"
        "• O'rtacha xavf % = round( Σ score / N , 1 )",
    )

    add_heading(doc, "11. Hisobotlarni qayta generatsiya qilish")
    add_para(
        doc,
        "Barcha N=400 fayllarni yangilash: python scripts/regenerate_all_n400_fixed.py\n"
        "Faqat ma'lumotnoma: python scripts/generate_malumotnoma_n400.py\n"
        "Natijalar public/reports/n400/ ga nusxalanadi va admin panel orqali yuklab olinadi.",
    )

    add_heading(doc, "12. Muhim eslatmalar")
    add_para(
        doc,
        "1. Portal klinika emas; natijalar ilmiy-statistik tahlil va kasbiy risk monitoring "
        "uchun mo'ljallangan axborot mahsulotidir.\n"
        "2. Foizlar yaxlitlash (round) tufayli jadval ustunlari yig'indisi aynan 100,0% "
        "bo'lmasligi mumkin (±0,1–0,3 farq).\n"
        "3. Kasalliklar jadvalida har bir ishchi bitta asosiy guruhga kiradi — shuning uchun "
        "jami n=400 va foizlar yig'indisi 100% ga teng.\n"
        "4. ICD jadvalida bir ishchi bir nechta sinfga tegishli bo'lishi mumkin — "
        "shuning uchun ICD foizlari yig'indisi 100% dan oshishi tabiiy.\n"
        "5. Barcha formulalar manba kodda (scripts/ papkasi) ochiq ko'rinishda mavjud.",
    )

    footer = doc.add_paragraph()
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fr = footer.add_run(f"\n\n{PORTAL}\nMa'lumotnoma versiyasi: N400-2026 | {TODAY}")
    fr.font.size = Pt(10)
    fr.italic = True

    return doc


def main() -> int:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = build_document()
    doc.save(OUTPUT)
    print(f"Ma'lumotnoma yaratildi: {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
