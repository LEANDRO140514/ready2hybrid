# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/ready2hybrid/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.
>
> Generated with UI/UX Pro Max (`uipro` 2.15.0, `--design-system --persist`).
> The generator's pattern (Enterprise Gateway) and heading face (Fira Code) were rejected by the approved audit and are not part of this system.

**Project:** Ready2Hybrid
**Product:** HYBRID EVENT 2026 operations and finance control
**Approved:** 2026-09-24
**Category:** Data-dense financial operations interface
**Style:** Minimalism & Swiss
**Dials:** Variance 3/10 · Motion 2/10 · Density 9/10
**Theme:** Dark-first. WCAG AA.

This file is a specification. It does not change `src/`, roles, auth, APIs, or money rules.

---

## Rejected

Do not use Enterprise Gateway, a commercial hero, Contact Sales, Fira Code, a developer-tool look, or a generic blue SaaS look. Do not paint ordinary peso amounts in brand-lime or in success green. Do not use brand-lime as the success color.

The slate and blue tokens from the first audit (`#020617`, `#0F172A`, `#1E293B`, `#1D4ED8`, `#94A3B8`, `#334155`, `#64748B`, `#93C5FD` as the selected border) are superseded here. They are not the brand palette.

This revision is specification only. It does not change `src/`.

---

## Brand identity

Two official marks:

- **ENFORMA** — sports society
- **HYBRID EVENT** — EXPERIENCE

The product is that system, not a separate blue product. Header wordmark: ENFORMA. Event line: HYBRID EVENT EXPERIENCE 2026.

No official display font file is in this repository. Do not reconstruct or imitate a logo face from a screenshot. Until a licensed font file or an official lockup (image or vector) is in the project, set those words in Fira Sans. When the lockup exists, use the asset. Do not redraw it.

### Brand colors

| Token | Value | Role |
|---|---|---|
| `brand-black` | `#000000` | Page base, text on the lime CTA |
| `brand-pink` | `#E9C7DF` (RGB 233, 199, 223) | Secondary accent only |
| `brand-lime` | RGB 229, 237, 178 | Primary CTA, active nav, selected tab, brand emphasis |

`brand-lime` is provisional. The sRGB hex of RGB 229, 237, 178 is `#E5EDB2`. The reference image also showed a hex that does not match this RGB. That printed hex is not adopted. The brand book must confirm the final value. Do not invent a reconciliation between the two.

Brand-lime is identity. It does not mean success, conciliada, or a positive amount.

Brand-pink is a secondary accent: a highlight, a comparison, a category mark, a secondary chart series. It is not the page color and not the color of form labels.

### Interface typography

Fira Sans for UI, tables, forms, filters, labels, navigation, financial text, and figures. Tabular numerals stay on money, counts, percentages, and timestamps.

### Display typography

Reserved for the lockup, the brand name, and large brand titles, and only from an official licensed font file or an official image/vector. Otherwise Fira Sans.

---

## Color

Contrast below is WCAG relative luminance, measured for this revision. Normal text needs 4.5:1. A control boundary that carries meaning needs 3:1. Color never replaces the word.

### Neutrals

Black is the base. Surfaces step up so cards and tables have depth. They stay neutral gray, not slate blue.

| Role | Hex | Token | Contrast |
|---|---|---|---|
| Background | `#000000` | `--color-background` | `brand-black` |
| Surface | `#2A2A2A` | `--color-surface` | Cards and tables. 1.46:1 against the page, enough to read as a panel with the border |
| Elevated | `#333333` | `--color-elevated` | Detail panel, popover. 1.66:1 against the page |
| Primary text | `#FFFFFF` | `--color-foreground` | 21:1 on background, 14.4:1 on surface, 12.6:1 on elevated |
| Muted text | `#A3A3A3` | `--color-muted-foreground` | 8.33:1 on background, 5.01:1 on elevated |
| Divider | `#3A3A3A` | `--color-border` | Decorative only. 1.85:1 on background |
| Control border | `#8A8A8A` | `--color-control-border` | 6.08:1 on background, 3.66:1 on elevated |
| Focus | `#FFFFFF` | `--color-focus` | 2px ring, 2px offset |

### Brand applied to UI

| Role | Value | Rule |
|---|---|---|
| Primary action | `#E5EDB2` fill, `#000000` text | Entrar, Guardar, Conciliar, Ir a ventas. Black on lime is 17.1:1. White on lime is 1.23:1 and is forbidden |
| Active nav, selected tab | Lime text or lime 2px border on the neutral surface | Not a lime page and not a lime card |
| Key selected figure | Lime for the selected number only | The other figures stay white |
| Pink accent | `#E9C7DF` | Short highlight or category. 13.7:1 on background, 8.24:1 on elevated. Not body copy, not every card |

### Semantic colors

These are not brand colors. Do not draw a normal chart series with them.

| Role | Hex | Token | On background | On elevated | Always with |
|---|---|---|---|---|---|
| Success / conciliada | `#86EFAC` | `--color-success` | 15.0:1 | 9.00:1 | CONCILIADA or the validation word |
| Warning / conciliación pendiente | `#FDE68A` | `--color-warning` | 16.9:1 | 10.2:1 | PENDIENTE DE CONCILIAR |
| Payment pending | `#93C5FD` | `--color-info` | 11.7:1 | 7.01:1 | Pago pendiente |
| Error / negative | `#FCA5A5` | `--color-danger` | 11.1:1 | 6.66:1 | The error or "negativo" |

`#22C55E` remains large-text only (9.22:1 on background, 3:1 large-text floor). It is not brand-lime and not the default amount color.

### What changed and what stayed

Replaced: page `#020617`, surface `#0F172A`, elevated `#1E293B`, muted `#94A3B8`, divider `#334155`, control border `#64748B`, action `#1D4ED8` with white label, selected border `#93C5FD`.

Kept: success `#86EFAC`, warning `#FDE68A`, payment-pending `#93C5FD`, danger `#FCA5A5`, focus as a 2px light ring, Fira Sans, tabular numerals.

---

## Typography

**Fira Sans** for headings, body, labels, and figures. No monospace heading.

```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700&display=swap');
```

| Role | Size | Weight | Line height |
|---|---|---|---|
| Page title | 1.75rem | 600 | 1.2 |
| Section | 1.15rem | 600 | 1.3 |
| Body | 1rem | 400 | 1.5 |
| Label | 0.875rem | 500 | 1.4 |
| KPI primary | 1.75rem | 600 | 1.1 |
| KPI secondary | 1.25rem | 600 | 1.2 |
| Table / money | 0.9375rem | 500 | 1.4 |

Money and counts use `font-variant-numeric: tabular-nums` and align to the end of the column. Same weight for a column of amounts. Do not use a heavier weight to mean "good".

### Figures

| Case | Display | Extra cue |
|---|---|---|
| Amount | `$500.00` | MXN is in the column or the label, not repeated on every cell |
| Captured zero | `$0.00` | This is a recorded zero, not a missing value |
| Not captured | `—` | With "Pendiente de conciliar" where the row is a paid sale |
| Negative computed net | `-$12.00` | Plus the word "negativo". Color is additional |
| Unavailable | `—` | Never a fake zero |

Color never replaces the word or the glyph.

---

## Spacing and grid

Base unit 4px. Scale: 4, 8, 12, 16, 24, 32.

| Viewport | Columns | Gutter | Page padding |
|---|---|---|---|
| ≥1024px | 12 | 16px | 24px |
| 768–1023px | 8 | 12px | 16px |
| ≤767px | 4 | 12px | 16px |

Primary KPIs: 3 columns on desktop, 1 on mobile. Secondary KPIs: 4 then 2 then 1. Radius 8px on surfaces, 6px on controls. No large shadows. A 1px control border is enough.

---

## Information architecture

Header: ENFORMA on `brand-black`. Context line: HYBRID EVENT EXPERIENCE 2026, in muted text. Active item and the primary button use brand-lime with the contrast rules above. Inactive items stay white.

OWNER navigation: Inicio, Check-in, Mesa, Ventas.

FINANCE navigation: Inicio, Ventas. CEO and CTO use FINANCE. Do not create those roles.

Inside Ventas: Resumen, Ventas, Conciliación. Order detail is a drill-down panel, not a fourth section.

**Future filter default, not implemented:** the first period is **30 días**. Hoy, 7 días, and Rango stay available. Today hides the recent September sales, so a finance user must not land on an empty period.

### KPI weight

Primary: ingreso bruto aprobado, bruto pendiente de conciliar, ingreso neto conciliado.

Complementary: ventas aprobadas, costos registrados, pendientes de conciliar.

Secondary: órdenes creadas, pagos pendientes, ticket promedio, participantes.

### Before / after

| Surface | Now | Specified |
|---|---|---|
| Home | Shell, PWA, manifiesto, build id | Event context and the next finance or ops action |
| Login | Bare form | ENFORMA, HYBRID EVENT EXPERIENCE 2026, one sentence, black form, lime CTA |
| Period | Hoy | 30 días, when implemented |
| KPIs | Similar weight | Three levels |
| Charts | Mixed bars | Operations count and MXN income, separately |
| Reconciliation | Metadata before fields | Identity, then fields, then net, then audit |
| Detail | Long mixed order | Financial summary first, timeline last |

---

## Components

Specify only. Do not build them in this step.

| Name | Role |
|---|---|
| AppShell | Header, nav by role, session, page slot |
| TopNavigation | The links above. No extra roles |
| PageHeader | Title and one sentence |
| FinancialKpi | Primary or complementary figure |
| SecondaryKpi | Smaller figure |
| FilterBar | Period, search, product, category, state, provider, partner, reconciliation |
| StatusBadge | Text plus color: conciliación pendiente, conciliada, pago pendiente |
| MoneyValue | Tabular MXN, zero, dash, negative |
| FinancialTrend | One series: count or money, with a table |
| DataTable | Sortable headers, scroll wrapper, caption |
| OrderRow | One order in the operations table |
| ReconciliationCard | Identity, fields, net, save, then audit |
| FinancialInput | Peso field, label, error |
| CalculatedNet | Live net from the three cost fields |
| AttentionItem | One anomaly. Not a reconciliation task |
| OrderDetailPanel | Drill-down |
| EmptyState | No rows in this filter |
| ErrorState | Read or save failed |
| LoadingState | Snapshot loading |

---

## Charts

Use a line or a bar only when it answers a question. Always keep the data table.

| Question | Chart | Not |
|---|---|---|
| Operations per day | Vertical bars, labeled with the count | A toggle that swaps the same bars |
| Income per day | Separate bars or a line, labeled in MXN | Candlestick, area fill as decoration |
| Products | Horizontal bars sorted by income, plus the table | Pie, radar |
| Stage, partner, provider | Table | A chart with too many categories |
| Fewer than 4 days | The number and the table may be enough | A sparse line |

Do not encode a series by color alone. Do not use maps. A chart library is optional; the table is required.

Chart series, in order, on the black surfaces:

| Slot | Hex | Source |
|---|---|---|
| 1 | `#E5EDB2` | brand-lime |
| 2 | `#E9C7DF` | brand-pink |
| 3 | `#D4D4D4` | neutral light. 14.2:1 on background, 10.5:1 on elevated |
| 4 | `#E4D2C8` | warm neutral, chart only. 14.4:1 on background |

Do not use success, warning, payment-pending, or danger as an ordinary series. Those hues already mean a financial state. Brand-lime in a chart is a series, not "good". The table still carries the words.

---

## Interaction

- Primary actions are the brand-lime button with black text. One primary action per view. Financial cards stay on the neutral surfaces.
- Hover and press change opacity or background in 150–200ms. They do not move layout.
- No scroll-reveal on operational screens.
- `prefers-reduced-motion: reduce` removes non-essential motion.
- Tabs use `role="tab"` and `aria-selected`.
- A failed save keeps the typed amounts and shows the error on the card.
- Empty fields are not zero. The user must type `0` to record no cost.

---

## Responsive

Desktop is dense: tables stay tables. Tablet drops KPI columns first. Mobile uses cards for reconciliation and for the order list. Reconciliation fields are full width. Do not use a horizontal table for reconciliation on a phone. Touch targets are at least 44×44px. Sticky headers must not cover a focused control (`scroll-padding`).

---

## Accessibility

- Normal text contrast ≥ 4.5:1 on the surface behind it.
- Focus ring on every control, including inside the detail panel. Do not remove the outline without this ring.
- Tab order follows the visual order. The panel traps focus until it closes, and closing returns focus to the control that opened it.
- Every field has a visible label. Icon-only controls have an accessible name.
- Status badges include the words above. Color is extra.
- Data tables have a caption. Wide tables scroll inside `overflow-x: auto` and are not the reconciliation UI on small screens.
- Decorative icons are `aria-hidden`. Do not use emoji as icons.
- Password fields allow paste and password managers.

---

## Implementation phases

Do not start these until a later implementation request.

1. Tokens, Fira Sans, focus ring, tabular figures. No layout change.
2. Login and home copy. Remove technical production copy.
3. Change `EMPTY_FILTERS.preset` from `today` to `30d`. Update tests that assume Hoy.
4. Reorder KPI visual weight and reconciliation cards so the form comes before the audit lines.
5. Split day charts and add horizontal product bars. Keep the existing tables.
6. Reorder the order-detail panel. Accessibility pass on focus return and mobile cards.

Business rules stay: a sale is `orders.state = PAID`, gross is `total_cents`, net is only reconciled paid orders minus their recorded costs, and a missing row is not a captured zero.
