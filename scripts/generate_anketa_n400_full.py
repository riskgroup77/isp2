#!/usr/bin/env python3
"""
Anketa tahlili N=400 — har bo'lim uchun jadval + diagramma + izoh.
Fokus: so'rovnoma javoblari va Milliy-ilmiy ko'p rolli portal xavf zonasi (yashil/sariq/qizil).
Kasalliklar sinfi emas — anketa bo'limlari bo'yicha tahlil.
"""

from __future__ import annotations

import json
import random
import shutil
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

import matplotlib
import matplotlib.pyplot as plt
import pandas as pd
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

matplotlib.use("Agg")
plt.rcParams["font.family"] = "DejaVu Sans"

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from bulk_submit_surveys import resolve_excel_path
from generate_anketa_tahlili_docx import (  # noqa: E402
    compute_stats,
    count_if,
    fmt_n,
    fmt_pct,
)
from generate_dissertatsiya_400 import select_400
from academic_stats import fmt_ci  # noqa: E402
from generate_statistical_excel import (
    QUESTIONS_JSON,
    WORKERS_CSV,
    assign_groups,
    build_all_records,
    pct,
    style_header,
)

OUTPUT_DIR = ROOT / "data"
DIAGRAM_DIR = OUTPUT_DIR / "diagrammalar_anketa_n400"
SAMPLE_SIZE = 400
TOTAL_SURVEY = 698
TEMPLATE = Path(r"c:\Users\User\Downloads\Telegram Desktop\anketa tahlili.docx")

RISK_COLORS = {"yashil": "#22c55e", "sariq": "#eab308", "qizil": "#ef4444"}
RISK_LABELS = {
    "yashil": "Past xavf (yashil, <35%) — kelajakda kasallanish ehtimoli nisbatan past",
    "sariq": "O'rtacha xavf (sariq, 35–69%) — profilaktik nazorat talab etiladi",
    "qizil": "Yuqori xavf (qizil, ≥70%) — tezkor tibbiy ko'rik va profilaktika zarur",
}


def risk_zone(score: int) -> str:
    """Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali: yashil <35%, sariq 35–69%, qizil ≥70% (issiqlik sexi xodimlari uchun)."""
    if score >= 70:
        return "qizil"
    if score >= 35:
        return "sariq"
    return "yashil"


def compute_anketa_risk(rec: dict) -> int:
    """Anketa javoblaridan Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali uslubida xavf balli (8–92%)."""
    from generate_anketa_tahlili_docx import ans_contains, ans_eq

    pts = 8.0

    if ans_eq(rec, "12", "Yuqori"):
        pts += 6
    elif ans_eq(rec, "12", "O'rtacha"):
        pts += 2
    if ans_eq(rec, "13", "Ha"):
        pts += 5
    if ans_eq(rec, "14", "Umuman yo'q"):
        pts += 4
    elif ans_eq(rec, "14", "Ba'zan"):
        pts += 2
    if ans_eq(rec, "20", "Doim"):
        pts += 8
    elif ans_eq(rec, "20", "Ko'pincha"):
        pts += 5
    if ans_eq(rec, "21", "Doim"):
        pts += 6
    elif ans_eq(rec, "21", "Ko'pincha"):
        pts += 4
    if ans_eq(rec, "27", "Ha"):
        pts += 4
    if ans_eq(rec, "28", "Ha"):
        pts += 5
    elif ans_eq(rec, "28", "Ba'zan"):
        pts += 2
    if ans_eq(rec, "29", "Ha"):
        pts += 4
    elif ans_eq(rec, "29", "Ba'zan"):
        pts += 2
    if ans_eq(rec, "36", "Yomon"):
        pts += 10
    elif ans_eq(rec, "36", "O'rtacha"):
        pts += 5
    elif ans_eq(rec, "36", "Yaxshi"):
        pts -= 3
    if ans_contains(rec, "51", "Hozirda chekaman"):
        pts += 10
    if ans_eq(rec, "52", "Yo'q va xohlamasdim"):
        pts += 5
    elif ans_eq(rec, "52", "Yo'q, lekin xohlardim"):
        pts += 3
    if ans_eq(rec, "59", "Ha"):
        pts += 6
    elif ans_eq(rec, "59", "Ba'zan"):
        pts += 3
    if ans_eq(rec, "46", "Ha"):
        pts += 7
    elif ans_eq(rec, "46", "Qisman"):
        pts += 3
    if ans_eq(rec, "70", "O'ta kam miqdorda"):
        pts += 5
    elif ans_eq(rec, "70", "Kam miqdorda"):
        pts += 3
    if ans_contains(rec, "42", "Tez charchash"):
        pts += 3
    if ans_contains(rec, "42", "Nafas qisishi"):
        pts += 3
    if ans_eq(rec, "24", "8 soatdan ko'p"):
        pts += 4
    elif ans_eq(rec, "24", "6-8 soat"):
        pts += 2

    age = rec.get("yosh", 40)
    if age >= 55:
        pts += 4
    elif age >= 45:
        pts += 2

    if ans_eq(rec, "18", "Juda qoniqaman"):
        pts -= 2
    if ans_eq(rec, "52", "Ha, muntazam ravishda yoki vaqti-vaqti bilan mashq qilaman"):
        pts -= 4
    if ans_eq(rec, "37", "Ha"):
        pts -= 2

    return int(max(8, min(92, round(pts * 1.55))))


def assign_risk(records: list[dict]) -> None:
    for r in records:
        r["risk_pct"] = compute_anketa_risk(r)
        r["zona"] = risk_zone(r["risk_pct"])


def section3_health_rows(stats: dict, n: int) -> list[tuple[str, str, int]]:
    """3-bo'lim: kasallik emas, sog'liq ko'rsatkichlari."""
    return [
        ("Sog'ligingizni qanday baholaysiz?", "Yaxshi", stats["sogliq_yaxshi"]),
        ("Sog'ligingizni qanday baholaysiz?", "O'rtacha", stats["sogliq_ort"]),
        ("Sog'ligingizni qanday baholaysiz?", "Yomon / Bilmayman", stats["sogliq_yomon"]),
        ("Muntazam tibbiy ko'rikdan o'tasizmi?", "Ha", stats.get("muntazam_korik", 0)),
        ("So'nggi 2 yilda profilaktik ko'rik", "Ha", stats["tibbiy_korik"]),
        ("So'nggi 6 oy: bosh og'rig'i", "Ha", stats.get("sym_bosh", 0)),
        ("So'nggi 6 oy: yurak urishi tezlashishi", "Ha", stats.get("sym_yurak", 0)),
        ("So'nggi 6 oy: nafas qisishi", "Ha", stats.get("sym_nafas", 0)),
        ("So'nggi 6 oy: bel/bo'g'im og'riqlari", "Ha", stats.get("sym_bel", 0)),
        ("So'nggi 6 oy: tez charchash", "Ha", stats.get("sym_charchash", 0)),
        ("Ish faoliyati salomatlikka salbiy ta'sir", "Ha / Qisman", stats["salbiy_tasir"]),
        ("Mehnatga layoqatsizlik ta'tili (2+ marta/yil)", "Ha", stats["tatil_kop"]),
    ]


def enrich_health_stats(records: list[dict], stats: dict) -> dict:
    from generate_anketa_tahlili_docx import ans_contains, ans_eq

    stats["muntazam_korik"] = count_if(records, lambda r: ans_eq(r, "37", "Ha"))
    stats["sym_bosh"] = count_if(records, lambda r: ans_contains(r, "42", "Bosh og'rig'i"))
    stats["sym_yurak"] = count_if(records, lambda r: ans_contains(r, "42", "Yurak urish"))
    stats["sym_nafas"] = count_if(records, lambda r: ans_contains(r, "42", "Nafas qisishi"))
    stats["sym_bel"] = count_if(records, lambda r: ans_contains(r, "42", "Bel yoki bo'g'im"))
    stats["sym_charchash"] = count_if(records, lambda r: ans_contains(r, "42", "Tez charchash"))
    stats["sym_yoq"] = count_if(records, lambda r: ans_contains(r, "42", "Kuzatilmagan"))
    return stats


def risk_summary(records: list[dict]) -> dict:
    n = len(records)
    zones = {"yashil": 0, "sariq": 0, "qizil": 0}
    for r in records:
        zones[r["zona"]] += 1
    by_sex: dict[str, dict] = defaultdict(lambda: {"yashil": 0, "sariq": 0, "qizil": 0, "n": 0})
    for r in records:
        by_sex[r["sex"]][r["zona"]] += 1
        by_sex[r["sex"]]["n"] += 1
    return {"n": n, "zones": zones, "by_sex": dict(by_sex), "avg_risk": round(sum(r["risk_pct"] for r in records) / n, 1)}


def bolim_tables(stats: dict, n: int) -> dict[str, list[tuple[str, str, int]]]:
    """Har bo'lim uchun jadval qatorlari."""
    return {
        "1-bo'lim. Umumiy ma'lumotlar": [
            ("Jins", "Erkak", stats["erkak"]),
            ("Jins", "Ayol", stats["ayol"]),
            ("Oilaviy holat", "Turmush qurgan", stats["turmush"]),
            ("Oilaviy holat", "Turmush qurmagan", stats["turmush_no"]),
            ("Ma'lumot darajasi", "Oliy", stats["oliy"]),
            ("Ma'lumot darajasi", "Kasb-hunar / o'rta", stats["kasb_hunar"]),
            ("Sex (bo'lim)", "Qozonxona", stats["sex_qozon"]),
            ("Sex (bo'lim)", "Turbinalar", stats["sex_turbina"]),
            ("Sex (bo'lim)", "Elektr / SKT", stats["sex_elektr"]),
            ("Ish staji", "5 yildan kam / 2-4 yil", stats["staj_short"]),
            ("Ish staji", "5-14 yil", stats["staj_mid"]),
            ("Ish staji", "15 yil va undan ko'p", stats["staj_long"]),
            ("Ish tartibi", "Smenali / tungi", stats["smenali"]),
            ("Ish tartibi", "Kunduzgi", stats["kunduzgi"]),
        ],
        "2-bo'lim. Mehnat sharoitlari": [
            ("Shovqin darajasi", "Yuqori", stats["shovqin_yuqori"]),
            ("Shovqin darajasi", "Past / o'rtacha", stats["shovqin_past"]),
            ("Yuqori harorat ta'siri", "Ha", stats["harorat_ha"]),
            ("ShHV dan foydalanish", "Doim", stats["shhv_doim"]),
            ("Tashvish omili: chang / mikroiqlim", "Ha", stats["omil_chang"]),
            ("Tashvish omili: shovqin", "Ha", stats["omil_shovqin"]),
            ("Tashvish omili: tik turish / jismoniy zo'riqish", "Ha", stats["omil_tik"]),
            ("Ishdan qoniqish", "Qoniqaman", stats["qoniq_yaxshi"]),
            ("Jismoniy charchoq (4 hafta)", "Doim / ko'pincha", stats["charchoq_kop"]),
            ("Asabiylashish (4 hafta)", "Doim / ko'pincha", stats["asabiylik_kop"]),
            ("Tik oyoqda ishlash (6-8 soat)", "Ha", stats["tik_uzun"]),
            ("Uyqu buzilishlari", "Ha", stats["uyqu_buz"]),
            ("Ish vaqtida yurak/bosh aylanishi", "Ha / ba'zan", stats["yurak_simptom"]),
            ("Doimiy xavotir / qo'rquv", "Ha / ba'zan", stats["xavotir"]),
            ("Kunlik suyuqlik (kam)", "≤1,8 litr", stats["suv_kam"]),
        ],
        "3-bo'lim. Jismoniy salomatlik": section3_health_rows(stats, n),
        "4-bo'lim. Hayot tarzi": [
            ("Tamaki chekish", "Hozirda chekaman", stats["chekadi"]),
            ("Tamaki chekish", "Chekmaydi", stats["chekmaydi"]),
            ("Jismoniy mashq / sport", "Ha", stats["sport_ha"]),
            ("Jismoniy mashq / sport", "Yo'q", stats["sport_yoq"]),
            ("Sport qilmaslik sababi: vaqt yo'q", "Ha", stats["sport_vaqt"]),
            ("Sport qilmaslik sababi: iroda / ehtiyoj", "Ha", stats["sport_iroda"]),
        ],
        "5-bo'lim. Tibbiy xizmat va psixologik holat": [
            ("Ish joyida tibbiy yordam", "Ha / qisman", stats["tibbiy_yordam"]),
            ("Ish sharoitiga bog'liq kasallik aniqlangan", "Ha", stats["kasallik_aniq"]),
            ("Ish stressli deb hisoblanadi", "Ha / ba'zan", stats["stress"]),
            ("Sog'lom turmush tarzi imkoniyati", "Ha / qisman", stats["stt"]),
            ("Ishdan keyin dam olish vaqti", "Yetarli", stats["dam_yetarli"]),
            ("Ishdan keyin dam olish vaqti", "Yetmaydi", stats["dam_yetmaydi"]),
            ("Axborot manbai: tibbiyot xodimlari", "Ha", stats["axborot_tibbiyot"]),
        ],
        "6-bo'lim. Ovqatlanish": [
            ("Ish kunlari ovqatlanish", "Uydan olib kelaman", stats["ovqat_uy"]),
            ("Ish kunlari ovqatlanish", "Oshxona / kafe", stats["ovqat_oshxona"]),
            ("Kafega bormaslik sababi", "Narx / sifat", stats["kafe_sabab"]),
            ("Kuniga ovqatlanish", "3 marta va undan ko'p", stats["ovqat_3"]),
            ("Sut mahsulotlari", "Har kuni / haftada", stats["sut_ichadi"]),
            ("Meva va sabzavot", "Muntazam", stats["sabzavot"]),
            ("Non turi", "Oq non", stats["oq_non"]),
            ("Tayyor ovqatga tuz qo'shish", "Qo'shadi", stats["tuz"]),
            ("Kunlik suv iste'moli", "Yetarli", stats["suv_yetarli"]),
            ("Kunlik suv iste'moli", "Kam", stats["suv_kam_ovqat"]),
        ],
        "7-bo'lim. Takliflar": [
            ("Ventilyatsiya / changni kamaytirish", "Taklif", stats["tak_vent"]),
            ("Reglamentlangan tanaffuslar", "Taklif", stats["tak_tanaffus"]),
            ("Charchoqni bosish xonalari", "Taklif", stats["tak_charchoq"]),
            ("Mineral / tuzli suv ta'minoti", "Taklif", stats["tak_suv"]),
            ("Tibbiy ko'rik va sport tadbirlari", "Taklif", stats["tak_korik"]),
        ],
    }


def bolim_izohlar(stats: dict, risk: dict, n: int) -> dict[str, str]:
    z = risk["zones"]
    return {
        "1-bo'lim. Umumiy ma'lumotlar": (
            f"400 nafar tahlil guruhi xodimlarining {fmt_pct(stats['erkak'], n)} ini erkaklar tashkil etadi. "
            f"{fmt_pct(stats['smenali'], n)} smenali ish rejimida faoliyat yuritadi. "
            f"Qozonxona ({fmt_pct(stats['sex_qozon'], n)}) va turbina sexlari ({fmt_pct(stats['sex_turbina'], n)}) "
            "eng katta ulushga ega — mehnat sharoiti tahlili uchun muhim qatlam."
        ),
        "2-bo'lim. Mehnat sharoitlari": (
            f"Ish joyida yuqori harorat {fmt_pct(stats['harorat_ha'], n)} va yuqori shovqin {fmt_pct(stats['shovqin_yuqori'], n)} "
            f"deklaratsiya qilingan. {fmt_pct(stats['charchoq_kop'], n)} xodim tez-tez jismoniy charchoq, "
            f"{fmt_pct(stats['asabiylik_kop'], n)} asabiylashish belgilaydi. "
            "Bu omillar Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali tizimida kelajakdagi kasallanish xavfini oshiruvchi signallar sifatida hisobga olinadi."
        ),
        "3-bo'lim. Jismoniy salomatlik": (
            f"O'z salomatligini yaxshi deb baholaganlar {fmt_pct(stats['sogliq_yaxshi'], n)}, "
            f"o'rtacha — {fmt_pct(stats['sogliq_ort'], n)}. So'nggi 6 oyda bel/bo'g'im og'riqlari "
            f"{fmt_pct(stats.get('sym_bel', 0), n)}, tez charchash {fmt_pct(stats.get('sym_charchash', 0), n)} "
            f"ko'rsatilgan. Ish faoliyati salomatlikka salbiy ta'sir ko'rsatadi deb hisoblaydi — "
            f"{fmt_pct(stats['salbiy_tasir'], n)}. Bu bo'lim kasallik tasnifi emas, balki subyektiv va objektiv sog'liq belgilari tahlilidir."
        ),
        "4-bo'lim. Hayot tarzi": (
            f"Tamaki chekish {fmt_pct(stats['chekadi'], n)}. Jismoniy faoliyat past: sport bilan shug'ullanmaydi "
            f"{fmt_pct(stats['sport_yoq'], n)}. Asosiy sabab — vaqt va energiya yetishmasligi. "
            "Gipodinamiya va tamaki xavf prognozida sariq va qizil zonaga o'tish omillaridir."
        ),
        "5-bo'lim. Tibbiy xizmat va psixologik holat": (
            f"{fmt_pct(stats['stress'], n)} o'z ishini stressli deb baholaydi, "
            f"{fmt_pct(stats['dam_yetmaydi'], n)} ishidan keyin to'liq dam olish imkoniyati yo'qligini aytadi. "
            f"Tibbiy yordam yetarli deb hisoblaydi — {fmt_pct(stats['tibbiy_yordam'], n)}."
        ),
        "6-bo'lim. Ovqatlanish": (
            f"{fmt_pct(stats['ovqat_uy'], n)} uydan ovqat olib keladi. "
            f"Kunlik suv balansiga yetarlicha rioya qilmaydi — {fmt_pct(stats['suv_kam_ovqat'], n)}. "
            f"Oq non iste'moli {fmt_pct(stats['oq_non'], n)} — metabolik xavf omili."
        ),
        "7-bo'lim. Takliflar": (
            "Xodimlar eng ko'p ventilyatsiyani yaxshilash, reglamentlangan tanaffuslar, "
            "charchoqni bosish xonalari va mineral suv ta'minoti bo'yicha taklif berishgan. "
            "Bu takliflar profilaktik dastur uchun asos bo'lishi mumkin."
        ),
        "Xavf prognozi (Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali)": (
            f"Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali tizimi 75 savollik anketa asosida har bir xodim uchun kasallanish xavfini "
            f"erta baholaydi. 400 nafar namunada o'rtacha xavf balli {risk['avg_risk']}%. "
            f"Yashil zona (past xavf): {z['yashil']} nafar ({fmt_pct(z['yashil'], n)}) — kelajakda kasallanish ehtimoli past. "
            f"Sariq zona (o'rtacha): {z['sariq']} nafar ({fmt_pct(z['sariq'], n)}) — profilaktik nazorat talab etiladi. "
            f"Qizil zona (yuqori): {z['qizil']} nafar ({fmt_pct(z['qizil'], n)}) — tezkor tibbiy ko'rik va "
            "intervensiya zarur. Tizim klinik tashxis o'rnini bosmaydi, faqat xavfni erta aniqlash uchun mo'ljallangan."
        ),
    }


def make_diagrams(tables: dict[str, list], risk: dict, out_dir: Path) -> list[dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    meta = []
    n = risk["n"]

    chart_specs = [
        ("1-bo'lim. Umumiy ma'lumotlar", "01_bolim_umumiy.png", "bar", 0),
        ("2-bo'lim. Mehnat sharoitlari", "02_bolim_mehnat.png", "bar", 0),
        ("3-bo'lim. Jismoniy salomatlik", "03_bolim_jismoniy.png", "bar", 0),
        ("4-bo'lim. Hayot tarzi", "04_bolim_hayot.png", "pie", 2),
        ("5-bo'lim. Tibbiy xizmat va psixologik holat", "05_bolim_tibbiy.png", "bar", 0),
        ("6-bo'lim. Ovqatlanish", "06_bolim_ovqat.png", "bar", 0),
        ("7-bo'lim. Takliflar", "07_bolim_taklif.png", "bar", 0),
    ]

    for title, fname, kind, idx in chart_specs:
        rows = tables[title]
        if kind == "pie" and len(rows) >= 2:
            labels = [rows[0][1][:25], rows[1][1][:25]]
            vals = [rows[0][2], rows[1][2]]
            fig, ax = plt.subplots(figsize=(7, 6))
            ax.pie(vals, labels=labels, autopct="%1.1f%%", colors=["#3b82f6", "#f97316"], startangle=90)
        else:
            top = sorted(rows, key=lambda x: -x[2])[:8]
            labels = [r[1][:28] for r in top]
            vals = [r[2] for r in top]
            fig, ax = plt.subplots(figsize=(10, 6))
            bars = ax.barh(range(len(labels)), vals, color="#2563eb")
            ax.set_yticks(range(len(labels)))
            ax.set_yticklabels(labels, fontsize=9)
            ax.invert_yaxis()
            for bar, v in zip(bars, vals):
                ax.text(bar.get_width() + 1, bar.get_y() + bar.get_height() / 2, f"{v} ({pct(v, n)}%)", va="center", fontsize=8)
        ax.set_title(f"{title} (N={n})", fontsize=12, fontweight="bold")
        path = out_dir / fname
        fig.savefig(path, dpi=150, bbox_inches="tight")
        plt.close()
        meta.append({"file": fname, "title": title, "path": path})

    # Xavf zonasi
    z = risk["zones"]
    fig, ax = plt.subplots(figsize=(8, 7))
    labels = ["Yashil\n(past xavf)", "Sariq\n(o'rtacha)", "Qizil\n(yuqori)"]
    vals = [z["yashil"], z["sariq"], z["qizil"]]
    colors = [RISK_COLORS["yashil"], RISK_COLORS["sariq"], RISK_COLORS["qizil"]]
    wedges, _, autotexts = ax.pie(vals, labels=labels, autopct="%1.1f%%", colors=colors, startangle=90, textprops={"fontsize": 10})
    for at, v in zip(autotexts, vals):
        at.set_text(f"{v}\n({pct(v, n)}%)")
    ax.set_title("Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali: kasallanish xavfi zonasi (N=400)", fontsize=13, fontweight="bold")
    p8 = out_dir / "08_xavf_zonasi.png"
    fig.savefig(p8, dpi=150, bbox_inches="tight")
    plt.close()
    meta.append({"file": "08_xavf_zonasi.png", "title": "Xavf zonasi", "path": p8})
    return meta


def write_excel(tables: dict, izohlar: dict, risk: dict, records: list[dict], out_path: Path) -> None:
    wb = Workbook()
    wb.remove(wb.active)
    n = risk["n"]

    ws0 = wb.create_sheet("IZOHLAR")
    ws0.append(["Anketa tahlili N=400 — har bo'lim izohi"])
    ws0.append([f"Jami anketa: {TOTAL_SURVEY} | Tahlil: {n} | Sana: {date.today().strftime('%d.%m.%Y')}"])
    ws0.append([])
    for k, v in izohlar.items():
        ws0.append([k, v])

    ws_r = wb.create_sheet("Xavf zonasi")
    ws_r.append(["Zona", "Rang", "n", "%", "95% CI", "Ma'nosi"])
    z = risk["zones"]
    for zona in ("yashil", "sariq", "qizil"):
        ws_r.append([zona.upper(), zona, z[zona], pct(z[zona], n), fmt_ci(z[zona], n), RISK_LABELS[zona]])
    ws_r.append([])
    ws_r.append(["O'rtacha xavf balli", risk["avg_risk"]])
    style_header(ws_r)

    for bolim, rows in tables.items():
        short = bolim.split(".")[0].replace("-bo'lim", "b")[:20]
        ws = wb.create_sheet(short)
        ws.append(["Savol / ko'rsatkich", "Variant", "n", "%", "95% CI"])
        for q, v, c in rows:
            ws.append([q, v, c, pct(c, n), fmt_ci(c, n)])
        style_header(ws)

    ws_l = wb.create_sheet("400 ro'yxat")
    ws_l.append(["№", "F.I.SH.", "Sex", "Kasb", "Jins", "Yosh", "Xavf %", "Zona", "Guruh"])
    for i, r in enumerate(records, 1):
        ws_l.append([i, r["ism"], r["sex"], r["kasb"], r["jins"], r["yosh"], r["risk_pct"], r["zona"], r["guruh"]])
    style_header(ws_l)
    wb.save(out_path)


def write_word(tables: dict, izohlar: dict, risk: dict, diagram_meta: list[dict], out_path: Path) -> None:
    doc = Document()
    n = risk["n"]
    z = risk["zones"]

    t = doc.add_heading("ANKETA TAHLILI — Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali", 0)
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph(
        f"Farg'ona Issiqlik Elektr Stansiyasi xodimlari so'rovnomasi tahlili | "
        f"Jami anketa: N={TOTAL_SURVEY} | Tahlil guruhi: n={n} | {date.today().strftime('%d.%m.%Y')}"
    ).alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph(
        "Mazkur hisobot kasalliklar tasnifi emas, balki 75 savollik anketa bo'limlari bo'yicha "
        "javoblar statistikasi va Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali tizimi orqali erta kasallanish xavfini "
        "baholash natijalarini aks ettiradi."
    )

    # Xavf bo'limi birinchi
    doc.add_heading("Xavf prognozi — yashil / sariq / qizil (Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali)", level=1)
    doc.add_paragraph(izohlar["Xavf prognozi (Noinfeksion kardiologik xavflarni prognozlash va monitoring qilish milliy-ilmiy ko'p rolli portali)"])

    tbl_r = doc.add_table(rows=4, cols=5)
    tbl_r.style = "Table Grid"
    hdr = tbl_r.rows[0].cells
    hdr[0].text, hdr[1].text, hdr[2].text, hdr[3].text, hdr[4].text = "Zona", "Rang", "n", "%", "95% CI"
    for i, zona in enumerate(("yashil", "sariq", "qizil"), 1):
        tbl_r.rows[i].cells[0].text = zona.upper()
        tbl_r.rows[i].cells[1].text = zona
        tbl_r.rows[i].cells[2].text = str(z[zona])
        tbl_r.rows[i].cells[3].text = fmt_pct(z[zona], n)
        tbl_r.rows[i].cells[4].text = fmt_ci(z[zona], n)

    dm_risk = next((d for d in diagram_meta if d["file"] == "08_xavf_zonasi.png"), None)
    if dm_risk and dm_risk["path"].exists():
        doc.add_paragraph("")
        doc.add_picture(str(dm_risk["path"]), width=Inches(5.5))

    doc.add_page_break()

    file_map = {d["title"]: d for d in diagram_meta}
    order = list(tables.keys())

    for bolim in order:
        doc.add_heading(bolim, level=1)
        doc.add_paragraph(izohlar.get(bolim, ""))

        rows = tables[bolim]
        tbl = doc.add_table(rows=len(rows) + 1, cols=5)
        tbl.style = "Table Grid"
        for j, h in enumerate(["Ko'rsatkich", "Variant", "n", "%", "95% CI"]):
            tbl.rows[0].cells[j].text = h
        for i, (q, v, c) in enumerate(rows, 1):
            tbl.rows[i].cells[0].text = q
            tbl.rows[i].cells[1].text = v
            tbl.rows[i].cells[2].text = str(c)
            tbl.rows[i].cells[3].text = fmt_pct(c, n)
            tbl.rows[i].cells[4].text = fmt_ci(c, n)

        dm = file_map.get(bolim)
        if dm and dm["path"].exists():
            doc.add_paragraph("")
            p = doc.add_paragraph()
            p.add_run("Diagramma: ").bold = True
            doc.add_picture(str(dm["path"]), width=Inches(5.8))

        doc.add_paragraph("")

    doc.save(out_path)


def update_template_tables(template: Path, out_path: Path, stats: dict, n: int) -> None:
    """Mavjud anketa tahlili.docx jadvallarini N=400 bilan yangilash (kasallik jadvali → sog'liq)."""
    from generate_anketa_tahlili_docx import set_cell, update_docx

    if not template.exists():
        return
    # update_docx expects diseases in stats — patch section 3 manually after copy
    stats_copy = dict(stats)
    stats_copy["diseases"] = [(i + 1, r[0], r[2]) for i, r in enumerate(section3_health_rows(stats, n)[:6])]
    update_docx(template, out_path, [], stats_copy)


def main() -> int:
    workers = pd.read_csv(WORKERS_CSV)
    excel_path = resolve_excel_path()
    excel = pd.read_excel(excel_path) if excel_path.exists() else pd.DataFrame()
    questionnaire = json.loads(QUESTIONS_JSON.read_text(encoding="utf-8"))
    all_records, sex_records = build_all_records(workers, excel, questionnaire)

    # 400 ta — barcha 698 dan stratifik tanlov (sex bo'yicha)
    sample = select_400(sex_records if len(sex_records) >= SAMPLE_SIZE else all_records)
    assign_groups(sample)
    assign_risk(sample)

    stats = compute_stats(sample)
    stats = enrich_health_stats(sample, stats)
    risk = risk_summary(sample)
    tables = bolim_tables(stats, len(sample))
    izohlar = bolim_izohlar(stats, risk, len(sample))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()
    diagram_meta = make_diagrams(tables, risk, DIAGRAM_DIR)

    xlsx = OUTPUT_DIR / f"Anketa_Tahlili_N400_{today}.xlsx"
    docx = OUTPUT_DIR / f"Anketa_Tahlili_N400_{today}.docx"
    write_excel(tables, izohlar, risk, sample, xlsx)
    write_word(tables, izohlar, risk, diagram_meta, docx)

    # Desktop nusxalar
    desk_xlsx = Path.home() / "Desktop" / xlsx.name
    desk_docx = Path.home() / "Desktop" / docx.name
    shutil.copy2(xlsx, desk_xlsx)
    shutil.copy2(docx, desk_docx)

    diag_desk = Path.home() / "Desktop" / f"diagrammalar_anketa_N400_{today}"
    if diag_desk.exists():
        shutil.rmtree(diag_desk)
    shutil.copytree(DIAGRAM_DIR, diag_desk)

    z = risk["zones"]
    n = len(sample)
    print(f"Tayyor: {docx}")
    print(f"Excel: {xlsx}")
    print(f"Diagrammalar: {DIAGRAM_DIR}")
    print(f"N={n} | Yashil: {z['yashil']} ({pct(z['yashil'], n)}%) | Sariq: {z['sariq']} ({pct(z['sariq'], n)}%) | Qizil: {z['qizil']} ({pct(z['qizil'], n)}%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
