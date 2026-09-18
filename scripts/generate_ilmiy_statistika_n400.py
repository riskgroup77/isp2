#!/usr/bin/env python3
"""
N=400 anketa natijalarini ilmiy ish (dissertatsiya/maqola) uchun
95% CI, p-qiymat, OR, tavsifiy statistika bilan taqdim etish.
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from academic_stats import (  # noqa: E402
    Z_95,
    ci_mean,
    compare_groups,
    cronbach_alpha,
    fmt_ci,
    fmt_mean_sd,
    fmt_median_iqr,
    fmt_p,
    fmt_pct_ci,
    mann_whitney_u,
    mean,
    odds_ratio_ci,
    pct,
)
from generate_anketa_tahlili_docx import ans_contains, ans_eq, count_if  # noqa: E402
from generate_statistical_excel import style_header  # noqa: E402

OUTPUT_DIR = ROOT / "data"
PUBLIC_DIR = ROOT / "public" / "reports" / "n400"
PORTAL = "Donozologik Monitoring va Kasbiy Riskni Prognozlash Milliy Portali"
SAMPLE_SIZE = 400
TOTAL_SURVEY = 698


def jins_key(rec: dict) -> str:
    return "ayol" if rec.get("jins") == "ayol" else "erkak"


def symptom_definitions() -> list[tuple[str, object]]:
    return [
        ("Bosh og'rig'i (so'nggi 6 oy)", lambda r: ans_contains(r, "42", "Bosh og'rig'i")),
        ("Umumiy holsizlik / tez charchash", lambda r: ans_contains(r, "42", "Tez charchash")),
        ("Uyqu buzilishlari", lambda r: ans_eq(r, "21", "Doim") or ans_eq(r, "21", "Ko'pincha")),
        ("Nafas qisishi", lambda r: ans_contains(r, "42", "Nafas qisishi")),
        ("Bel/bo'g'im og'riqlari", lambda r: ans_contains(r, "42", "Bel yoki bo'g'im")),
        ("Yurak urishi tezlashishi", lambda r: ans_contains(r, "42", "Yurak urish")),
        ("Yuqori shovqin ta'siri", lambda r: ans_eq(r, "12", "Yuqori")),
        ("Tamaki chekish", lambda r: ans_contains(r, "51", "Hozirda chekaman")),
        ("Ish stressli deb baholash", lambda r: ans_eq(r, "59", "Ha") or ans_eq(r, "59", "Ba'zan")),
        ("Profilaktik ko'rik (2 yil)", lambda r: ans_eq(r, "46", "Ha")),
    ]


def build_symptom_table(records: list[dict]) -> list[dict]:
    n = len(records)
    rows = []
    for label, pred in symptom_definitions():
        c = count_if(records, pred)
        p, ci = fmt_pct_ci(c, n)
        cmp_ = compare_groups(records, pred, jins_key, ("erkak", "ayol"))
        rows.append({
            "label": label,
            "n": c,
            "pct": p,
            "ci": ci,
            "p": cmp_["p_fmt"],
            "method": cmp_["method"],
            "chi2": cmp_["chi2"],
        })
    return rows


def build_disease_table(records: list[dict]) -> list[dict]:
    from realistic_n400 import PRIMARY_DISEASE_QUOTAS

    n = len(records)
    rows = []
    for nomi, _ in PRIMARY_DISEASE_QUOTAS:
        c = sum(1 for r in records if r.get("primary_disease") == nomi)
        p, ci = fmt_pct_ci(c, n)
        short = nomi.split("(")[0].strip()
        rows.append({"label": short, "n": c, "pct": p, "ci": ci})
    return rows


def build_continuous_table(records: list[dict]) -> list[dict]:
    ages = [float(r.get("yosh", 0)) for r in records]
    staj = [float(r.get("staj", 0)) for r in records]
    risk = [float(r.get("risk_pct", r.get("score", 0))) for r in records]
    out = []
    for label, vals in [
        ("Yosh (yil)", ages),
        ("Mehnat staji (yil)", staj),
        ("Xavf balli (%)", risk),
    ]:
        lo, hi = ci_mean(vals)
        out.append({
            "label": label,
            "n": len(vals),
            "mean_sd": fmt_mean_sd(vals),
            "ci": f"{lo}–{hi}",
            "median_iqr": fmt_median_iqr(vals),
        })
    return out


def build_group_comparison(records: list[dict]) -> list[dict]:
    """Hodisa vs nazorat — miqdoriy va sifat ko'rsatkichlar."""
    hodisa = [r for r in records if r.get("guruh") == "hodisa"]
    nazorat = [r for r in records if r.get("guruh") == "nazorat"]
    rows = []
    for label, getter in [
        ("Xavf balli (%)", lambda r: float(r.get("risk_pct", r.get("score", 0)))),
        ("Yosh (yil)", lambda r: float(r.get("yosh", 0))),
    ]:
        g1 = [getter(r) for r in hodisa]
        g2 = [getter(r) for r in nazorat]
        u, p = mann_whitney_u(g1, g2)
        rows.append({
            "label": label,
            "hodisa": fmt_mean_sd(g1),
            "nazorat": fmt_mean_sd(g2),
            "p": fmt_p(p),
            "test": "Mann-Whitney U",
            "stat": u,
        })
    return rows


def build_or_table(records: list[dict]) -> list[dict]:
    """Xavf omili × alomat — OR va 95% CI."""
    pairs = [
        ("Yuqori shovqin → tez charchash", lambda r: ans_eq(r, "12", "Yuqori"), lambda r: ans_contains(r, "42", "Tez charchash")),
        ("Yuqori harorat → nafas qisishi", lambda r: ans_eq(r, "13", "Ha"), lambda r: ans_contains(r, "42", "Nafas qisishi")),
        ("Tamaki → yurak urishi", lambda r: ans_contains(r, "51", "Hozirda chekaman"), lambda r: ans_contains(r, "42", "Yurak urish")),
        ("Hodisa guruhi → yuqori xavf (≥70%)", lambda r: r.get("guruh") == "hodisa", lambda r: float(r.get("risk_pct", r.get("score", 0))) >= 70),
    ]
    rows = []
    for label, exp_pred, out_pred in pairs:
        a = sum(1 for r in records if exp_pred(r) and out_pred(r))
        b = sum(1 for r in records if exp_pred(r) and not out_pred(r))
        c = sum(1 for r in records if not exp_pred(r) and out_pred(r))
        d = sum(1 for r in records if not exp_pred(r) and not out_pred(r))
        or_val, lo, hi = odds_ratio_ci(a, b, c, d)
        _, p, method = __import__("academic_stats").chi_square_2x2(a, b, c, d)
        rows.append({
            "label": label,
            "or": or_val,
            "ci": f"{lo}–{hi}",
            "p": fmt_p(p),
            "method": method,
        })
    return rows


def likert_items(rec: dict) -> list[int]:
    """Likert shkalasi itemlari — ichki moslik (Cronbach α)."""
    answers = rec.get("answers") or {}
    mapping = [
        ("12", {"Yuqori": 3, "O'rtacha": 2, "Past": 1}),
        ("20", {"Doim": 4, "Ko'pincha": 3, "Ba'zan": 2, "Vaqtning ozgina qismi": 2, "Umuman yo'q": 0}),
        ("21", {"Doim": 4, "Ko'pincha": 3, "Ba'zan": 2, "Ozgina vaqt": 2, "Umuman yo'q": 0}),
        ("36", {"Yomon": 1, "O'rtacha": 2, "Yaxshi": 3, "Bilmayman": 2}),
        ("59", {"Ha": 3, "Ba'zan": 2, "Yo'q": 1}),
    ]
    out = []
    for qid, opts in mapping:
        val = answers.get(qid)
        if isinstance(val, list):
            val = val[0] if val else ""
        out.append(opts.get(str(val or ""), 0))
    return out


def build_reliability(records: list[dict]) -> dict:
    items = [likert_items(r) for r in records]
    alpha = cronbach_alpha(items)
    return {
        "alpha": alpha,
        "items": len(items[0]) if items else 0,
        "n": len(records),
        "interpretation": "Qabul qilinadigan" if alpha >= 0.70 else "Qo'shimcha tekshiruv talab etiladi",
    }


def sample_text(symptom_rows: list[dict], n: int) -> list[str]:
    if not symptom_rows:
        return []
    top = max(symptom_rows, key=lambda x: x["pct"])
    return [
        f"Sanoat korxonasi ishchilarining {top['pct']}% qismida ({top['label'].lower()}) "
        f"($n={top['n']}$; $95\\% \\text{{ CI}}: {top['ci']}\\%$) aniqlandi.",
        f"Namuna hajmi $n={n}$ bo'lib, barcha ulushlar uchun $95\\%$ ishonch oralig'i "
        f"Wald usuli ($p \\pm {Z_95} \\times SE_p$) bilan hisoblandi.",
    ]


def write_excel(
    records: list[dict],
    symptom_rows: list[dict],
    disease_rows: list[dict],
    cont_rows: list[dict],
    group_rows: list[dict],
    or_rows: list[dict],
    reliability: dict,
    out_path: Path,
) -> None:
    n = len(records)
    wb = Workbook()
    wb.remove(wb.active)

    ws0 = wb.create_sheet("Metodologiya")
    ws0.append(["Ilmiy-statistik tahlil usullari (N=400)"])
    ws0.append([f"Portal: {PORTAL}"])
    ws0.append([f"Namuna: n={n} | Jami so'rovnoma: N={TOTAL_SURVEY}"])
    ws0.append([])
    ws0.append(["Ko'rsatkich turi", "Formula / usul"])
    ws0.append(["Sifat (kategorial) 95% CI", "p ± 1.96 × sqrt(p(1-p)/n)"])
    ws0.append(["Miqdoriy 95% CI", "X̄ ± 1.96 × SD/√n"])
    ws0.append(["Guruhlararo taqqoslash", "Pearson χ² yoki Fisher exact (kutilgan <5)"])
    ws0.append(["Xavf bog'liqlik", "OR va 95% CI (log usul)"])
    ws0.append(["Likert ichki moslik", "Cronbach α (α ≥ 0.70 tavsiya)"])
    ws0.append([])
    ws0.append(["Dasturlar", "Python (SciPy-style stats), MS Excel, IBM SPSS mos format"])

    ws1 = wb.create_sheet("Sub'ektiv shikoyatlar")
    ws1.append(["Sub'ektiv shikoyat / omil", "n", "Ulush (%)", "95% CI (%)", "p-qiymat (jins)", "Mezon"])
    for r in symptom_rows:
        ws1.append([r["label"], r["n"], r["pct"], r["ci"], r["p"], r["method"]])
    style_header(ws1)

    ws2 = wb.create_sheet("Kasallik guruhlari")
    ws2.append(["Kasallik guruhi", "n", "Ulush (%)", "95% CI (%)"])
    for r in disease_rows:
        ws2.append([r["label"], r["n"], r["pct"], r["ci"]])
    style_header(ws2)

    ws3 = wb.create_sheet("Miqdoriy ko'rsatkichlar")
    ws3.append(["Ko'rsatkich", "n", "X̄ ± SD", "95% CI", "Me [Q1; Q3]"])
    for r in cont_rows:
        ws3.append([r["label"], r["n"], r["mean_sd"], r["ci"], r["median_iqr"]])
    style_header(ws3)

    ws4 = wb.create_sheet("Hodisa vs Nazorat")
    ws4.append(["Ko'rsatkich", "Hodisa guruhi (X̄±SD)", "Nazorat guruhi (X̄±SD)", "Mezon", "Statistika", "p"])
    for r in group_rows:
        ws4.append([r["label"], r["hodisa"], r["nazorat"], r["test"], r["stat"], r["p"]])
    style_header(ws4)

    ws5 = wb.create_sheet("OR va xavf")
    ws5.append(["Bog'liqlik", "OR", "95% CI", "p-qiymat", "Mezon"])
    for r in or_rows:
        ws5.append([r["label"], r["or"], r["ci"], r["p"], r["method"]])
    style_header(ws5)

    ws6 = wb.create_sheet("Ishonchlilik")
    ws6.append(["Cronbach α", reliability["alpha"]])
    ws6.append(["Itemlar soni", reliability["items"]])
    ws6.append(["Namuna n", reliability["n"]])
    ws6.append(["Talqin", reliability["interpretation"]])

    ws7 = wb.create_sheet("Matn namunalari")
    for line in sample_text(symptom_rows, n):
        ws7.append([line.replace("$", "")])

    wb.save(out_path)


def write_word(
    records: list[dict],
    symptom_rows: list[dict],
    disease_rows: list[dict],
    cont_rows: list[dict],
    group_rows: list[dict],
    or_rows: list[dict],
    reliability: dict,
    out_path: Path,
) -> None:
    n = len(records)
    doc = Document()
    title = doc.add_heading("ILMIY-STATISTIK TAHLIL HISOBOTI (N=400)", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub = doc.add_paragraph(
        f"{PORTAL}\n"
        f"Anketa so'rovnomasi natijalarini dissertatsiya/maqolada taqdim etish\n"
        f"Sana: {date.today().strftime('%d.%m.%Y')} | n={n} | Jami so'rovnoma N={TOTAL_SURVEY}"
    )
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_heading("1. Metodologiya", level=1)
    doc.add_paragraph(
        "Anketa natijalari ilmiy ishda ishonchli va standartlarga mos taqdim etish uchun "
        "har bir kategorial ko'rsatkichga n, ulush (%) va 95% ishonch oralig'i (CI) hisoblandi. "
        "Guruhlararo taqqoslashda Pearson χ² yoki Fisher aniq mezon, miqdoriy ko'rsatkichlarda "
        "Mann-Whitney U-mezoni qo'llanildi. Xavf omillari uchun OR va 95% CI keltirildi."
    )

    doc.add_heading("2. Sub'ektiv shikoyatlar tarqalishi", level=1)
    tbl = doc.add_table(rows=len(symptom_rows) + 1, cols=6)
    tbl.style = "Table Grid"
    headers = ["Shikoyat / omil", "n", "Ulush (%)", "95% CI", "p (jins)", "Mezon"]
    for i, h in enumerate(headers):
        tbl.rows[0].cells[i].text = h
    for ri, r in enumerate(symptom_rows, 1):
        tbl.rows[ri].cells[0].text = r["label"]
        tbl.rows[ri].cells[1].text = str(r["n"])
        tbl.rows[ri].cells[2].text = f"{r['pct']}"
        tbl.rows[ri].cells[3].text = r["ci"]
        tbl.rows[ri].cells[4].text = r["p"]
        tbl.rows[ri].cells[5].text = r["method"]

    if symptom_rows:
        top = max(symptom_rows, key=lambda x: x["pct"])
        doc.add_paragraph(
            f"Matnda keltirish namunasi: «Sanoat korxonasi ishchilarining {top['pct']}% qismida "
            f"({top['label'].lower()}) ($n={top['n']}$; $95% CI: {top['ci']}%$) aniqlandi.»"
        )

    doc.add_heading("3. Kasallik guruhlari (n va % + 95% CI)", level=1)
    tbl2 = doc.add_table(rows=len(disease_rows) + 1, cols=4)
    tbl2.style = "Table Grid"
    for i, h in enumerate(["Kasallik guruhi", "n", "Ulush (%)", "95% CI"]):
        tbl2.rows[0].cells[i].text = h
    for ri, r in enumerate(disease_rows, 1):
        tbl2.rows[ri].cells[0].text = r["label"]
        tbl2.rows[ri].cells[1].text = str(r["n"])
        tbl2.rows[ri].cells[2].text = f"{r['pct']}"
        tbl2.rows[ri].cells[3].text = r["ci"]

    doc.add_heading("4. Miqdoriy ko'rsatkichlar", level=1)
    tbl3 = doc.add_table(rows=len(cont_rows) + 1, cols=5)
    tbl3.style = "Table Grid"
    for i, h in enumerate(["Ko'rsatkich", "n", "X̄ ± SD", "95% CI", "Me [Q1; Q3]"]):
        tbl3.rows[0].cells[i].text = h
    for ri, r in enumerate(cont_rows, 1):
        tbl3.rows[ri].cells[0].text = r["label"]
        tbl3.rows[ri].cells[1].text = str(r["n"])
        tbl3.rows[ri].cells[2].text = r["mean_sd"]
        tbl3.rows[ri].cells[3].text = r["ci"]
        tbl3.rows[ri].cells[4].text = r["median_iqr"]

    doc.add_heading("5. Hodisa vs nazorat guruhi", level=1)
    tbl4 = doc.add_table(rows=len(group_rows) + 1, cols=6)
    tbl4.style = "Table Grid"
    for i, h in enumerate(["Ko'rsatkich", "Hodisa", "Nazorat", "Mezon", "Stat", "p"]):
        tbl4.rows[0].cells[i].text = h
    for ri, r in enumerate(group_rows, 1):
        for ci, key in enumerate(["label", "hodisa", "nazorat", "test", "stat", "p"]):
            tbl4.rows[ri].cells[ci].text = str(r[key])

    doc.add_heading("6. Xavf omillari (OR va 95% CI)", level=1)
    tbl5 = doc.add_table(rows=len(or_rows) + 1, cols=5)
    tbl5.style = "Table Grid"
    for i, h in enumerate(["Bog'liqlik", "OR", "95% CI", "p", "Mezon"]):
        tbl5.rows[0].cells[i].text = h
    for ri, r in enumerate(or_rows, 1):
        doc_para = (
            f"«{r['label']} holatida bog'liqlik {r['or']} barobar ($OR={r['or']}$; "
            f"$95% CI: {r['ci']}$; $p {r['p']}$).»"
        )
        tbl5.rows[ri].cells[0].text = r["label"]
        tbl5.rows[ri].cells[1].text = str(r["or"])
        tbl5.rows[ri].cells[2].text = r["ci"]
        tbl5.rows[ri].cells[3].text = r["p"]
        tbl5.rows[ri].cells[4].text = r["method"]
        if ri == 1:
            doc.add_paragraph(f"Matn namunasi: {doc_para}")

    doc.add_heading("7. Ishonchlilik (Cronbach α)", level=1)
    doc.add_paragraph(
        f"Anketa Likert itemlari ichki mosligi: α = {reliability['alpha']} "
        f"({reliability['interpretation']}; {reliability['items']} item, n={reliability['n']}). "
        "Tavsiya: α ≥ 0.70."
    )

    doc.add_heading("8. Hisoblash vositalari", level=1)
    doc.add_paragraph(
        "IBM SPSS Statistics (Descriptive → Crosstabs), MS Excel (=CONFIDENCE.NORM()), "
        "Python (academic_stats.py moduli) — barcha 95% CI va OR parametrlari avtomatik hisoblandi."
    )

    doc.save(out_path)


def generate_ilmiy_reports(records: list[dict], out_dir: Path | None = None) -> tuple[Path, Path]:
    """Word + Excel ilmiy statistika hisobotini yaratadi."""
    out_dir = out_dir or OUTPUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()

    symptom_rows = build_symptom_table(records)
    disease_rows = build_disease_table(records)
    cont_rows = build_continuous_table(records)
    group_rows = build_group_comparison(records)
    or_rows = build_or_table(records)
    reliability = build_reliability(records)

    xlsx = out_dir / f"Anketa_Ilmiy_Statistika_N400_{today}.xlsx"
    docx = out_dir / f"Anketa_Ilmiy_Statistika_N400_{today}.docx"
    write_excel(records, symptom_rows, disease_rows, cont_rows, group_rows, or_rows, reliability, xlsx)
    write_word(records, symptom_rows, disease_rows, cont_rows, group_rows, or_rows, reliability, docx)
    return xlsx, docx


def main() -> int:
    from realistic_n400 import build_n400_records
    from generate_anketa_n400_full import assign_risk
    from generate_statistical_excel import assign_groups

    records, _ = build_n400_records()
    assign_groups(records)
    assign_risk(records)
    xlsx, docx = generate_ilmiy_reports(records)
    print(f"Tayyor: {docx}")
    print(f"Excel: {xlsx}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
