# Coding Standards — Analytics Dashboard (React 19 + FastAPI + Supabase)

## 1. React Patterns

### State: React Query + Zustand (NOT useState for server data)
```tsx
// CORRECT — server data via React Query
const { data, isLoading, error } = useQuery({
  queryKey: ['stocks', dateFrom, dateTo],
  queryFn: () => api.getStocks(dateFrom, dateTo),
});

// CORRECT — UI state via Zustand
const { marketplace, setMarketplace } = useFiltersStore();

// WRONG — server data in useState
const [stocks, setStocks] = useState([]);
useEffect(() => { fetchStocks().then(setStocks); }, []);
```

### Loading States: enum pattern (NOT scattered booleans)
```tsx
// CORRECT
type LoadingState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

// WRONG
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState(null);
const [data, setData] = useState(null);
```

### Component Structure
```tsx
// 1. Types/interfaces
interface Props { ... }

// 2. Component
export default function StocksTable({ stocks, isLoading }: Props) {
  // 3. Hooks (all at top)
  const { marketplace } = useFiltersStore();

  // 4. Derived state (useMemo)
  const filtered = useMemo(() =>
    stocks.filter(s => s.marketplace === marketplace),
    [stocks, marketplace]
  );

  // 5. Handlers
  const handleSort = useCallback(() => { ... }, []);

  // 6. Early returns
  if (isLoading) return <LoadingSpinner />;
  if (!stocks.length) return <EmptyState />;

  // 7. Main render
  return ( ... );
}
```

### Rules
- Components > 200 lines → split into subcomponents
- NO `any` type — always explicit types
- Props via interface (NOT inline `{ data: any }`)
- `useMemo` for expensive computations, `useCallback` for handlers passed to children
- NO useEffect for data fetching — use React Query
- Format numbers: `formatCurrency(value)`, NOT `value.toFixed(2)`

## 2. TypeScript Patterns

### Types in `types/index.ts`
```tsx
// API response types match backend exactly
interface DashboardSummary {
  revenue: number;
  orders_count: number;
  returns_count: number;
  avg_check: number;
}

// Frontend-only types (extended)
interface ProductMetrics extends Product {
  drr?: number;          // calculated on frontend
  profitShare?: number;  // calculated on frontend
}
```

### Null Safety
```tsx
// CORRECT
const revenue = data?.revenue ?? 0;
const name = product?.name || 'Без названия';

// WRONG
const revenue = data!.revenue;
const name = product.name; // might be undefined
```

## 3. API Layer (`services/api.ts`)

### Request Pattern
```tsx
// All API calls go through api.ts
export const dashboardApi = {
  getSummary: (params: DateParams) =>
    apiClient.get<DashboardSummary>('/dashboard/summary', { params }),

  getCostsTree: (params: DateParams & { marketplace: string }) =>
    apiClient.get<CostsTreeResponse>('/dashboard/costs-tree', { params }),
};
```

### Error Handling
```tsx
// API interceptor handles 401 → refresh token
// Components handle errors via React Query
const { error } = useQuery({ ... });
if (error) return <ErrorMessage error={error} />;
```

## 4. FastAPI Backend

### Endpoint Pattern
```python
@router.get("/dashboard/summary")
async def get_summary(
    date_from: str = Query(...),
    date_to: str = Query(...),
    marketplace: str = Query("all"),
    user_id: str = Depends(get_current_user_id),  # ALWAYS auth
):
    # 1. Validate inputs
    # 2. Query Supabase (with user_id filter)
    # 3. Transform data
    # 4. Return response
```

### Supabase Queries: ALWAYS include user_id
```python
# CORRECT
result = supabase.table("mp_sales") \
    .select("*") \
    .eq("user_id", user_id) \
    .gte("date", date_from) \
    .execute()

# WRONG — RLS is safety net, NOT primary filter
result = supabase.table("mp_sales").select("*").execute()
```

### Error Handling
```python
from fastapi import HTTPException

# Specific errors
raise HTTPException(status_code=404, detail="Product not found")
raise HTTPException(status_code=403, detail="Feature requires Pro plan")

# NOT generic 500s
# raise HTTPException(status_code=500, detail="Error")
```

## 5. Tailwind CSS (v3)

### Responsive: mobile-first
```tsx
// CORRECT — mobile first, then larger screens
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

// WRONG — desktop first
<div className="grid grid-cols-4 md:grid-cols-2 sm:grid-cols-1">
```

### Color Palette
```
Primary:   indigo-600 (buttons, links, active states)
Success:   emerald-500 (profit, positive)
Danger:    red-500 (losses, errors, alerts)
Warning:   amber-500 (warnings, pending)
Neutral:   gray-50..900 (backgrounds, text, borders)
```

### Common Patterns
```tsx
// Card
<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">

// Stat tile
<div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl p-4">

// Table header
<th className="text-xs font-medium text-gray-500 uppercase tracking-wider">
```

## 6. Formulas (CRITICAL — must be exact)

```
// Dashboard
profit = total_payout - purchase_adjusted - ads_adjusted
purchase_adjusted = purchase × costsTreeRatio
costsTreeRatio = costs_tree_SALES / mp_sales_revenue  // NO credits!

// Revenue display
displayed_revenue = costs_tree_sales + credits  // СПП included

// UE (per product)
profit_i = total_payout × (revenue_i / Σrevenue) - purchase_i×ratio - ad_i×ratio

// Stock forecast
days_remaining = total_quantity / avg_daily_sales(30d)

// DRR
drr = ad_cost / revenue × 100%
```

## 7. File Naming
```
Components:  PascalCase.tsx     (StocksTable.tsx)
Pages:       PascalCase.tsx     (DashboardPage.tsx)
Hooks:       camelCase.ts       (useDashboard.ts)
Services:    camelCase.ts       (api.ts)
Types:       index.ts           (in types/)
Backend:     snake_case.py      (dashboard.py, sync_service.py)
Migrations:  NNN_description.sql (013_product_groups.sql)
```

## 8. Checklist (before commit)
- [ ] `npm run build` passes (NO `npm run dev`)
- [ ] No `any` types
- [ ] All API calls include user_id
- [ ] Numbers formatted via formatCurrency/formatPercent
- [ ] Mobile responsive (test at 375px width)
- [ ] No hardcoded strings (use constants)
- [ ] Architecture decisions from CLAUDE.md respected
- [ ] No console.log left in code
