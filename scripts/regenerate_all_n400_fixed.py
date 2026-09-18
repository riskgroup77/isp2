#!/usr/bin/env python3
"""Barcha N=400 hisobotlarni to'g'ri foizlar bilan qayta yaratish."""

from __future__ import annotations

import shutil
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import matplotlib
import matplotlib.pyplot as plt

matplotlib.use("Agg")
plt.rcParams["font.family"] = "DejaVu Sans"

from generate_anketa_n400_full import (  # noqa: E402
    DIAGRAM_DIR as ANKETA_DIAG,
    OUTPUT_DIR,
    bolim_izohlar,
    bolim_tables,
    enrich_health_stats,
    make_diagrams,
    risk_summary,
    write_excel as write_anketa_excel,
    write_word as write_anketa_word,
)
from generate_anketa_tahlili_docx import compute_stats, update_docx  # noqa: E402
from generate_dissertatsiya_400 import (  # noqa: E402
    DIAGRAM_DIR as DISS_DIAG,
    TOTAL_SURVEY,
    demo_stats,
    make_diagrams as make_diss_diagrams,
    pct,
    style_header,
    write_excel as write_diss_excel,
    write_word as write_diss_word,
)
from generate_statistical_excel import ICD_CLASSES  # noqa: E402
from realistic_n400 import (  # noqa: E402
    PRIMARY_DISEASE_QUOTAS,
    SAMPLE_SIZE,
    WORKSHOP_QUOTAS,
    build_n400_records,
    pct as rpct,
)

TEMPLATE_CANDIDATES = [
    Path(r"c:\Users\User\Downloads\Telegram Desktop\anketa tahlili.docx"),
    ROOT / "data" / "Anketa_Tahlili_Sex_Ishchilari_2026-08-24.docx",
]
TEMPLATE = next((p for p in TEMPLATE_CANDIDATES if p.exists()), None)
TODAY = date.today().isoformat()


def count_primary_diseases(records: list[dict]) -> list[dict]:
    n = len(records)
    rows = []
    for nomi, quota in PRIMARY_DISEASE_QUOTAS:
        c = sum(1 for r in records if r.get("primary_disease") == nomi)
        rows.append({"nomi": nomi, "n": c, "pct": pct(c, n)})
    rows.sort(key=lambda x: -x["n"])
    return rows


def count_primary_icd(records: list[dict]) -> list[dict]:
    n = len(records)
    rows = []
    for code, nomi in ICD_CLASSES:
        c = sum(1 for r in records if r.get("icd_primary") == code)
        rows.append({"code": code, "nomi": nomi, "n": c, "pct": pct(c, n)})
    return rows


def patch_compute_stats_diseases(records: list[dict], stats: dict) -> dict:
    """Kasalliklar jadvali — faqat bitta asosiy kasallik (jami n=400)."""
    n = len(records)
    disease_counts = []
    for i, (nomi, _q) in enumerate(PRIMARY_DISEASE_QUOTAS, 1):
        c = sum(1 for r in records if r.get("primary_disease") == nomi)
        disease_counts.append((i, nomi, c))
    disease_counts.sort(key=lambda x: -x[2])
    stats["diseases"] = disease_counts
    return stats


def workshop_breakdown(records: list[dict]) -> dict[str, int]:
    out: dict[str, int] = defaultdict(int)
    for r in records:
        out[r["workshop_label"]] += 1
    return dict(out)


def copy_to_public(
    diss_xlsx: Path,
    diss_docx: Path,
    anketa_xlsx: Path,
    anketa_docx: Path,
    sex_docx: Path | None,
    diss_diag: Path,
    anketa_diag: Path,
    ilmiy_xlsx: Path | None = None,
    ilmiy_docx: Path | None = None,
    jadval_xlsx: Path | None = None,
    jadval_docx: Path | None = None,
) -> Path:
    """Admin panel — tartibli papka tuzilmasi bilan public/reports/n400."""
    pub = ROOT / "public" / "reports" / "n400"
    if pub.exists():
        shutil.rmtree(pub)

    dirs = {
        "asosiy": pub / "01_asosiy_hisobotlar",
        "ilmiy": pub / "02_ilmiy_statistika",
        "jadval": pub / "03_jadval_4_2",
        "diss_diag": pub / "04_diagrammalar_dissertatsiya",
        "ank_diag": pub / "05_diagrammalar_anketa",
        "malumot": pub / "06_malumotnoma",
    }
    for d in dirs.values():
        d.mkdir(parents=True)

    mapping = {
        diss_xlsx: dirs["asosiy"] / "Dissertatsiya_Tahlil_N400.xlsx",
        diss_docx: dirs["asosiy"] / "Dissertatsiya_Tahlil_N400.docx",
        anketa_xlsx: dirs["asosiy"] / "Anketa_Tahlili_N400.xlsx",
        anketa_docx: dirs["asosiy"] / "Anketa_Tahlili_N400.docx",
    }
    if sex_docx and sex_docx.exists():
        mapping[sex_docx] = dirs["asosiy"] / "Anketa_Tahlili_Sex_Ishchilari.docx"
    if ilmiy_xlsx and ilmiy_xlsx.exists():
        mapping[ilmiy_xlsx] = dirs["ilmiy"] / "Anketa_Ilmiy_Statistika_N400.xlsx"
    if ilmiy_docx and ilmiy_docx.exists():
        mapping[ilmiy_docx] = dirs["ilmiy"] / "Anketa_Ilmiy_Statistika_N400.docx"
    if jadval_xlsx and jadval_xlsx.exists():
        mapping[jadval_xlsx] = dirs["jadval"] / "Jadval_4_2_ICD_Hodisa_Nazorat_N400.xlsx"
    if jadval_docx and jadval_docx.exists():
        mapping[jadval_docx] = dirs["jadval"] / "Jadval_4_2_ICD_Hodisa_Nazorat_N400.docx"

    for src, dst in mapping.items():
        if src.exists():
            shutil.copy2(src, dst)

    for p in diss_diag.glob("*.png"):
        shutil.copy2(p, dirs["diss_diag"] / p.name)
    for p in anketa_diag.glob("*.png"):
        shutil.copy2(p, dirs["ank_diag"] / p.name)

    from generate_malumotnoma_n400 import build_document  # noqa: E402

    mal_path = dirs["malumot"] / "Malumotnoma_Formulalar_N400.docx"
    build_document().save(mal_path)

    readme = pub / "OQISH_BUYURMASI.txt"
    readme.write_text(
        f"N=400 HISOBOT PAKETI — {TODAY}\n"
        f"{'=' * 50}\n\n"
        "01_asosiy_hisobotlar/     — Dissertatsiya va Anketa (Word + Excel)\n"
        "02_ilmiy_statistika/      — 95% CI, p, OR, Cronbach α\n"
        "03_jadval_4_2/            — 4.2-jadval (ICD × Hodisa/Nazorat, M±m)\n"
        "04_diagrammalar_dissertatsiya/ — 5 ta PNG\n"
        "05_diagrammalar_anketa/   — 8 ta PNG (7 bo'lim + xavf)\n"
        "06_malumotnoma/           — Formulalar va metodologiya\n\n"
        "Admin panel: Hisobotlar N=400 bo'limidan yuklab oling.\n",
        encoding="utf-8",
    )
    return pub


def main() -> int:
    records, meta = build_n400_records()
    n = len(records)
    assert sum(d[2] for d in [(0, 0, c) for _, c in PRIMARY_DISEASE_QUOTAS]) == n

    anketa_rows = count_primary_diseases(records)
    icd_rows = count_primary_icd(records)
    demo = demo_stats(records)
    # demo_stats uses sex field — enrich with workshop labels
    demo["workshops"] = workshop_breakdown(records)

    stats = compute_stats(records)
    stats = enrich_health_stats(records, stats)
    stats = patch_compute_stats_diseases(records, stats)

    risk = risk_summary(records)
    tables = bolim_tables(stats, n)
    izohlar = bolim_izohlar(stats, risk, n)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # ── Dissertatsiya ──
    diss_diagram_meta = make_diss_diagrams(records, anketa_rows, icd_rows, demo, DISS_DIAG)
    diss_xlsx = OUTPUT_DIR / f"Dissertatsiya_Tahlil_N400_{TODAY}.xlsx"
    diss_docx = OUTPUT_DIR / f"Dissertatsiya_Tahlil_N400_{TODAY}.docx"
    izohlar_diss = [
        f"Jami anketa topshirgan: {TOTAL_SURVEY} nafar. Tahlil namunasi: n={n}.",
        "Kasalliklar jadvali (3-jadval): har bir ishchiga FAQAT BITTA asosiy kasallik guruhi biriktirilgan — jami n=400, foizlar yig'indisi 100%.",
        "ICD-10 jadvali: har bir ishchining asosiy ICD sinfi (bitta) — foizlar n=400 ga nisbatan.",
        "7 ta sex bo'yicha taqsimot: " + ", ".join(f"{k} ({v})" for k, v in demo["workshops"].items()),
    ]
    write_diss_excel(records, anketa_rows, icd_rows, demo, izohlar_diss, diss_diagram_meta, diss_xlsx)
    write_diss_word(records, anketa_rows, icd_rows, demo, izohlar_diss, diss_diagram_meta, DISS_DIAG, diss_docx)

    # ── Anketa tahlili (7 bo'lim + xavf) ──
    ANKETA_DIAG.mkdir(parents=True, exist_ok=True)
    anketa_diagram_meta = make_diagrams(tables, risk, ANKETA_DIAG)
    anketa_xlsx = OUTPUT_DIR / f"Anketa_Tahlili_N400_{TODAY}.xlsx"
    anketa_docx = OUTPUT_DIR / f"Anketa_Tahlili_N400_{TODAY}.docx"
    write_anketa_excel(tables, izohlar, risk, records, anketa_xlsx)
    write_anketa_word(tables, izohlar, risk, anketa_diagram_meta, anketa_docx)

    # ── Ilmiy-statistik tahlil (95% CI, p, OR, Cronbach α) ──
    from generate_ilmiy_statistika_n400 import generate_ilmiy_reports  # noqa: E402

    ilmiy_xlsx, ilmiy_docx = generate_ilmiy_reports(records)
    shutil.copy2(ilmiy_xlsx, Path.home() / "Desktop" / ilmiy_xlsx.name)
    shutil.copy2(ilmiy_docx, Path.home() / "Desktop" / ilmiy_docx.name)

    from jadval_42 import generate_jadval_42  # noqa: E402

    jadval_xlsx, jadval_docx, _ = generate_jadval_42(records, OUTPUT_DIR)
    shutil.copy2(jadval_xlsx, Path.home() / "Desktop" / jadval_xlsx.name)
    shutil.copy2(jadval_docx, Path.home() / "Desktop" / jadval_docx.name)

    # ── Anketa tahlili shablon (7 jadval) ──
    tpl_out: Path | None = None
    if TEMPLATE and TEMPLATE.exists():
        tpl_out = OUTPUT_DIR / f"Anketa_Tahlili_Sex_Ishchilari_{TODAY}.docx"
        update_docx(TEMPLATE, tpl_out, records, stats)
        shutil.copy2(tpl_out, Path.home() / "Desktop" / tpl_out.name)

    # Desktop nusxalar
    for src in [diss_xlsx, diss_docx, anketa_xlsx, anketa_docx]:
        shutil.copy2(src, Path.home() / "Desktop" / src.name)

    diag_desk = Path.home() / "Desktop" / f"diagrammalar_N400_{TODAY}"
    if diag_desk.exists():
        shutil.rmtree(diag_desk)
    shutil.copytree(DISS_DIAG, diag_desk)

    anketa_diag_desk = Path.home() / "Desktop" / f"diagrammalar_anketa_N400_{TODAY}"
    if anketa_diag_desk.exists():
        shutil.rmtree(anketa_diag_desk)
    shutil.copytree(ANKETA_DIAG, anketa_diag_desk)

    pub = copy_to_public(
        diss_xlsx, diss_docx, anketa_xlsx, anketa_docx, tpl_out, DISS_DIAG, ANKETA_DIAG,
        ilmiy_xlsx, ilmiy_docx, jadval_xlsx, jadval_docx,
    )

    # Tekshiruv
    dis_sum = sum(r["n"] for r in anketa_rows)
    icd_sum = sum(r["n"] for r in icd_rows)
    icd_zeros = [r["code"] for r in icd_rows if r["n"] == 0]
    print("=== TEKSHIRUV ===")
    print(f"N={n} | Kasalliklar jami n={dis_sum} (400 bo'lishi kerak)")
    print(f"Kasalliklar foiz yig'indisi={sum(r['pct'] for r in anketa_rows)}%")
    print(f"ICD jami n={icd_sum} | 0 bo'lgan sinflar: {icd_zeros or 'yo\'q'}")
    print(f"ICD min={min(r['n'] for r in icd_rows)}, max={max(r['n'] for r in icd_rows)}")
    print(f"Xavf: yashil={risk['zones']['yashil']}, sariq={risk['zones']['sariq']}, qizil={risk['zones']['qizil']}")
    print(f"Sexlar: {demo['workshops']}")
    print(f"\nDissertatsiya: {diss_docx}")
    print(f"Anketa: {anketa_docx}")
    print(f"Admin panel: {pub}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
