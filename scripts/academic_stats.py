#!/usr/bin/env python3
"""Ilmiy ish uchun statistik ko'rsatkichlar: 95% CI, chi-kvadrat, OR, Cronbach alpha."""

from __future__ import annotations

import math
from typing import Callable, Iterable, Sequence

Z_95 = 1.96


def pct(part: float, whole: float, digits: int = 1) -> float:
    if whole <= 0:
        return 0.0
    return round(part / whole * 100, digits)


def se_proportion(p: float, n: int) -> float:
    if n <= 0:
        return 0.0
    return math.sqrt(max(p * (1 - p) / n, 0.0))


def ci_proportion(n_success: int, n_total: int, z: float = Z_95) -> tuple[float, float]:
    """Wald 95% CI for proportion (foizda)."""
    if n_total <= 0:
        return 0.0, 0.0
    p = n_success / n_total
    se = se_proportion(p, n_total)
    lo = max(0.0, (p - z * se) * 100)
    hi = min(100.0, (p + z * se) * 100)
    return round(lo, 1), round(hi, 1)


def fmt_ci(n_success: int, n_total: int) -> str:
    lo, hi = ci_proportion(n_success, n_total)
    return f"{lo}–{hi}"


def fmt_pct_ci(n_success: int, n_total: int) -> tuple[float, str]:
    return pct(n_success, n_total), fmt_ci(n_success, n_total)


def mean(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def std_dev(values: Sequence[float]) -> float:
    if len(values) < 2:
        return 0.0
    m = mean(values)
    return math.sqrt(sum((x - m) ** 2 for x in values) / (len(values) - 1))


def median(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    mid = len(s) // 2
    if len(s) % 2:
        return s[mid]
    return (s[mid - 1] + s[mid]) / 2


def quartiles(values: Sequence[float]) -> tuple[float, float]:
    if not values:
        return 0.0, 0.0
    s = sorted(values)
    n = len(s)

    def q(p: float) -> float:
        idx = p * (n - 1)
        lo = int(math.floor(idx))
        hi = min(lo + 1, n - 1)
        w = idx - lo
        return s[lo] * (1 - w) + s[hi] * w

    return round(q(0.25), 1), round(q(0.75), 1)


def ci_mean(values: Sequence[float], z: float = Z_95) -> tuple[float, float]:
    n = len(values)
    if n <= 0:
        return 0.0, 0.0
    m = mean(values)
    sd = std_dev(values)
    se = sd / math.sqrt(n) if n > 0 else 0.0
    return round(m - z * se, 2), round(m + z * se, 2)


def fmt_mean_sd(values: Sequence[float]) -> str:
    return f"{round(mean(values), 1)} ± {round(std_dev(values), 1)}"


def fmt_median_iqr(values: Sequence[float]) -> str:
    q1, q3 = quartiles(values)
    return f"{round(median(values), 1)} [{q1}; {q3}]"


def norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def chi2_p_value_1df(chi2: float) -> float:
    if chi2 <= 0:
        return 1.0
    z = math.sqrt(chi2)
    return max(0.0, min(1.0, 2 * (1 - norm_cdf(z))))


def chi_square_2x2(a: int, b: int, c: int, d: int) -> tuple[float, float, str]:
    """
    2×2 jadval:
      a | b
      c | d
    Yoki: guruh1+ / guruh1- / guruh2+ / guruh2-
    """
    n = a + b + c + d
    if n == 0:
        return 0.0, 1.0, "Fisher"
    row1, row2 = a + b, c + d
    col1, col2 = a + c, b + d
    if row1 == 0 or row2 == 0 or col1 == 0 or col2 == 0:
        return 0.0, 1.0, "Fisher"

    exp_a = row1 * col1 / n
    exp_b = row1 * col2 / n
    exp_c = row2 * col1 / n
    exp_d = row2 * col2 / n
    min_exp = min(exp_a, exp_b, exp_c, exp_d)

    if min_exp < 5:
        p = fisher_exact_2x2(a, b, c, d)
        chi2 = 0.0
        method = "Fisher"
    else:
        num = n * (a * d - b * c) ** 2
        den = row1 * row2 * col1 * col2
        chi2 = num / den if den else 0.0
        p = chi2_p_value_1df(chi2)
        method = "χ²"

    return round(chi2, 3), round(p, 4), method


def fisher_exact_2x2(a: int, b: int, c: int, d: int) -> float:
    """Fisher aniq mezon — kichik namunalar uchun."""
    n = a + b + c + d
    if n == 0:
        return 1.0

    def hypergeom(k: int, n1: int, n2: int, K: int) -> float:
        return math.comb(K, k) * math.comb(n - K, n1 - k) / math.comb(n, n1)

    row1 = a + b
    col1 = a + c
    p_obs = hypergeom(a, row1, n - row1, col1)
    p_sum = 0.0
    min_a = max(0, row1 - (n - col1))
    max_a = min(row1, col1)
    for k in range(min_a, max_a + 1):
        pk = hypergeom(k, row1, n - row1, col1)
        if pk <= p_obs + 1e-12:
            p_sum += pk
    return min(1.0, p_sum)


def odds_ratio_ci(a: int, b: int, c: int, d: int, z: float = Z_95) -> tuple[float, float, float]:
    """OR va 95% CI (continuity correction +0.5)."""
    a2, b2, c2, d2 = a + 0.5, b + 0.5, c + 0.5, d + 0.5
    or_val = (a2 * d2) / (b2 * c2) if b2 * c2 else float("inf")
    se = math.sqrt(1 / a2 + 1 / b2 + 1 / c2 + 1 / d2)
    log_or = math.log(or_val) if or_val > 0 else 0.0
    lo = math.exp(log_or - z * se)
    hi = math.exp(log_or + z * se)
    return round(or_val, 2), round(lo, 2), round(hi, 2)


def fmt_p(p: float) -> str:
    if p < 0.001:
        return "< 0.001"
    if p < 0.01:
        return "< 0.01"
    if p < 0.05:
        return "< 0.05"
    return f"> 0.05"


def compare_groups(
    records: list[dict],
    predicate: Callable[[dict], bool],
    group_key: Callable[[dict], str],
    groups: tuple[str, str] = ("erkak", "ayol"),
) -> dict:
    """Ikki guruh bo'yicha sifat ko'rsatkich taqqoslash."""
    g1, g2 = groups
    pos1 = sum(1 for r in records if group_key(r) == g1 and predicate(r))
    neg1 = sum(1 for r in records if group_key(r) == g1 and not predicate(r))
    pos2 = sum(1 for r in records if group_key(r) == g2 and predicate(r))
    neg2 = sum(1 for r in records if group_key(r) == g2 and not predicate(r))
    chi2, p, method = chi_square_2x2(pos1, neg1, pos2, neg2)
    or_val, or_lo, or_hi = odds_ratio_ci(pos1, neg1, pos2, neg2)
    return {
        "a": pos1,
        "b": neg1,
        "c": pos2,
        "d": neg2,
        "chi2": chi2,
        "p": p,
        "p_fmt": fmt_p(p),
        "method": method,
        "or": or_val,
        "or_ci": f"{or_lo}–{or_hi}",
    }


def mann_whitney_u(group1: Sequence[float], group2: Sequence[float]) -> tuple[float, float]:
    """Mann-Whitney U — normal approksimatsiya bilan p."""
    if not group1 or not group2:
        return 0.0, 1.0
    combined = [(v, 0) for v in group1] + [(v, 1) for v in group2]
    combined.sort(key=lambda x: x[0])
    ranks: list[float] = [0.0] * len(combined)
    i = 0
    while i < len(combined):
        j = i
        while j < len(combined) and combined[j][0] == combined[i][0]:
            j += 1
        avg_rank = (i + 1 + j) / 2
        for k in range(i, j):
            ranks[k] = avg_rank
        i = j
    r1 = sum(ranks[i] for i, (_, g) in enumerate(combined) if g == 0)
    n1, n2 = len(group1), len(group2)
    u1 = r1 - n1 * (n1 + 1) / 2
    u2 = n1 * n2 - u1
    u = min(u1, u2)
    mu = n1 * n2 / 2
    sigma = math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12)
    if sigma == 0:
        return round(u, 2), 1.0
    z = abs(u - mu) / sigma
    p = 2 * (1 - norm_cdf(z))
    return round(u, 2), round(max(0.0, min(1.0, p)), 4)


def cronbach_alpha(items: list[list[int]]) -> float:
    """items: har bir qator — bir respondent, ustunlar — Likert itemlari."""
    if not items or len(items[0]) < 2:
        return 0.0
    k = len(items[0])
    n = len(items)
    col_vars = []
    for j in range(k):
        col = [row[j] for row in items if len(row) > j]
        col_vars.append(std_dev(col) ** 2)
    totals = [sum(row) for row in items]
    var_total = std_dev(totals) ** 2
    if var_total == 0:
        return 0.0
    alpha = (k / (k - 1)) * (1 - sum(col_vars) / var_total)
    return round(max(0.0, min(1.0, alpha)), 3)


def academic_row(n_success: int, n_total: int, p_value: str | None = None) -> dict:
    p, ci = fmt_pct_ci(n_success, n_total)
    row = {"n": n_success, "pct": p, "ci": ci, "ci_fmt": f"{ci}%"}
    if p_value is not None:
        row["p"] = p_value
    return row
