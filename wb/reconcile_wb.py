#!/usr/bin/env python3
"""
WB reconciliation helper.

Goal:
  - Compute "ground truth" totals exactly as in WB LK export
    ("Еженедельный детализированный отчет ... .csv").
  - Optionally compare ("reconcile") with our API /dashboard/costs-tree?marketplace=wb.

Works without pandas; only Python stdlib.
This is a verification tool, NOT production code.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


def _rub_to_float(val: object) -> float:
    if val is None:
        return 0.0
    s = str(val).strip()
    if not s:
        return 0.0
    s = s.replace("₽", "").replace("\xa0", " ")
    s = s.replace(" ", "").replace(",", ".")
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    if not m:
        return 0.0
    return float(m.group(0))


def _read_csv_dicts(path: Path, delimiter: str = ";") -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        rdr = csv.DictReader(f, delimiter=delimiter)
        out: list[dict[str, str]] = []
        for r in rdr:
            if not r:
                continue
            out.append(r)
        return out


def _pick_latest(dir_path: Path, patterns: Iterable[str]) -> list[Path]:
    candidates: list[Path] = []
    for pat in patterns:
        candidates.extend(dir_path.glob(pat))
    # Deduplicate (multiple patterns can match same file, especially with unicode variations)
    uniq: dict[str, Path] = {}
    for p in candidates:
        if not p.is_file():
            continue
        rp = str(p.resolve())
        uniq[rp] = p
    out = list(uniq.values())
    out.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return out


def _fmt_rub(v: float) -> str:
    sign = "-" if v < 0 else ""
    x = abs(v)
    rub = int(x)
    kop = int(round((x - rub) * 100))
    rub_str = f"{rub:,}".replace(",", " ")
    return f"{sign}{rub_str}.{kop:02d} ₽"


def _call_costs_tree(api_base_url: str, date_from: str, date_to: str, marketplace: str = "wb") -> dict:
    base = api_base_url.rstrip("/")
    url = f"{base}/dashboard/costs-tree"
    qs = urllib.parse.urlencode({"date_from": date_from, "date_to": date_to, "marketplace": marketplace})
    full = f"{url}?{qs}"
    req = urllib.request.Request(full, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    return json.loads(data.decode("utf-8"))


def _extract_tree_totals(costs_tree_resp: dict) -> dict[str, float]:
    out: dict[str, float] = {}
    for item in costs_tree_resp.get("tree", []) or []:
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        out[name] = float(item.get("amount", 0) or 0)
    out["__total_accrued__"] = float(costs_tree_resp.get("total_accrued", 0) or 0)
    out["__total_revenue__"] = float(costs_tree_resp.get("total_revenue", 0) or 0)
    return out


@dataclass(frozen=True)
class LKTotals:
    sales_revenue: float
    sales_qty: int
    payout_total: float
    # Top-level tree categories (our API names for WB)
    by_category: dict[str, float]


CSV_COLS = {
    "doc_type": "Тип документа",
    "reason": "Обоснование для оплаты",
    "sale_date": "Дата продажи",
    "qty": "Кол-во",
    "wb_realized": "Вайлдберриз реализовал Товар (Пр)",
    "payout": "К перечислению Продавцу за реализованный Товар",
    "vv_fee": "Вознаграждение Вайлдберриз (ВВ), без НДС",
    "vv_vat": "НДС с Вознаграждения Вайлдберриз",
    "acquiring": "Эквайринг/Комиссии за организацию платежей",
    "delivery": "Услуги по доставке товара покупателю",
    "storage": "Хранение",
    "pvz_comp": "Возмещение за выдачу и возврат товаров на ПВЗ",
    "transport_reimb": "Возмещение издержек по перевозке/по складским операциям с товаром",
    "penalties": "Общая сумма штрафов",
    "vv_corr": "Корректировка Вознаграждения Вайлдберриз (ВВ)",
    "acceptance": "Операции на приемке",
    "deduction": "Удержания",
    "loyalty_comp": "Компенсация скидки по программе лояльности",
    "loyalty_cost": "Стоимость участия в программе лояльности",
    "loyalty_points_withheld": "Сумма удержанная за начисленные баллы программы лояльности",
    "payment_schedule": "Разовое изменение срока перечисления денежных средств",
}


def compute_from_wb_exports(csv_paths: list[Path], date_from: str, date_to: str) -> tuple[LKTotals, dict]:
    """
    Compute totals from WB detailed weekly export(s).
    date_from/date_to are inclusive (YYYY-MM-DD).
    """
    by_cat = defaultdict(float)
    debug = {"files": [str(p) for p in csv_paths], "date_from": date_from, "date_to": date_to}

    sales_revenue = 0.0
    sales_qty = 0
    payout_total = 0.0

    def in_range(d: str) -> bool:
        if not d or not re.match(r"^\d{4}-\d{2}-\d{2}$", d):
            return False
        return date_from <= d <= date_to

    for p in csv_paths:
        rows = _read_csv_dicts(p)
        for r in rows:
            sale_date = (r.get(CSV_COLS["sale_date"]) or "").strip()
            if not in_range(sale_date):
                continue

            doc = (r.get(CSV_COLS["doc_type"]) or "").strip()
            reason = (r.get(CSV_COLS["reason"]) or "").strip()

            # === Sales ===
            if doc == "Продажа" and reason == "Продажа":
                qty = int(_rub_to_float(r.get(CSV_COLS["qty"], "0")) or 0)
                if qty <= 0:
                    qty = 1
                sales_qty += qty
                sales_revenue += _rub_to_float(r.get(CSV_COLS["wb_realized"], "0"))
                payout_total += _rub_to_float(r.get(CSV_COLS["payout"], "0"))

            # === Credits (positive) ===
            pvz = _rub_to_float(r.get(CSV_COLS["pvz_comp"], "0"))
            if pvz:
                by_cat["Возмещения"] += pvz
            tr = _rub_to_float(r.get(CSV_COLS["transport_reimb"], "0"))
            if tr:
                by_cat["Возмещения"] += tr
            loy_comp = _rub_to_float(r.get(CSV_COLS["loyalty_comp"], "0"))
            if loy_comp:
                by_cat["Компенсация скидки по программе лояльности"] += loy_comp
            vv_corr = _rub_to_float(r.get(CSV_COLS["vv_corr"], "0"))
            if vv_corr:
                by_cat["Корректировка Вознаграждения Вайлдберриз (ВВ)"] += vv_corr
            pay_sched = _rub_to_float(r.get(CSV_COLS["payment_schedule"], "0"))
            if pay_sched:
                by_cat["Разовое изменение срока перечисления денежных средств"] += pay_sched

            # === Costs (negative in our tree semantics) ===
            vv_fee = _rub_to_float(r.get(CSV_COLS["vv_fee"], "0"))
            vv_vat = _rub_to_float(r.get(CSV_COLS["vv_vat"], "0"))
            # These are typically already negative in export; keep as-is.
            if vv_fee or vv_vat:
                by_cat["Вознаграждение Вайлдберриз (ВВ)"] += (vv_fee + vv_vat)

            acq = _rub_to_float(r.get(CSV_COLS["acquiring"], "0"))
            if acq:
                by_cat["Эквайринг/Комиссии за организацию платежей"] -= abs(acq)

            delivery = _rub_to_float(r.get(CSV_COLS["delivery"], "0"))
            if delivery:
                by_cat["Услуги по доставке товара покупателю"] -= abs(delivery)

            storage = _rub_to_float(r.get(CSV_COLS["storage"], "0"))
            if storage:
                by_cat["Стоимость хранения"] -= abs(storage)

            acceptance = _rub_to_float(r.get(CSV_COLS["acceptance"], "0"))
            if acceptance:
                by_cat["Стоимость операций при приемке"] -= abs(acceptance)

            penalties = _rub_to_float(r.get(CSV_COLS["penalties"], "0"))
            if penalties:
                by_cat["Общая сумма штрафов"] -= abs(penalties)

            deduction = _rub_to_float(r.get(CSV_COLS["deduction"], "0"))
            if deduction:
                by_cat["Прочие удержания/выплаты"] -= abs(deduction)

            loy_cost = _rub_to_float(r.get(CSV_COLS["loyalty_cost"], "0"))
            if loy_cost:
                by_cat["Стоимость участия в программе лояльности"] -= abs(loy_cost)

            loy_pts = _rub_to_float(r.get(CSV_COLS["loyalty_points_withheld"], "0"))
            if loy_pts:
                by_cat["Сумма удержанная за начисленные баллы программы лояльности"] -= abs(loy_pts)

    # Our top-level sales category (API): "Продажи"
    by_cat["Продажи"] += sales_revenue

    # Residual check vs payout (expected total accrued = payout_total)
    computed_total = sum(by_cat.values())
    residual = round(payout_total - computed_total, 2)
    debug["computed_total_vs_payout"] = {
        "computed_total": computed_total,
        "payout_total": payout_total,
        "residual": residual,
    }
    # If residual != 0, the export includes columns we didn't account for; treat residual as part of cabinet column.
    if abs(residual) >= 0.01:
        by_cat["Прочие удержания/выплаты"] += residual
        debug["residual_applied_to"] = "Прочие удержания/выплаты"

    totals = LKTotals(
        sales_revenue=round(sales_revenue, 2),
        sales_qty=sales_qty,
        payout_total=round(payout_total, 2),
        by_category={k: round(v, 2) for k, v in by_cat.items() if abs(v) >= 0.01},
    )
    return totals, debug


def main() -> int:
    parser = argparse.ArgumentParser(description="Compute WB LK totals from CSV and optionally reconcile with our API.")
    parser.add_argument("--dir", default=str(Path(__file__).resolve().parent), help="Directory with WB CSV exports (default: wb/).")
    parser.add_argument("--csv", action="append", default=[], help="Path(s) to WB weekly detailed CSV (optional, repeatable).")
    parser.add_argument("--date-from", required=True, help="YYYY-MM-DD (inclusive).")
    parser.add_argument("--date-to", required=True, help="YYYY-MM-DD (inclusive).")
    parser.add_argument(
        "--api-base-url",
        default=os.environ.get("VITE_API_URL", "http://localhost:8000/api/v1"),
        help="Backend API base URL (default: env VITE_API_URL or http://localhost:8000/api/v1).",
    )
    parser.add_argument("--reconcile-api", action="store_true", help="Also call /dashboard/costs-tree and print diff vs LK totals.")
    parser.add_argument("--json", action="store_true", help="Output machine-readable JSON to stdout.")
    args = parser.parse_args()

    dir_path = Path(args.dir).resolve()
    if not dir_path.exists():
        print(f"[ERROR] Directory not found: {dir_path}", file=sys.stderr)
        return 2

    csv_paths: list[Path] = [Path(p).resolve() for p in args.csv] if args.csv else []
    if not csv_paths:
        # Pick ALL matching exports (there can be multiple weekly reports covering the requested period).
        # On macOS file names may be saved with different unicode (й vs й), so match more loosely.
        csv_paths = _pick_latest(dir_path, ["Еженедельн*детализированн*отчет*.csv", "Еженедельн*детализированн*отч*т*.csv"])
        if not csv_paths:
            print("[ERROR] WB CSV not found. Provide --csv or put exports in wb/ directory.", file=sys.stderr)
            return 2

    lk_totals, debug = compute_from_wb_exports(csv_paths, args.date_from, args.date_to)

    output: dict = {
        "lk": {
            "period": {"from": args.date_from, "to": args.date_to},
            "sales_revenue": lk_totals.sales_revenue,
            "sales_qty": lk_totals.sales_qty,
            "payout_total": lk_totals.payout_total,
            "by_category": lk_totals.by_category,
        },
        "debug": debug,
    }

    if args.reconcile_api:
        resp = _call_costs_tree(args.api_base_url, args.date_from, args.date_to, marketplace="wb")
        api_tree = _extract_tree_totals(resp)

        expected = dict(lk_totals.by_category)
        expected["__total_accrued__"] = lk_totals.payout_total

        diff = {}
        for k, exp in expected.items():
            got = api_tree.get(k)
            diff[k] = {"expected": exp, "got": got, "diff": None if got is None else round(float(got) - float(exp), 2)}

        output["api"] = {
            "request": {
                "api_base_url": args.api_base_url,
                "date_from": args.date_from,
                "date_to": args.date_to,
                "marketplace": "wb",
            },
            "tree_totals": api_tree,
            "diff": diff,
            "raw_response": resp,
        }

    if args.json:
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return 0

    print("=== LK totals from WB weekly detailed export ===")
    print("Выручка (WB реализовал):", _fmt_rub(lk_totals.sales_revenue))
    print("Выкупы (qty):", lk_totals.sales_qty)
    print("К перечислению:", _fmt_rub(lk_totals.payout_total))
    print("\n=== By category (expected for API tree) ===")
    for k, v in sorted(lk_totals.by_category.items(), key=lambda kv: kv[0]):
        print(f"- {k}: {_fmt_rub(v)}")

    if abs(debug.get("computed_total_vs_payout", {}).get("residual", 0.0)) >= 0.01:
        print("\n[WARN] Residual vs payout was non-zero; applied to 'Прочие удержания/выплаты'.", file=sys.stderr)

    if args.reconcile_api:
        print("\n=== Reconcile with API /dashboard/costs-tree ===")
        api = output.get("api", {})
        diffs = (api.get("diff") or {})
        for k in sorted(diffs.keys()):
            d = diffs[k]
            got = d.get("got")
            exp = d.get("expected")
            delta = d.get("diff")
            if got is None:
                print(f"- {k}: expected {_fmt_rub(float(exp))}; got: MISSING")
            else:
                print(f"- {k}: expected {_fmt_rub(float(exp))}; got {_fmt_rub(float(got))}; diff {_fmt_rub(float(delta))}")

    print("\nFiles used:")
    for p in csv_paths:
        print("  -", str(p))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

