#!/usr/bin/env python3
"""
Ozon accruals reconciliation helper.

Goal:
  - Compute "ground truth" totals exactly as in Ozon LK widget "Начислено за период"
    using exported CSV reports.
  - Optionally compare ("reconcile") with our API /dashboard/costs-tree.

Works without pandas; only Python stdlib.

Author intent:
  This is NOT production code. It's a verification tool to keep numbers correct.
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
from typing import Callable, Iterable


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


def _read_csv_rows(path: Path, delimiter: str = ";") -> list[list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.reader(f, delimiter=delimiter))


def _find_header_row(rows: list[list[str]], predicate: Callable[[list[str]], bool]) -> int:
    for i, row in enumerate(rows):
        if predicate(row):
            return i
    raise ValueError("Header row not found (unexpected CSV format/columns).")


def _rows_as_dicts(rows: list[list[str]], header_idx: int) -> tuple[list[str], list[dict[str, str]]]:
    header = rows[header_idx]
    data = []
    for r in rows[header_idx + 1 :]:
        if not any((c or "").strip() for c in r):
            continue
        if len(r) < len(header):
            r = r + [""] * (len(header) - len(r))
        data.append({header[i]: r[i] for i in range(len(header))})
    return header, data


def _fmt_rub(v: float) -> str:
    # Keep 2 decimals, but show thin space grouping for readability.
    sign = "-" if v < 0 else ""
    x = abs(v)
    rub = int(x)
    kop = int(round((x - rub) * 100))
    rub_str = f"{rub:,}".replace(",", " ")
    return f"{sign}{rub_str}.{kop:02d} ₽"


@dataclass(frozen=True)
class LKTotals:
    # Sales components
    revenue: float
    discount_points: float
    partner_programs: float
    returns: float
    sales_total: float
    # Costs groups
    ozon_reward: float
    delivery_services: float
    agent_services: float
    fbo_services: float
    promo_ads: float
    costs_total: float
    # Final
    total_accrued: float


def compute_from_accruals_report(accruals_csv: Path) -> tuple[LKTotals, dict]:
    """
    Source: "Отчет по начислениям_...csv"
    Columns we rely on (by name):
      - Группа услуг
      - Тип начисления
      - Сумма итого, руб.
    """
    raw = _read_csv_rows(accruals_csv)
    header_idx = _find_header_row(
        raw,
        lambda row: any("Группа услуг" == (c or "").strip() for c in row)
        and any("Тип начисления" == (c or "").strip() for c in row)
        and any("Сумма итого" in (c or "") for c in row),
    )
    header, rows = _rows_as_dicts(raw, header_idx)

    amount_col = next(c for c in header if "Сумма итого" in c)
    group_col = "Группа услуг"
    type_col = "Тип начисления"

    by_group = defaultdict(float)
    by_group_type = defaultdict(float)

    for r in rows:
        grp = (r.get(group_col) or "").strip() or "(empty)"
        typ = (r.get(type_col) or "").strip() or "(empty)"
        amt = _rub_to_float(r.get(amount_col, ""))
        by_group[grp] += amt
        by_group_type[(grp, typ)] += amt

    sales_revenue = by_group_type.get(("Продажи", "Выручка"), 0.0)
    sales_discount = by_group_type.get(("Продажи", "Баллы за скидки"), 0.0)
    sales_partner = by_group_type.get(("Продажи", "Программы партнёров"), 0.0)
    returns = by_group.get("Возвраты", 0.0)
    sales_total = by_group.get("Продажи", 0.0) + returns

    ozon_reward = by_group.get("Вознаграждение Ozon", 0.0)
    delivery = by_group.get("Услуги доставки", 0.0)
    agents = by_group.get("Услуги агентов", 0.0)
    fbo = by_group.get("Услуги FBO", 0.0)
    promo = by_group.get("Продвижение и реклама", 0.0)

    costs_total = ozon_reward + delivery + agents + fbo + promo
    total_accrued = sales_total + costs_total

    totals = LKTotals(
        revenue=sales_revenue,
        discount_points=sales_discount,
        partner_programs=sales_partner,
        returns=returns,
        sales_total=sales_total,
        ozon_reward=ozon_reward,
        delivery_services=delivery,
        agent_services=agents,
        fbo_services=fbo,
        promo_ads=promo,
        costs_total=costs_total,
        total_accrued=total_accrued,
    )

    debug = {
        "by_group": dict(by_group),
        "by_group_type": {f"{k[0]}|{k[1]}": v for k, v in by_group_type.items()},
        "meta": {
            "file": str(accruals_csv),
            "header_row": header_idx + 1,
            "amount_col": amount_col,
        },
    }
    return totals, debug


def compute_from_items_report(items_csv: Path) -> tuple[float, dict[str, float], dict]:
    """
    Source: "Отчет по товарам за период ...csv"
    We use:
      - Тип начисления
      - Итого, руб.
    """
    raw = _read_csv_rows(items_csv)
    header_idx = _find_header_row(
        raw,
        lambda row: any("Тип начисления" == (c or "").strip() for c in row)
        and any("Итого" in (c or "") for c in row),
    )
    header, rows = _rows_as_dicts(raw, header_idx)

    type_col = "Тип начисления"
    total_col = next(c for c in header if (c or "").strip().startswith("Итого"))

    by_type = defaultdict(float)
    grand = 0.0
    for r in rows:
        typ = (r.get(type_col) or "").strip() or "(empty)"
        amt = _rub_to_float(r.get(total_col, ""))
        by_type[typ] += amt
        grand += amt

    debug = {
        "meta": {
            "file": str(items_csv),
            "header_row": header_idx + 1,
            "total_col": total_col,
        }
    }
    return grand, dict(by_type), debug


def _pick_latest(dir_path: Path, patterns: Iterable[str]) -> Path | None:
    candidates: list[Path] = []
    for pat in patterns:
        candidates.extend(dir_path.glob(pat))
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


def _call_costs_tree(api_base_url: str, date_from: str, date_to: str, marketplace: str = "ozon") -> dict:
    # api_base_url expected like: http://localhost:8000/api/v1
    base = api_base_url.rstrip("/")
    url = f"{base}/dashboard/costs-tree"
    qs = urllib.parse.urlencode(
        {
            "date_from": date_from,
            "date_to": date_to,
            "marketplace": marketplace,
        }
    )
    full = f"{url}?{qs}"
    req = urllib.request.Request(full, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    return json.loads(data.decode("utf-8"))


def _extract_tree_totals(costs_tree_resp: dict) -> dict[str, float]:
    # Response shape: { total_accrued, tree: [{name, amount, children:[{name, amount}]}] }
    out = {}
    for item in costs_tree_resp.get("tree", []) or []:
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        out[name] = float(item.get("amount", 0) or 0)
    out["__total_accrued__"] = float(costs_tree_resp.get("total_accrued", 0) or 0)
    out["__total_revenue__"] = float(costs_tree_resp.get("total_revenue", 0) or 0)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compute Ozon LK totals from CSV and optionally reconcile with our API."
    )
    parser.add_argument(
        "--dir",
        default=str(Path(__file__).resolve().parent),
        help="Directory with CSV exports (default: directory of this script).",
    )
    parser.add_argument("--accruals", default="", help="Path to 'Отчет по начислениям...' CSV (optional).")
    parser.add_argument("--items", default="", help="Path to 'Отчет по товарам за период...' CSV (optional).")
    parser.add_argument("--date-from", default="", help="YYYY-MM-DD (for API reconcile).")
    parser.add_argument("--date-to", default="", help="YYYY-MM-DD (for API reconcile).")
    parser.add_argument(
        "--api-base-url",
        default=os.environ.get("VITE_API_URL", "http://localhost:8000/api/v1"),
        help="Backend API base URL (default: env VITE_API_URL or http://localhost:8000/api/v1).",
    )
    parser.add_argument(
        "--reconcile-api",
        action="store_true",
        help="Also call /dashboard/costs-tree and print diff vs LK totals.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output machine-readable JSON to stdout.",
    )
    args = parser.parse_args()

    dir_path = Path(args.dir).resolve()
    if not dir_path.exists():
        print(f"[ERROR] Directory not found: {dir_path}", file=sys.stderr)
        return 2

    accruals_path = Path(args.accruals).resolve() if args.accruals else None
    items_path = Path(args.items).resolve() if args.items else None

    if not accruals_path:
        accruals_path = _pick_latest(dir_path, ["Отчет по начислениям*.csv", "Отчет по начислениям*.*.csv"])
    if not items_path:
        items_path = _pick_latest(dir_path, ["Отчет по товарам за период*.csv", "Отчет по товарам*.csv"])

    if not accruals_path or not accruals_path.exists():
        print("[ERROR] Accruals CSV not found. Provide --accruals or put it in --dir.", file=sys.stderr)
        return 2
    if not items_path or not items_path.exists():
        print("[ERROR] Items CSV not found. Provide --items or put it in --dir.", file=sys.stderr)
        return 2

    lk_totals, accr_debug = compute_from_accruals_report(accruals_path)
    items_grand, items_by_type, items_debug = compute_from_items_report(items_path)

    output = {
        "lk": {
            "period_hint": {"date_from": args.date_from or None, "date_to": args.date_to or None},
            "sales": {
                "total": lk_totals.sales_total,
                "revenue": lk_totals.revenue,
                "discount_points": lk_totals.discount_points,
                "partner_programs": lk_totals.partner_programs,
                "returns": lk_totals.returns,
            },
            "costs": {
                "total": lk_totals.costs_total,
                "ozon_reward": lk_totals.ozon_reward,
                "delivery_services": lk_totals.delivery_services,
                "agent_services": lk_totals.agent_services,
                "fbo_services": lk_totals.fbo_services,
                "promo_ads": lk_totals.promo_ads,
            },
            "total_accrued": lk_totals.total_accrued,
        },
        "items_report": {
            "grand_total": items_grand,
            "by_type": items_by_type,
        },
        "debug": {
            "accruals_report": accr_debug,
            "items_report": items_debug,
        },
    }

    # Offline sanity check between 2 CSV sources
    output["sanity"] = {
        "items_vs_accruals_total_diff": round(items_grand - lk_totals.total_accrued, 2),
        "items_vs_accruals_total_match": round(items_grand - lk_totals.total_accrued, 2) == 0.0,
    }

    api_diff = None
    api_tree = None
    if args.reconcile_api:
        if not args.date_from or not args.date_to:
            print("[ERROR] --reconcile-api requires --date-from and --date-to.", file=sys.stderr)
            return 2

        resp = _call_costs_tree(args.api_base_url, args.date_from, args.date_to, marketplace="ozon")
        api_tree = _extract_tree_totals(resp)

        # Expected mapping to our API category names (top-level)
        expected = {
            "Продажи": lk_totals.sales_total,
            "Вознаграждение Ozon": lk_totals.ozon_reward,
            "Услуги доставки": lk_totals.delivery_services,
            "Услуги агентов": lk_totals.agent_services,
            "Услуги FBO": lk_totals.fbo_services,
            "Продвижение и реклама": lk_totals.promo_ads,
            "__total_accrued__": lk_totals.total_accrued,
        }

        api_diff = {}
        for k, exp in expected.items():
            got = api_tree.get(k)
            api_diff[k] = {
                "expected": exp,
                "got": got,
                "diff": None if got is None else round(float(got) - float(exp), 2),
            }

        output["api"] = {
            "request": {
                "api_base_url": args.api_base_url,
                "date_from": args.date_from,
                "date_to": args.date_to,
                "marketplace": "ozon",
            },
            "tree_totals": api_tree,
            "diff": api_diff,
            "raw_response": resp,
        }

    if args.json:
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return 0

    # Human-readable output
    print("=== LK totals from 'Отчет по начислениям' ===")
    print("Sales & returns:", _fmt_rub(lk_totals.sales_total))
    print("  - Выручка:", _fmt_rub(lk_totals.revenue))
    print("  - Баллы за скидки:", _fmt_rub(lk_totals.discount_points))
    print("  - Программы партнёров:", _fmt_rub(lk_totals.partner_programs))
    print("  - Возвраты:", _fmt_rub(lk_totals.returns))
    print("Costs (accruals):", _fmt_rub(lk_totals.costs_total))
    print("  - Вознаграждение Ozon:", _fmt_rub(lk_totals.ozon_reward))
    print("  - Услуги доставки:", _fmt_rub(lk_totals.delivery_services))
    print("  - Услуги агентов:", _fmt_rub(lk_totals.agent_services))
    print("  - Услуги FBO:", _fmt_rub(lk_totals.fbo_services))
    print("  - Продвижение и реклама:", _fmt_rub(lk_totals.promo_ads))
    print("TOTAL accrued:", _fmt_rub(lk_totals.total_accrued))

    print("\n=== Sanity: 'Отчет по товарам' grand total ===")
    print("Items report total:", _fmt_rub(items_grand))
    diff = round(items_grand - lk_totals.total_accrued, 2)
    print("Diff (items - accruals):", _fmt_rub(diff))
    if diff != 0.0:
        print("[WARN] Totals do NOT match between two Ozon exports. Check report period/type.", file=sys.stderr)

    if args.reconcile_api:
        print("\n=== Reconcile with API /dashboard/costs-tree ===")
        assert api_tree is not None and api_diff is not None
        for k in ["Продажи", "Вознаграждение Ozon", "Услуги доставки", "Услуги агентов", "Услуги FBO", "Продвижение и реклама", "__total_accrued__"]:
            d = api_diff.get(k, {})
            got = d.get("got")
            exp = d.get("expected")
            delta = d.get("diff")
            if got is None:
                print(f"- {k}: expected {_fmt_rub(exp)}; got: MISSING")
            else:
                print(f"- {k}: expected {_fmt_rub(exp)}; got {_fmt_rub(float(got))}; diff {_fmt_rub(float(delta))}")

        # Helpful hint: if percent mismatch is a concern, print denominator
        if "__total_revenue__" in api_tree:
            print("\nAPI total_revenue (denominator for % in API):", _fmt_rub(api_tree["__total_revenue__"]))

    print("\nFiles used:")
    print("  - accruals:", str(accruals_path))
    print("  - items:", str(items_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

