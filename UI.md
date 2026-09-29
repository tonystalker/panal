# UI refactor prompt — Personal Analytics

Copy everything inside the code block into your coding agent. This is a UI/UX refactor request; it must preserve the existing Milestone 3 product behavior, data model, routes, and integrations.

```text
You are refactoring the existing Personal Analytics MVP UI. The app is already functional through Milestone 3: daily tasks and manual metrics, GitHub and LeetCode integrations, configurable dashboard charts, history/calendar, and local-first storage. Do not replace the app, rewrite its business logic, change its data model, or remove working features. Improve the visual design, component consistency, responsiveness, and interaction quality only.

## Objective

Transform the UI into a calm, premium, privacy-first personal analytics product. It should feel designed—not AI-generated, dashboard-template-like, overly rounded, overly colorful, or card-heavy.

The intended character is:
- precise, restrained, analytical, and personal;
- dark-first, with deep charcoal surfaces and crisp white type;
- minimalist, but not empty or sterile;
- information-dense enough for daily use, with strong hierarchy;
- subtle glass morphism used as an elevation cue, not as decoration;
- one vivid signature accent color used sparingly and consistently.

## Non-negotiable constraints

- Preserve all existing routes, data loading, local-first/offline behavior, forms, task calculations, charts, connector flows, and accessibility semantics.
- Keep Shadcn UI primitives as the foundation. Use existing components where possible; create composable wrappers only when they establish a real repeated pattern.
- If Redux already exists, retain it and use its existing patterns. Do not introduce Redux only for presentational state; local UI state belongs in components unless the project already centralizes it.
- Do not add a backend, authentication, analytics tracking, third-party fonts requiring a network runtime, or product features not requested here.
- Do not add gradients, decorative illustrations, stock imagery, emoji, large icons, excessive blur, colored borders, huge headings, or “hero” marketing layouts.
- Do not make every section into a card. Use spacing, rules, and layout first; reserve elevated surfaces for meaningful groups, forms, summaries, and interactive containers.
- Do not use more than one primary accent color in normal UI states. Semantic success/warning/error colors remain available only for actual status.

## Design direction

### Color system

Implement the design as semantic CSS variables / Tailwind tokens. Do not scatter raw hex values across components. Keep the application dark-first. If a light theme currently exists, do not remove it unless doing so is safe; however, the dark theme is the visual reference and must be polished.

Suggested dark tokens (adjust only when contrast or the existing theme system requires it):

```css
:root {
  --background: #09090b;          /* near-black page canvas */
  --foreground: #fafafa;          /* primary text */
  --surface: #111113;             /* standard restrained surface */
  --surface-raised: rgba(24, 24, 27, 0.72);
  --surface-muted: #18181b;
  --muted: #27272a;
  --muted-foreground: #a1a1aa;
  --subtle-foreground: #71717a;
  --border: rgba(244, 244, 245, 0.10);
  --border-strong: rgba(244, 244, 245, 0.16);
  --ring: #a3ff12;
  --accent: #a3ff12;              /* signature acid-lime accent */
  --accent-foreground: #09090b;
  --success: #57e389;
  --warning: #f5c451;
  --destructive: #ff6b6b;
}
```

The signature accent should appear in selected navigation, primary actions, active chart state, compact progress indicators, keyboard focus, and a few important numerical highlights. Never use it for large background fills or every chart series. Chart comparisons should use controlled neutral grays first; use the accent to indicate selection or the primary measure.

### Typography

- Use a locally available/system-safe sans-serif stack with `Inter` first. If Inter is already bundled, retain it; otherwise use `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Do not add a network font dependency.
- Use a tighter, more editorial display treatment for page headings only. If an existing local “Instrument Sans”, “Inter Tight”, or “Arial Narrow” equivalent is available, use it for headings; otherwise use the main sans stack with negative letter-spacing instead of adding a new runtime font.
- Body: 14px–15px, regular weight, comfortable line height.
- Labels/metadata: 11px–12px, medium weight, uppercase only where it improves scanning, with intentional tracking.
- Page title: 28px–36px depending on viewport, medium/semibold, tight leading, slight negative tracking.
- Section title: 16px–20px, medium/semibold.
- Metric values: 24px–36px, tabular figures, medium weight; do not use enormous 48px+ KPI numbers.
- Establish hierarchy through type scale, weight, spacing, and contrast—not by using many different colors.
- Use `font-variant-numeric: tabular-nums` for dates, percentages, durations, counts, and aligned table cells.

### Layout and spacing

- Desktop app shell: collapsible left sidebar, top contextual header, and a centered content canvas. The main content should have a practical max width (roughly 1440px), with responsive breathing room.
- Keep a disciplined 4px/8px spacing rhythm. Prefer generous page-level spacing and compact component internals.
- On desktop, dashboard grids should use 12 columns conceptually. On tablet and mobile, stack intelligently; never rely on horizontal page scrolling.
- Give the Today page a focused single-column primary workflow plus an optional narrow insights column at wide breakpoints. The Dashboard may use a two-column widget grid. Calendar/history should prioritize scanability over decorative panels.
- Use dividers and whitespace to group related content. Do not wrap every row in a card.

### Surfaces, borders, and glass

- Base canvas: flat deep black/charcoal, not a gradient.
- Main interactive panels: restrained translucent charcoal with `backdrop-filter: blur(12px)` only where content behind it makes the effect meaningful. The app must remain readable if backdrop blur is unavailable.
- Use a subtle 1px monochrome border: `rgba(255,255,255,0.08–0.14)` depending on elevation.
- Use small radii consistently: 10px–14px for cards/dialogs and 8px–10px for controls. Avoid pill-shaped containers except compact status badges, segmented controls, or avatars.
- Shadows should be rare and soft: a broad dark shadow only for popovers, dialogs, and clearly raised cards. Do not put a heavy shadow around every panel.
- Avoid noisy nested surfaces. A raised card should not contain more raised cards unless it is a dialog/form section with a clear reason.

## App shell

### Sidebar

Create a collapsible navigation sidebar using Shadcn Sidebar primitives if they are already installed; otherwise build it with accessible semantic buttons and the project’s existing components.

- Expanded width approximately 248px; collapsed width approximately 64px.
- Persistent on desktop, drawer/sheet on mobile.
- Top area: small monogram mark, product name “Personal Analytics”, then a concise local-first/privacy label if it already fits the product.
- Use an abstract monogram such as `PA` in a compact square or soft-cornered mark. It must be typographic—not a generated logo or a decorative illustration.
- Navigation items: Today, Dashboard, Calendar, Connectors, Settings. Use minimal line icons only when they improve quick scanning.
- Active state: low-opacity accent surface or a thin accent indicator plus white text. Inactive items use muted text and become white on hover.
- Tooltip labels are required for collapsed icon-only navigation.
- Bottom area: local data/status summary and theme control only if these controls already exist or are necessary. Do not invent account/profile UI in a local-only MVP.
- Collapse/expand must preserve keyboard navigation and clearly expose its accessible name/state.

### Top header

- Keep the header quiet: current page title, short contextual subtitle/date where valuable, and one primary contextual action at most.
- Today can show the date and an “Add task” button.
- Dashboard can show the selected date range plus “Customize” or “Add widget” only if that feature exists.
- Avoid a redundant header if the page already has a strong title area.

## Page-specific direction

### Today

Design Today as the product’s most important page. A person should be able to understand their day within three seconds and update it in a few taps.

- Top: date, a compact day-progress summary, and one primary “Add task” action.
- Show progress as a thin, precise progress bar with readable percentage and completed/total text. Do not use oversized circular gauges.
- Task list: clean rows, clear checkbox/status control, task title, optional quantitative `completed / target` display, and subtle category/meta text. Completed rows should remain legible; reduce contrast modestly rather than aggressively striking them out.
- Keep task actions discoverable but quiet: edit/delete may appear on hover/focus or in a menu; always remain available on touch devices.
- Manual check-ins (exercise, DSA, mobile usage): compact inputs/switches grouped in a single purposeful area, not three large decorative cards.
- Empty state: short, direct, and useful—e.g. “Plan one thing worth finishing today.” Include one action. No illustrations.

### Dashboard

The dashboard should look like a personal analysis workspace, not a grid of generic SaaS KPI cards.

- Begin with a compact date-range selector and a one-line summary of the period.
- Use 2–4 small metric summaries only if they directly orient the user; avoid a “stats wall.”
- Chart widgets use a transparent or lightly raised surface with a clear title, metric/unit, selected period, and a subtle action menu for existing configuration.
- Charts must have strong contrast against the charcoal canvas, quiet axis/grid lines, readable labels, and a consistent accent mapping.
- Default chart styling: primary series in accent; secondary reference/previous-period series in gray; goal/target line in a muted dashed neutral. Do not use rainbow charts.
- Change line/bar/area/heatmap types without changing layout hierarchy. Keep chart controls in a compact popover or sheet, not permanently exposed.
- Use custom SVG or an appropriate chart extension for calendar heatmaps; ensure the heatmap is readable without color alone by providing values/tooltips and keyboard-accessible equivalents where practical.
- Make tooltip styling minimal: dark surface, 1px border, tabular figures, no excessive shadow or color chips.

### Calendar and history

- Calendar should be compact, legible, and intentional. Use restrained grayscale day cells; accent marks the selected day or strong completion, not every completed day.
- In history lists, prioritize date, completion percentage, key metric deltas, and a concise status. Avoid repeated cards for every day.
- The selected-day detail can open in a sheet/drawer on small screens and a side panel on desktop if the existing interaction supports it.

### Connectors

For the current MVP, keep GitHub and LeetCode as focused integration panels—not a fictional marketplace.

- Use two polished provider panels with monogram/icon, provider name, connection state, last sync, a concise imported-metrics line, and one clear action.
- Connected state should feel calm: a small neutral/success status indicator, not an oversized green banner.
- Disconnected state explains what will be imported before the user authorizes it.
- Errors must be human-readable and actionable: “GitHub token expired. Reconnect to continue importing contributions.”
- Token/input fields use a monospaced font where useful, with clear label, help text, and show/hide controls when appropriate.

### Settings

- Present settings as grouped rows with a strong title, short description, current value, and a clear control.
- Privacy/export controls should be prominent but sober: “Export local data”, “Import backup”, and “Delete local data” (destructive and confirmation-protected).
- Do not make settings into a dense dashboard.

## Component standards

Use Shadcn UI components wherever appropriate, especially Button, Card, Dialog, Sheet, DropdownMenu, Tooltip, Popover, Tabs, Select, Switch, Checkbox, Progress, Separator, Skeleton, Sonner/Toast, and command-style controls if already present.

Create or refine these reusable application components:

- `AppShell` — responsive sidebar and page content frame.
- `AppMonogram` — text-based brand mark with size variants.
- `PageHeader` — title, optional context, optional primary action.
- `MetricValue` — tabular metric display with label, value, unit, optional delta.
- `SectionHeading` — title plus optional action/description without card chrome.
- `TaskRow` — accessible completion control, target progress, and overflow actions.
- `ChartWidget` — title/meta/action layout that wraps existing chart implementations.
- `ConnectorPanel` — provider status, sync state, metric preview, action.
- `StatusBadge` — restrained, semantic status treatment; no gradient/pill overuse.
- `EmptyState` — concise title, one sentence, one relevant action.

Use variants and class composition rather than duplicating markup. Do not abstract one-off page fragments prematurely.

## Interactions and motion

- Motion is feedback, not decoration. Use 150ms–220ms transitions with a restrained ease-out curve.
- Buttons: slight background/border/foreground transition; no bouncy scaling.
- Sidebar: smooth width transition; label fade/clip appropriate to reduced-motion settings.
- Task completion: a brief checkbox/progress state update; do not animate the whole task list or fire celebratory confetti.
- Dialog/sheet/popover: use Shadcn/Radix motion defaults or minimal opacity/translate transitions.
- Chart changes: animate only if existing chart library supports an accessible, non-jarring transition. Respect `prefers-reduced-motion` throughout.
- Loading: skeletons that match the final layout; do not use generic spinners as the only loading experience for page-level content.
- Success/error feedback: compact toast plus persistent inline state where the user needs to resolve something.

## Accessibility and responsive behavior

- Meet WCAG AA contrast for primary text, controls, focus rings, and chart labels. Do not rely on low-opacity gray text for essential information.
- Preserve visible keyboard focus. The accent focus ring is acceptable, but it must remain clearly visible on all dark surfaces.
- Every icon-only control has an accessible name and tooltip.
- Use native form controls/Shadcn primitives, correct labels, error text, and keyboard support.
- Ensure checkbox, switch, menu, sidebar, dialog, and chart controls are operable with keyboard.
- Support 320px-wide mobile screens, tablet widths, and wide desktop. Avoid clipped charts, fixed-width cards, and hover-only actions.
- Sidebar becomes an accessible Sheet/drawer on small screens.
- Respect reduced-motion preferences.

## Implementation process

1. Inspect the existing route structure, installed Shadcn components, Tailwind setup, theme variables, state management, and chart library before editing.
2. Create/update semantic design tokens first. Centralize typography, border, radius, surface, shadow, and accent decisions.
3. Refactor the app shell and navigation next; then common components; then pages in this order: Today, Dashboard, Connectors, Calendar/History, Settings.
4. Preserve behavior while refactoring. If a UI behavior is unclear, keep the existing working behavior rather than inventing a new product flow.
5. Remove stale AI-template styling, redundant cards, random colors, inconsistent spacing, and any unused visual helper components only after confirming they are unreferenced.
6. Do not use placeholder data in production views. Existing empty/loading/error states must be explicitly handled.

## Definition of done

- The app has a cohesive dark charcoal visual system with one acid-lime signature accent and semantic status colors only.
- Typography, spacing, borders, radii, and interactions are visibly consistent across all five pages.
- Today is fast and focused; Dashboard is analytical rather than card-heavy; GitHub and LeetCode connectors look intentional.
- Desktop sidebar collapses correctly; mobile navigation works in a drawer; all layouts are responsive.
- Existing functionality remains intact: tasks, manual metrics, charts/configuration, GitHub, LeetCode, history, import/export, and offline/local behavior.
- Keyboard navigation, focus states, form labels, contrast, and reduced-motion behavior are verified.
- Run lint, TypeScript typecheck, unit tests, and existing end-to-end tests. Add/update focused UI tests only where the component structure made a behavior regression possible.
- Provide a concise final summary listing design-system files changed, components changed, pages changed, tests run, and any design choices that need human review.
```

## Optional visual reference sentence

If your coding agent benefits from a compact visual anchor, add this sentence before the prompt:

> Think “quiet Swiss editorial dashboard meets a terminal-inspired private data tool”: near-black canvas, white data, hairline borders, one acid-lime signal color, compact high-quality typography, and zero decorative noise.
 