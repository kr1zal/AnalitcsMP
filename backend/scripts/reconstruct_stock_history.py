"""
One-time script: reconstruct historical stock levels from sales data.

Logic: work backwards from current stock using daily order counts.
  stock[day] = stock[day+1] + orders[day+1]
  (selling reduces stock, so going backwards adds it back)

Caveats:
- Does not account for restocks (stock may appear higher than reality)
- Clamps to 0 if stock goes negative (indicates a restock happened)
- Only fills dates NOT already in mp_stock_snapshots (preserves real data)

Usage:
  cd backend && source venv/bin/activate
  python scripts/reconstruct_stock_history.py
"""
import psycopg2
from datetime import date, timedelta
from collections import defaultdict

# Supabase connection
DB_CONFIG = {
    "host": "aws-1-eu-west-1.pooler.supabase.com",
    "port": 5432,
    "dbname": "postgres",
    "user": "postgres.xpushkwswfbkdkbmghux",
    "password": "Sdaaj!@33jcLj23",
}

USER_ID = "b990572c-acc2-4922-ad15-7ea8bfb88353"


def main():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    # 1. Get current stocks per product × marketplace
    cur.execute("""
        SELECT product_id, marketplace, SUM(quantity)
        FROM mp_stocks
        WHERE user_id = %s
        GROUP BY product_id, marketplace
    """, (USER_ID,))
    current_stocks: dict[tuple[str, str], int] = {}
    for pid, mp, qty in cur.fetchall():
        current_stocks[(pid, mp)] = qty
    print(f"Current stocks: {len(current_stocks)} product×MP combos")

    # 2. Get daily sales per product × marketplace × date
    cur.execute("""
        SELECT product_id, marketplace, date, SUM(orders_count) as daily_orders
        FROM mp_sales
        WHERE user_id = %s
        GROUP BY product_id, marketplace, date
        ORDER BY date
    """, (USER_ID,))
    # sales[(pid, mp)][date] = orders_count
    sales: dict[tuple[str, str], dict[date, int]] = defaultdict(dict)
    min_date = None
    max_date = None
    for pid, mp, d, orders in cur.fetchall():
        sales[(pid, mp)][d] = orders
        if min_date is None or d < min_date:
            min_date = d
        if max_date is None or d > max_date:
            max_date = d
    print(f"Sales data: {min_date} → {max_date}")

    if not min_date or not max_date:
        print("No sales data found!")
        return

    # 3. Get existing snapshot dates (to avoid overwriting)
    cur.execute("""
        SELECT DISTINCT date FROM mp_stock_snapshots
        WHERE user_id = %s
    """, (USER_ID,))
    existing_dates = {row[0] for row in cur.fetchall()}
    print(f"Existing snapshot dates: {sorted(existing_dates)}")

    # 4. Reconstruct: from today backwards
    today = date.today()
    total_inserted = 0

    for (pid, mp), current_qty in current_stocks.items():
        # Build daily stock levels going backwards
        stock_levels: dict[date, int] = {}
        stock = current_qty

        # Start from today, go backwards day by day
        d = today
        while d >= min_date:
            stock_levels[d] = max(0, stock)

            # Going backwards: add back the orders from this day
            # (because those orders reduced the stock)
            daily_orders = sales.get((pid, mp), {}).get(d, 0)
            stock += daily_orders

            d -= timedelta(days=1)

        # 5. Insert into mp_stock_snapshots (only for dates not already present)
        for d, qty in stock_levels.items():
            if d in existing_dates:
                continue  # Don't overwrite real data
            if d > max_date:
                continue  # Don't insert future dates beyond sales data

            cur.execute("""
                INSERT INTO mp_stock_snapshots (user_id, product_id, marketplace, date, total_quantity)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (user_id, product_id, marketplace, date) DO NOTHING
            """, (USER_ID, pid, mp, d, qty))
            total_inserted += 1

    conn.commit()

    # 6. Verify
    cur.execute("""
        SELECT COUNT(*), MIN(date), MAX(date)
        FROM mp_stock_snapshots
        WHERE user_id = %s
    """, (USER_ID,))
    count, mn, mx = cur.fetchone()
    print(f"\nInserted: {total_inserted} new snapshots")
    print(f"Total snapshots: {count} rows, {mn} → {mx}")

    conn.close()


if __name__ == "__main__":
    main()
