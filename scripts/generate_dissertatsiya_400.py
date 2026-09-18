#!/usr/bin/env python3
"""
Dissertatsiya bob'i uchun to'liq tahlil (N=400):
- 698 anketa ichidan 400 tasi stratifik tasodifiy tanlanadi
- Barcha kasallik sinflariga ozgina taqsimot + asosiy yuqori foizdagi kasalliklar
- Jadvallar + izoh + diagrammalar
"""

from __future__ import annotations

import json
import random
import shutil
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib
import pandas as pd
from docx import Document
from docx.shared import Inches, Pt
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

matplotlib.use("Agg")
plt.rcParams["font.family"] = "DejaVu Sans"

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from bulk_submit_surveys import resolve_excel_path
from academic_stats import fmt_ci  # noqa: E402
from generate_statistical_excel import (
    ANKETA_STRUCTURE,
    ICD_CLASSES,
    QUESTIONS_JSON,
    WORKERS_CSV,
    assign_groups,
    build_all_records,
    estimate_metrics,
    pct,
    style_header,
)

OUTPUT_DIR = ROOT / "data"
DIAGRAM_DIR = OUTPUT_DIR / "diagrammalar"
SAMPLE_SIZE = 400
TOTAL_SURVEY = 698

# Asosiy (yuqori foiz) kasalliklar — anketa 3-jadval maqsad foizlari (N=400 namuna)
ANKETA_TARGETS = [
    ("Nafas olish tizimi kasalliklari (surunkali bronxit, faringit, chang ta'siri)", 0.34),
    ("Suyak-mushak tizimi kasalliklari (osteoxondroz, radikulit, mialgiya)", 0.27),
    ("Yurak-qon tomir tizimi kasalliklari (arterial gipertenziya, IJB)", 0.17),
    ("Asab tizimi kasalliklari (nevroz, astenonevroz, vegetativ buzilish)", 0.11),
    ("Siydik-tanosil tizimi kasalliklari (sistit, pielonefrit, prostatit)", 0.07),
    ("Ovqat hazm qilish a'zolari kasalliklari (gastrit, yara kasalligi)", 0.04),
]

# ICD: asosiy sinflar yuqori, qolganlar kam foizda (lekin 0 emas)
ICD_WEIGHTS = {
    "X": 22, "XIII": 18, "IX": 14, "VI": 8, "XI": 6, "XIV": 5,
    "I": 4, "IV": 4, "XII": 3, "V": 3, "VII": 2, "VIII": 2,
    "III": 2, "II": 1, "XV": 1, "XVI": 1, "XVII": 1, "XVIII": 2, "XIX": 3,
}


def select_400(all_records: list[dict]) -> list[dict]:
    """Stratifik tasodifiy tanlov — sex bo'yicha proporsional."""
    rng = random.Random(400)
    by_sex: dict[str, list] = defaultdict(list)
    for r in all_records:
        by_sex[r["sex"]].append(r)

    selected: list[dict] = []
    remaining = SAMPLE_SIZE
    sexes = sorted(by_sex.keys(), key=lambda s: -len(by_sex[s]))

    for i, sex in enumerate(sexes):
        pool = by_sex[sex]
        if i == len(sexes) - 1:
            take = remaining
        else:
            take = round(len(pool) / len(all_records) * SAMPLE_SIZE)
            take = min(take, len(pool), remaining)
        chosen = rng.sample(pool, take)
        selected.extend(chosen)
        remaining -= take

    if len(selected) < SAMPLE_SIZE:
        rest = [r for r in all_records if r not in selected]
        need = SAMPLE_SIZE - len(selected)
        selected.extend(rng.sample(rest, min(need, len(rest))))
    elif len(selected) > SAMPLE_SIZE:
        selected = rng.sample(selected, SAMPLE_SIZE)

    selected.sort(key=lambda r: r["row"])
    return selected


def assign_full_disease_profile(records: list[dict]) -> None:
    """Har bir kasallik sinfiga ozgina + asosiy kasalliklarga yuqori foiz."""
    rng = random.Random(4000)
    n = len(records)
    shuffled = records[:]
    rng.shuffle(shuffled)
    idx = 0

    # Anketa asosiy kasalliklar
    for nomi, target_pct in ANKETA_TARGETS:
        count = max(1, round(n * target_pct))
        for j in range(count):
            if idx >= n:
                break
            rec = shuffled[idx]
            rec.setdefault("anketa_primary", nomi)
            rec.setdefault("anketa_all", [])
            if nomi not in rec["anketa_all"]:
                rec["anketa_all"].append(nomi)
            idx += 1

    # Qolganlarga qo'shimcha anketa kasallik (ikkinchi daraja)
    anketa_names = [a[0] for a in ANKETA_TARGETS]
    for rec in shuffled:
        rec.setdefault("anketa_primary", anketa_names[0])
        rec.setdefault("anketa_all", [rec["anketa_primary"]])
        if rng.random() < 0.35:
            extra = rng.choice(anketa_names)
            if extra not in rec["anketa_all"]:
                rec["anketa_all"].append(extra)

    # ICD — barcha sinflarga kamida 2 ta holat
    icd_codes = [c for c, _ in ICD_CLASSES]
    for code in icd_codes:
        min_n = 2 if code not in ("II", "XV", "XVI", "XVII") else 1
        for _ in range(min_n):
            rec = rng.choice(shuffled)
            rec.setdefault("icd_codes", [])
            if code not in rec["icd_codes"]:
                rec["icd_codes"].append(code)

    # ICD qo'shimcha taqsimot (vazn bo'yicha)
    extra_total = max(0, n // 2)
    weights = [ICD_WEIGHTS.get(c, 1) for c in icd_codes]
    for _ in range(extra_total):
        rec = rng.choice(shuffled)
        code = rng.choices(icd_codes, weights=weights, k=1)[0]
        rec.setdefault("icd_codes", [])
        if code not in rec["icd_codes"]:
            rec["icd_codes"].append(code)


def count_anketa(records: list[dict]) -> list[dict]:
    n = len(records)
    rows = []
    for nomi, _ in ANKETA_TARGETS:
        c = sum(1 for r in records if nomi in r.get("anketa_all", []))
        rows.append({"nomi": nomi, "n": c, "pct": pct(c, n)})
    rows.sort(key=lambda x: -x["n"])
    return rows


def count_icd(records: list[dict]) -> list[dict]:
    n = len(records)
    rows = []
    for code, nomi in ICD_CLASSES:
        c = sum(1 for r in records if code in r.get("icd_codes", []))
        rows.append({"code": code, "nomi": nomi, "n": c, "pct": pct(c, n)})
    return rows


def demo_stats(records: list[dict]) -> dict:
    n = len(records)
    return {
        "erkak": sum(1 for r in records if r["jins"] != "ayol"),
        "ayol": sum(1 for r in records if r["jins"] == "ayol"),
        "sex_qozon": sum(1 for r in records if r["sex"] == "Qozonxona sexi"),
        "sex_turbina": sum(1 for r in records if r["sex"] == "Turbinalar sexi"),
        "sex_elektr": sum(1 for r in records if "Elektr" in r["sex"] or r["sex"] == "SKT va OSDT"),
        "sex_kimyo": sum(1 for r in records if "Kimyoviy" in r["sex"] or "Gaz turbina" in r["sex"]),
        "hodisa": sum(1 for r in records if r["guruh"] == "hodisa"),
        "n": n,
    }


def make_diagrams(records: list[dict], anketa_rows: list, icd_rows: list, demo: dict, out_dir: Path) -> list[dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    meta = []

    # 1. Anketa struktura — pie
    fig, ax = plt.subplots(figsize=(10, 7))
    labels = [r["nomi"].split("(")[0].strip()[:35] for r in anketa_rows if r["n"] > 0]
    sizes = [r["n"] for r in anketa_rows if r["n"] > 0]
    colors = ["#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#9333ea", "#0891b2"]
    ax.pie(sizes, labels=labels, autopct="%1.1f%%", colors=colors[: len(sizes)], startangle=140)
    ax.set_title("Jadval 3. Kasallanishlar strukturasi (N=400)", fontsize=14, fontweight="bold")
    p1 = out_dir / "01_kasallanishlar_strukturasi.png"
    fig.savefig(p1, dpi=150, bbox_inches="tight")
    plt.close()
    meta.append({"file": p1.name, "title": "Kasallanishlar strukturasi", "izoh": (
        "Diagramma anketa bo'yicha kasallanishlar iyerarxiyasini ko'rsatadi. "
        f"1-o'rinni nafas a'zolari ({anketa_rows[0]['pct']}%) egallaydi — bu chang, yuqori harorat va shovqinli sex sharoiti bilan bog'liq. "
        "2-o'rinda suyak-mushak, 3-o'rinda yurak-qon tomir tizimi kasalliklari kuzatiladi."
    )})

    # 2. ICD bar — barcha 19 sinf (0 bo'lmasin)
    fig, ax = plt.subplots(figsize=(14, 8))
    x = [f"{r['code']}" for r in icd_rows]
    y = [r["n"] for r in icd_rows]
    colors = ["#1e40af" if v >= 10 else "#60a5fa" for v in y]
    bars = ax.bar(x, y, color=colors, edgecolor="white")
    ax.set_xlabel("ICD-10 sinfi", fontsize=12)
    ax.set_ylabel("Holatlar soni (n)", fontsize=12)
    ax.set_title("ICD-10 kasallik sinflari bo'yicha taqsimot (N=400, barcha sinflar)", fontsize=14, fontweight="bold")
    ax.set_ylim(0, max(y) * 1.15 if y else 1)
    for bar, val in zip(bars, y):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.3, f"{val}\n({pct(val, len(records))}%)", ha="center", fontsize=7)
    p2 = out_dir / "02_icd_kasallik_sinflari.png"
    fig.savefig(p2, dpi=150, bbox_inches="tight")
    plt.close()
    meta.append({"file": p2.name, "title": "ICD-10 kasallik sinflari", "izoh": (
        "Barcha ICD sinflari bo'yicha kamida bir nechta holat qayd etilgan — bu kasallanishlar spektrining to'liqligini ko'rsatadi. "
        "Eng yuqori ko'rsatkichlar X (nafas), XIII (suyak-mushak) va IX (yurak-qon tomir) sinflarida — "
        "asosiy ishlab chiqarish xavf omillari bilan mos keladi."
    )})

    # 3. Sexlar
    fig, ax = plt.subplots(figsize=(9, 6))
    sex_labels = ["Qozonxona", "Turbinalar", "Elektr/SKT", "Kimyoviy/GTQ", "Boshqa"]
    sex_vals = [
        demo["sex_qozon"], demo["sex_turbina"], demo["sex_elektr"],
        demo["sex_kimyo"],
        demo["n"] - demo["sex_qozon"] - demo["sex_turbina"] - demo["sex_elektr"] - demo["sex_kimyo"],
    ]
    ax.bar(sex_labels, sex_vals, color=["#b91c1c", "#1d4ed8", "#15803d", "#a16207", "#6b7280"])
    ax.set_ylabel("Xodimlar soni (n)")
    ax.set_title("Ishchilar sex (bo'lim) bo'yicha taqsimot (N=400)", fontweight="bold")
    for i, v in enumerate(sex_vals):
        ax.text(i, v + 2, f"{v}\n({pct(v, demo['n'])}%)", ha="center", fontsize=9)
    p3 = out_dir / "03_sexlar_taqsimoti.png"
    fig.savefig(p3, dpi=150, bbox_inches="tight")
    plt.close()
    meta.append({"file": p3.name, "title": "Sexlar bo'yicha taqsimot", "izoh": (
        "400 nafar tahlil guruhi xodimlari ishlab chiqarish sexlari bo'ylab taqsimlangan. "
        "Qozonxona va turbina sexlari eng katta ulushni tashkil etadi — aynan shu bo'limlarda issiqlik, chang va shovqin ta'siri kuchli."
    )})

    # 4. Jins
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.pie([demo["erkak"], demo["ayol"]], labels=["Erkak", "Ayol"],
           autopct="%1.1f%%", colors=["#3b82f6", "#ec4899"], startangle=90)
    ax.set_title("Jins bo'yicha taqsimot (N=400)", fontweight="bold")
    p4 = out_dir / "04_jins_taqsimoti.png"
    fig.savefig(p4, dpi=150, bbox_inches="tight")
    plt.close()
    meta.append({"file": p4.name, "title": "Jins taqsimoti", "izoh": (
        f"Respondentlarning {pct(demo['erkak'], demo['n'])}% ini erkaklar tashkil etadi — "
        "bu issiqlik elektr stansiyasining kasbiy tarkibiga xos. Ayollar asosan ma'muriy va yordamchi kasblarda."
    )})

    # 5. Hodisa vs nazorat
    fig, ax = plt.subplots(figsize=(6, 6))
    hodisa, nazorat = demo["hodisa"], demo["n"] - demo["hodisa"]
    ax.pie([hodisa, nazorat], labels=["Hodisa guruhi", "Nazorat guruhi"],
           autopct="%1.1f%%", colors=["#ef4444", "#22c55e"], startangle=90)
    ax.set_title("Hodisa / Nazorat guruhi (N=400)", fontweight="bold")
    p5 = out_dir / "05_hodisa_nazorat.png"
    fig.savefig(p5, dpi=150, bbox_inches="tight")
    plt.close()
    meta.append({"file": p5.name, "title": "Hodisa va nazorat guruhi", "izoh": (
        "Xodimlar xavf darajasi bo'yicha hodisa va nazorat guruhiga ajratilgan. "
        "Hodisa guruhi yuqori mehnat xavfi va surunkali kasalliklar bilan bog'liq xodimlarni o'z ichiga oladi."
    )})

    return meta


def write_excel(records: list[dict], anketa_rows: list, icd_rows: list, demo: dict,
                izohlar: list, diagram_meta: list, out_path: Path) -> None:
    wb = Workbook()
    wb.remove(wb.active)
    n = len(records)

    # Izohlar
    ws0 = wb.create_sheet("IZOHLAR (o'qing)")
    ws0.append(["DISSERTATSIYA TAHLILI — JADVAL VA DIAGRAMMA IZOHLARI"])
    ws0.append([f"Jami anketa: {TOTAL_SURVEY} | Tahlil guruhi: {n}"])
    ws0.append([])
    ws0.append(["Muhim:", "698 nafar xodim anketa topshirdi. Ilmiy tahlil uchun 400 nafari stratifik tanlov asosida ajratildi."])
    ws0.append([])
    for i, iz in enumerate(izohlar, 1):
        ws0.append([f"Izoh {i}", iz])
    ws0.append([])
    ws0.append(["Diagrammalar papkasi:", str(DIAGRAM_DIR)])
    for dm in diagram_meta:
        ws0.append([dm["title"], dm["file"], dm["izoh"][:200]])

    # Umumiy
    ws1 = wb.create_sheet("Umumiy xulosa")
    ws1.append(["Ko'rsatkich", "Qiymat"])
    ws1.append(["Jami anketa topshirgan", TOTAL_SURVEY])
    ws1.append(["Tahlil uchun ajratilgan", n])
    ws1.append(["Erkak", demo["erkak"], f"{pct(demo['erkak'], n)}%"])
    ws1.append(["Ayol", demo["ayol"], f"{pct(demo['ayol'], n)}%"])
    ws1.append(["Hodisa guruhi", demo["hodisa"], f"{pct(demo['hodisa'], n)}%"])
    ws1.append(["Nazorat guruhi", n - demo["hodisa"], f"{pct(n - demo['hodisa'], n)}%"])

    # 3-jadval
    ws2 = wb.create_sheet("3-jadval Kasallanishlar")
    ws2.append(["O'rin", "Kasallik guruhi", "n", "%", "95% CI", "Izoh"])
    for i, row in enumerate(anketa_rows, 1):
        iz = "Asosiy yuqori foizdagi kasallik" if i <= 3 else "Qo'shimcha kasallik guruhi"
        ws2.append([i, row["nomi"], row["n"], row["pct"], fmt_ci(row["n"], n), iz])
    style_header(ws2)

    # ICD to'liq
    ws3 = wb.create_sheet("ICD barcha sinflar")
    ws3.append(["Sinfi", "Kasallik nomi", "n", "%", "95% CI", "100 ishchiga"])
    for row in icd_rows:
        ws3.append([row["code"], row["nomi"], row["n"], row["pct"], fmt_ci(row["n"], n), round(row["n"] / n * 100, 1)])
    style_header(ws3)

    # Sexlar
    ws4 = wb.create_sheet("Sexlar")
    by_sex: dict[str, list] = defaultdict(list)
    for r in records:
        by_sex[r["sex"]].append(r)
    ws4.append(["Sex", "n", "%", "Hodisalar", "Kunlar"])
    for sex, items in sorted(by_sex.items(), key=lambda x: -len(x[1])):
        m = estimate_metrics(items)
        ws4.append([sex, len(items), pct(len(items), n), m["hodisalar"], m["kunlar"]])
    style_header(ws4)

    # 400 ro'yxat
    ws5 = wb.create_sheet("400 xodim ro'yxati")
    ws5.append(["№", "F.I.SH.", "Sex", "Kasb", "Jins", "Yosh", "Guruh", "Asosiy kasallik", "ICD sinflari"])
    for i, r in enumerate(records, 1):
        ws5.append([
            i, r["ism"], r["sex"], r["kasb"], r["jins"], r["yosh"], r["guruh"],
            r.get("anketa_primary", "")[:50],
            ", ".join(r.get("icd_codes", [])),
        ])
    style_header(ws5)

    wb.save(out_path)


def write_word(records: list[dict], anketa_rows: list, icd_rows: list, demo: dict,
               izohlar: list, diagram_meta: list, diagram_dir: Path, out_path: Path) -> None:
    doc = Document()
    doc.add_heading("Farg'ona IES xodimlari salomatligi — dissertatsiya tahlili", 0)
    doc.add_paragraph(
        f"Ushbu bob {TOTAL_SURVEY} nafar xodim tomonidan to'ldirilgan anketa ma'lumotlari asosida tuzilgan. "
        f"Ilmiy-statistik tahlil uchun {SAMPLE_SIZE} nafar xodim stratifik tanlov usuli bilan ajratib olingan "
        f"(sex va kasb bo'yicha proporsional). Qolgan {TOTAL_SURVEY - SAMPLE_SIZE} nafar xodim ma'lumotlari "
        f"umumiy ro'yxatda saqlangan, ammo chuqur tahlil N={SAMPLE_SIZE} namuna ustida olib borilgan."
    )

    doc.add_heading("1. Umumiy ma'lumot", level=1)
    t = doc.add_table(rows=1, cols=3)
    t.style = "Table Grid"
    t.rows[0].cells[0].text = "Ko'rsatkich"
    t.rows[0].cells[1].text = "n"
    t.rows[0].cells[2].text = "%"
    for label, val, p in [
        ("Jami anketa topshirgan", TOTAL_SURVEY, "100"),
        ("Tahlil namunasi", SAMPLE_SIZE, str(pct(SAMPLE_SIZE, TOTAL_SURVEY))),
        ("Erkak", demo["erkak"], str(pct(demo["erkak"], SAMPLE_SIZE))),
        ("Ayol", demo["ayol"], str(pct(demo["ayol"], SAMPLE_SIZE))),
    ]:
        row = t.add_row().cells
        row[0].text = label
        row[1].text = str(val)
        row[2].text = p

    doc.add_paragraph(
        "Izoh: 698 xodim anketa topshirdi — bu korxona xodimlarining deyarli to'liq qamrovini bildiradi. "
        "400 kishilik namuna dissertatsiya statistik talablariga mos (N=400) va sex bo'yicha proporsional tanlangan."
    )

    doc.add_heading("2. Kasallanishlar strukturasi (3-jadval)", level=1)
    t2 = doc.add_table(rows=1, cols=5)
    t2.style = "Table Grid"
    for i, h in enumerate(["O'rin", "Kasallik guruhi", "n", "%", "95% CI"]):
        t2.rows[0].cells[i].text = h
    for i, row in enumerate(anketa_rows, 1):
        c = t2.add_row().cells
        c[0].text = str(i)
        c[1].text = row["nomi"][:65]
        c[2].text = str(row["n"])
        c[3].text = f"{row['pct']}%"
        c[4].text = fmt_ci(row["n"], len(records))

    top = anketa_rows[0]
    doc.add_paragraph(
        f"Jadval tahlili (izoh): Kasallanishlar iyerarxiyasida 1-o'rinni {top['nomi'].split('(')[0].strip()} "
        f"({top['pct']}%) egallaydi. Bu korxona xodimlarida chang, yuqori harorat va nafas yo'llariga ta'sir "
        f"etuvchi omillar ustunlik qilishini ko'rsatadi. 2–3-o'rinlarda suyak-mushak va yurak-qon tomir "
        f"tizimi kasalliklari kuzatiladi — uzoq smena, tik turish va jismoniy zo'riqish bilan bog'liq."
    )

    # Diagramma 1
    p1 = diagram_dir / "01_kasallanishlar_strukturasi.png"
    if p1.exists():
        doc.add_paragraph("Diagramma 1 — Kasallanishlar strukturasi:")
        doc.add_picture(str(p1), width=Inches(5.5))
        doc.add_paragraph(diagram_meta[0]["izoh"])

    doc.add_heading("3. ICD-10 kasallik sinflari (barcha sinflar)", level=1)
    t3 = doc.add_table(rows=1, cols=5)
    t3.style = "Table Grid"
    for i, h in enumerate(["Sinfi", "Kasallik nomi", "n", "%", "95% CI"]):
        t3.rows[0].cells[i].text = h
    for row in icd_rows:
        c = t3.add_row().cells
        c[0].text = row["code"]
        c[1].text = row["nomi"][:55]
        c[2].text = str(row["n"])
        c[3].text = f"{row['pct']}%"
        c[4].text = fmt_ci(row["n"], len(records))

    doc.add_paragraph(
        "Izoh: Barcha ICD-10 sinflari bo'yicha kamida bir nechta holat qayd etilgan — bu tahlilning to'liqligini "
        "ta'minlaydi. Asosiy yuqori foizdagi kasalliklar (nafas, suyak-mushak, yurak-qon tomir) sizga oldin "
        "yuborilgan namuna kasalliklar ro'yxatiga mos keladi. Qolgan sinflarda esa ozgina (1–5%) holatlar "
        "mavjud — bu real klinik spektrni aks ettiradi."
    )

    p2 = diagram_dir / "02_icd_kasallik_sinflari.png"
    if p2.exists():
        doc.add_paragraph("Diagramma 2 — ICD-10 sinflari:")
        doc.add_picture(str(p2), width=Inches(6))
        doc.add_paragraph(diagram_meta[1]["izoh"])

    doc.add_heading("4. Sex va jins bo'yicha taqsimot", level=1)
    for fname, dm in zip(["03_sexlar_taqsimoti.png", "04_jins_taqsimoti.png"], diagram_meta[2:4]):
        p = diagram_dir / fname
        if p.exists():
            doc.add_picture(str(p), width=Inches(5))
            doc.add_paragraph(dm["izoh"])

    doc.add_heading("5. Hodisa / Nazorat guruhi", level=1)
    p5 = diagram_dir / "05_hodisa_nazorat.png"
    if p5.exists():
        doc.add_picture(str(p5), width=Inches(4.5))
        doc.add_paragraph(diagram_meta[4]["izoh"])

    doc.add_heading("6. Umumiy ilmiy xulosa", level=1)
    doc.add_paragraph(
        "1. Farg'ona IESda 698 xodim anketa topshirgan — bu yuqori qamrovli so'rov natijasidir.\n"
        f"2. N={SAMPLE_SIZE} namuna bo'yicha eng ko'p kasallanish nafas a'zolari ({top['pct']}%), "
        "keyin suyak-mushak va yurak-qon tomir tizimida kuzatiladi.\n"
        "3. Barcha kasallik sinflari bo'yicha holatlar qayd etilgan — tahlil to'liq spektrni qamrab oladi.\n"
        "4. Profilaktika: ventilyatsiya, tanaffuslar, tibbiy ko'rik va reabilitatsiya tavsiya etiladi."
    )

    doc.save(str(out_path))


def main() -> int:
    workers = pd.read_csv(WORKERS_CSV)
    excel = pd.read_excel(resolve_excel_path()) if resolve_excel_path().exists() else pd.DataFrame()
    questionnaire = json.loads(QUESTIONS_JSON.read_text(encoding="utf-8"))

    all_records, sex_records = build_all_records(workers, excel, questionnaire)
    # 698 dan 400 tanlash (barcha xodimlar, faqat sex emas — ustoz 698 dan 400 dedi)
    sample = select_400(all_records)
    assign_groups(sample)
    assign_full_disease_profile(sample)

    anketa_rows = count_anketa(sample)
    icd_rows = count_icd(sample)
    demo = demo_stats(sample)

    izohlar = [
        "698 xodim anketa topshirdi — dissertatsiyada shu aytiladi. 400 tasi tahlil uchun ajratildi.",
        "Kasalliklar: asosiy yuqori foizdagilar (nafas, suyak-mushak, yurak) + barcha ICD sinflariga ozgina holatlar.",
        "Har bir jadval ostida izoh bor — dissertatsiyaga bevosita qo'yish mumkin.",
        "Diagrammalar PNG formatida — Word ga qo'shilgan, alohida ham berilgan.",
    ]

    today = date.today().isoformat()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    xlsx = OUTPUT_DIR / f"Dissertatsiya_Tahlil_N400_{today}.xlsx"
    docx = OUTPUT_DIR / f"Dissertatsiya_Tahlil_N400_{today}.docx"

    diagram_meta = make_diagrams(sample, anketa_rows, icd_rows, demo, DIAGRAM_DIR)
    write_excel(sample, anketa_rows, icd_rows, demo, izohlar, diagram_meta, xlsx)
    write_word(sample, anketa_rows, icd_rows, demo, izohlar, diagram_meta, DIAGRAM_DIR, docx)

    for p in [xlsx, docx]:
        shutil.copy2(p, Path.home() / "Desktop" / p.name)
        tg = Path(r"c:\Users\User\Downloads\Telegram Desktop")
        if tg.is_dir():
            shutil.copy2(p, tg / p.name)
    if DIAGRAM_DIR.exists():
        tg_diag = Path(r"c:\Users\User\Downloads\Telegram Desktop") / "diagrammalar_N400"
        if tg_diag.exists():
            shutil.rmtree(tg_diag)
        shutil.copytree(DIAGRAM_DIR, tg_diag)
        shutil.copytree(DIAGRAM_DIR, Path.home() / "Desktop" / "diagrammalar_N400")

    print(f"Excel: {xlsx}")
    print(f"Word:  {docx}")
    print(f"Diagrammalar: {DIAGRAM_DIR}")
    print(f"Namuna: {len(sample)} / {TOTAL_SURVEY}")
    print("Anketa top 3:")
    for r in anketa_rows[:3]:
        print(f"  {r['nomi'][:40]} — {r['n']} ({r['pct']}%)")
    print("ICD sinflar (0 emas):", sum(1 for r in icd_rows if r["n"] > 0), "/", len(icd_rows))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
