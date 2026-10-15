# Design system plan (web/)

Status: direction approved 2026-10-15 (Apple-native, one tint plus status colors, AA-checked; see "Visual direction" and `docs/design-direction-mockup.html`). Phases 0 to 4 are implemented, including the illustration components in `web/src/illustrations/`; phase 5 (a visible theme toggle) is optional and not started.

## Problem

The web app does not lack a design system; it has two half-adopted ones, and pages bypass both.

1. **Tokens exist but are spoken in two dialects.** `web/src/index.css` defines shadcn tokens (`--foreground`, `--muted-foreground`, `--border`...) and then app aliases on top (`fg`, `fg-muted`, `fg-subtle`, `line`, `line-soft`, `surface`, `canvas`, `brand-50..900`). Pages use both for the same thing: `text-muted-foreground` 134 times, `text-fg-subtle` 27 times, plus `text-zinc-500` 80 times, which is a third spelling of the same intent that does not follow dark mode.
2. **The status vocabulary is incomplete.** There is `--positive` and `--negative`, but no warning or info tone and no soft (background) variants. So every alert, badge and highlighted tile hand-rolls a palette pair: about 220 raw Tailwind palette classes (`rose`, `emerald`, `amber`, `zinc`...) and about 90 `dark:` overrides across 17 files. `Stat`'s `warn` tone is literally `text-amber-600 dark:text-amber-400`; `Dashboard.tsx:259` builds a savings tile from 8 emerald/teal classes.
3. **The shadcn kit is scaffolding, not the system.** 20 files live in `components/kit/`; only 3 are imported outside the kit (`command`, `popover` from `ui.tsx`/`ScrapeButton.tsx`, `tooltip` from `App.tsx`). The real primitives are the CSS component classes (`.btn` ~120 call sites, `.input` ~112, `.card` ~94, `.chip` 25, `.table` 25) and the composites in `components/ui.tsx` (`Money`, `Stat`, `Modal`, `Picker`, `Segmented`, `Progress`, `Field`...). Several of those duplicate an unused kit file (`Modal` vs `kit/dialog`, `Segmented` vs `kit/toggle-group`, `Progress` vs `kit/progress`, `charts.tsx` vs `kit/chart`).
4. **There is no type scale beyond Tailwind defaults.** The app body is 14px, and pages reach for `text-[11px]` (22 uses in 11 files), `text-[0.9375rem]`, `text-[1.625rem]`, `text-[10px]` and friends. Roughly 300 arbitrary-value utilities overall, most of them sizes and grid templates.
5. **Nothing stops drift.** No lint, no reference page. Each new page re-decides colors and sizes.
6. **The look is a generic template.** Indigo accent, ambient gradient glows, gradient buttons, a grid of identical shadowed KPI cards, an ink sidebar. It reads as a default AI-generated SaaS dashboard rather than a family's finances. See "Visual direction".

## How the app is used (what the system must serve)

A family, on a laptop and on phones, mostly reading numbers in Hebrew (RTL). The recurring jobs are: glance at "how is this month going" (Dashboard, KPI cards, alerts), triage and categorize transactions (dense tables, pickers, chips), plan ahead (budgets, forecast, fixed/scheduled items, planned expenses), check long-horizon wealth (net worth, pension, investments, insurance), and ask the data chat. That shapes the priorities:

- **Numbers are the content.** Tabular figures, LTR-isolated amounts inside RTL text, consistent sign and color rules, and a typographic step for KPI values. `Money` and `.num` already exist; the rules around them don't.
- **Status is the second content.** Over budget, stale balance, upcoming charge, forecast dips below zero. One tone vocabulary must cover alerts, chips, progress bars, KPI deltas and chart annotations.
- **Density matters on two screens.** Tables must stay readable at 14px on desktop and touchable on phones. The existing `pointer: coarse` rules are good and stay.
- **RTL is the only direction.** Logical properties everywhere. The codebase is already nearly clean (a handful of physical `left-`/`right-`/`ml-` uses), so this is a rule to lock in, not a cleanup.

## Non-goals

- A logo, app name or marketing site. The refresh covers the app UI only.
- A new component library or dependency. Radix + Tailwind v4 + motion stay.
- Storybook, a Figma library, or a published package. The consumer is this one app.
- LTR/English layout support.
- Restyling `recharts` internals beyond tokens it already reads.

## Decisions

### D1. Canonical token names are the shadcn ones

`foreground`, `muted-foreground`, `border`, `card`, `muted`, `accent`, `primary`, `destructive` are the names. The app aliases are deprecated and removed by the end of the migration: `fg` -> `foreground`, `fg-subtle` -> `muted-foreground`, `line` -> `border`, `line-soft` -> `border/65` (or a single `--border-soft` token if it is used enough to deserve a name), `surface` -> `card`, `surface-muted` -> `muted`, `canvas` -> `background`, `brand-*` -> `primary`/`accent` (both graphite and neutral tint under the new direction). `fg-muted` (7 uses) folds into `muted-foreground`; if that loses a needed contrast step, add one `--foreground-secondary` token rather than keeping the mix.

Why shadcn names: the Radix kit already speaks them, they are the larger share of current usage, and `web/components.json` is configured, so `npx shadcn add` drops new files into `kit/` already speaking these names; any other vocabulary would need translating on every addition.

### D2. Four status tones, each with three roles

Add `warning` and `info` beside `positive` and `negative` (rename `destructive` usage for non-destructive "bad" states to `negative`; `destructive` stays for delete/irreversible actions only). Each tone gets:

| token | use |
|---|---|
| `--{tone}` | icons, dots, bars, chart marks |
| `--{tone}-soft` | tinted background of a chip, alert, highlighted tile |
| `--{tone}-strong` | text on the soft background (passes AA in both themes) |

Defined once for light and once for dark in `index.css`, exposed through `@theme inline` so `bg-warning-soft text-warning-strong` works. This single addition is what retires most raw palette classes and nearly all `dark:` overrides, because the dark-mode decision moves into the token.

Finance rule that goes with it: **amount color is not status.** A spend is not "bad". `Money colored` stays reserved for values whose sign is the message (net flow, delta, balance change). Plain expense amounts in tables are `foreground`. Status tones are for judgments (over budget, stale, below zero forecast).

### D3. Type scale: extend Tailwind's, don't invent semantic classes

Add three steps to `@theme`: `--text-2xs: 0.6875rem` (11px: table meta, chart axes, captions; replaces all `text-[11px]` and `text-[10px]`), `--text-md: 0.9375rem` (15px: card titles, replaces `text-[0.9375rem]`), `--text-kpi: 1.625rem` (26px: KPI values, replaces `text-[1.625rem]`). With body 14px (`text-sm`) and `text-xs` 12px, the scale is 11 / 12 / 14 / 15 / 18 / 20 / 26. Line heights ship with each step. Weight vocabulary: 400 body, 500 labels and controls, 600 titles, 700 KPI values only.

### D4. CSS classes stay the API for leaf elements; React components for composites; the kit is a behavior layer

The alternative considered was making kit React components (`<Button>`, `<Card>`) the API with cva variants emitting the existing classes. The usage data argues against it: those kit files are imported nowhere, while ~450 call sites use the classes and look consistent. Converting `className="btn btn-primary"` to `<Button variant="primary">` is churn without a user-visible gain, and Tailwind v4 `@layer components` is a legitimate home for element styles.

So the layering is:

- **Leaf elements** (styled HTML, no behavior): `.btn` (+ `-primary`, `-danger`, `-ghost`, `-sm`, `-icon`), `.input`, `.label`, `.card` (+ `-hover`, `-title`), `.table`, `.chip` (+ new tone modifiers `.chip-positive|negative|warning|info`), `.seg`, `.num`, `.icon-tile`, `.skeleton`. Documented, closed set.
- **Composites** (`components/ui.tsx`, later split by area): `Money`, `Stat`, `Progress`, `Modal`, `Field`, `Picker` and the `*Select`s, `Segmented`, `PageHeader`, `SectionTitle`, `Empty`, `ErrorBox`, `Loading`, plus a new `Alert` (tone + icon + text) and `StatusBadge` (tone chip).
- **Behavior primitives** (`components/kit/`): keep only Radix wrappers that composites use or should use: `popover`, `command`, `tooltip`, `dialog`, `sheet`, `dropdown-menu`, `select`. Delete the unused presentational ones (`card`, `badge`, `avatar`, `progress`, `skeleton`, `separator`, `chart`, `toggle`, `toggle-group`, `tabs`, `scroll-area`, `checkbox`) unless a phase below adopts one. `kit/button` is imported by `kit/dialog` (its close button), and `kit/command` imports `kit/dialog`; either keep `kit/button` as an internal dependency or point `dialog`'s close button at `.btn-ghost .btn-icon` and delete it. The second is preferred so there is one button style.

`Modal` has a working hand-rolled focus trap, so moving it onto `kit/dialog` (desktop) + `kit/sheet` (phone) is a cleanup for correctness edge cases (nested portals, scroll lock, inert background), not urgent. Do it in phase 3.

### D5. Charts: `components/charts.tsx` survives

`kit/chart.tsx` (373 lines) has zero importers. Delete it. `charts.tsx` keeps reading `--chart-1..8` and the status tones. Category and member colors stay derived by `hueFor()` (stable hash onto the 8 chart hues), with the stored member color taking precedence as today.

### D6. Motion constants shared between CSS and JS

`index.css` defines `--ease-out` and three durations, while `motion` call sites hardcode `[0.22, 1, 0.36, 1]`, `0.45`, `0.06` stagger. Add `web/src/lib/motion.ts` exporting the same easing and durations, and use it in `Stat`, `Progress`, `AnimatedNumber` and page transitions. Reduced-motion handling already exists and stays.

### D7. Theme: keep following the OS, but make a toggle cheap

Today dark mode is only `prefers-color-scheme`. Restructure the dark block as `:root[data-theme="dark"]` plus the media query guarded by `:root:not([data-theme="light"])`, and add `@custom-variant dark` so the few remaining `dark:` utilities follow the same switch. Whether to ship a visible toggle is open question 2; the restructure costs little and is easier now than after the codemods.

## Rules (what the lint enforces)

Outside `index.css` and `components/kit/`:

1. No raw Tailwind palette colors (`(text|bg|border|ring|fill|stroke|from|via|to)-(red|rose|emerald|green|amber|yellow|zinc|gray|slate|...)-\d+`). Use tokens.
2. No arbitrary font sizes (`text-[...]` with a length). Use the scale.
3. No physical direction utilities (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `border-l/r`, `rounded-l/r`). Use `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`.
4. No `dark:` variants except an explicit allowlist (expected: near zero after phase 2).
5. No hex/rgb/oklch literals or raw palette names in `.tsx`. Inline `style` may reference `var(--token)` only. Exemption: `white`/`black` inside `color-mix()` and `text-white` on filled color swatches (`MemberAvatar` mixes the member color toward white), listed in the allowlist rather than special-cased in the scanner.
6. Amounts render through `Money` or carry `.num`. Numeric table columns are `text-end`.

Implementation: `web/scripts/check-design.mjs`, a plain grep-style scanner with a per-rule baseline file, wired into `npm --prefix web run typecheck` (or a vitest test at the root, matching how the repo already runs checks). It starts in report mode with the current counts as the baseline and fails only on increases; each phase lowers the baseline; phase 4 sets it to zero.

## Living reference

A `/kit` route in the app (not in the nav; the app is local with no login, so no gating needed) that renders every token swatch in both themes, the type scale, each leaf class and composite with all variants and tones, and the RTL/number rules with examples. It uses the demo data shape so it never needs a real DB. This is the review surface for every later phase: open `/kit` in light and dark before and after.

## Visual direction

The second half of this plan is a new look. Today the app reads as the default AI-generated SaaS dashboard, not as a household's books, and the tokens above are what make replacing it a contained change instead of a rewrite.

### What makes it look like a template

Each of these is either removed or replaced; the list doubles as the acceptance check for the refresh. Large radius, translucency and colored icon tiles are not on it: Apple uses all three well. What makes the current UI generic is how it uses them.

1. Indigo/violet as the only idea (`--primary` at hue 272, and every neutral tinted toward it, including dark mode's navy-black background).
2. Decorative glows with no meaning: the two radial gradients on `body`, the blurred color wash behind every `Stat` card, tinted `--shadow-lift`/`--shadow-overlay`.
3. Gradient primary button with an inset highlight and colored drop shadow (`.btn-primary`); gradient progress bars; gradient member avatars.
4. A grid of identical KPI cards with no hierarchy, each with the same corner icon tile and sparkline, as the first thing on the page.
5. Lift-on-hover on cards that are not links, and an ink sidebar louder than the content.
6. Entrance choreography: page rise-in, staggered card entry, numbers counting up from zero on first view.
7. Eight saturated chart hues assigned by hash, so "Groceries" is an arbitrary color that changes between screens.

### What Israeli finance already looks like

Surveyed on 2026-10-15 from public marketing sites (logged-in product screens were not accessible, so this is brand and presentation, not app UX): Bank Hapoalim, Leumi, Discount, Mizrahi-Tefahot, One Zero, Pepper, Max, Isracard, Bit, Altshuler Shaham, Bank of Israel, and Riseup (the closest product to this app: cash-flow management for Israeli families).

- **Every hue is taken.** Hapoalim red, Leumi navy (`#070762` measured), Discount green with purple, Mizrahi orange, Pepper magenta, Bit dark teal, Max light blue, Isracard black with orange and purple shapes, One Zero black on white. There is no free hue for this app to own.
- **The closest product owns our first-draft palette.** Riseup is cream (`#F9F7ED`) with deep green text (`#205441`), set in Simpler, with periwinkle and pink color blocks. The pine green in the first mockup was within a few points of it. Dropped.
- **Hebrew type is where the brands differ.** Leumi and Riseup both use Simpler (so any Simpler lookalike is out); One Zero uses its own Apparat and Narkiss Block, set large and light (54px at weight 400, grey `#3E3E3E` on white); Isracard a custom display face at 90px over Arial body. Leumi ships a font literally named `CurrencyFix` ahead of SimplerPro, which is a bank patching the ₪ glyph.
- **Useful presentation idioms.** Riseup pairs actual with expected ("נכנס / צפוי להיכנס", "יצא / צפוי לצאת") and sets cents smaller than shekels. Bank of Israel puts an "as of" date under every headline figure and a daily change beside each rate. Hapoalim and Max surface a short row of quick actions.
- **What to avoid from the survey.** Stock-photo heroes, mascot illustrations and promotional banners are the marketing layer of every one of these sites. An app the family opens to check the month needs none of it.

### Direction: Apple-native, with an illustrated layer

"Like Apple" here means Apple's own apps under the current Liquid Glass language (Wallet and Apple Card, Health, Stocks, Fitness, System Settings), not apple.com marketing. The app should feel like it shipped with the Mac and iPhone the family already uses. On top of that, one illustration language the household picked from Google's developer program: flat vectors with near-black outlines, simple primary fills, "+" sparkles and solid offset shadows, set on pastel panels with a thin outline. Apple supplies the structure and the data views; the illustrations supply warmth in the few places that are about the family rather than the numbers. The mockup (`docs/design-direction-mockup.html`) shows both together.

**Structure.** A floating glass sidebar in the System Settings pattern, but with monochrome icons (SF Symbols style in the secondary label color; the selected item's icon takes the tint). A floating glass toolbar (capsule) holding the member segmented control, the month switcher, the theme toggle and the one prominent action ("עדכון מהבנקים", the only filled element on the glass, per HIG). Content sits on Apple's grouped background in borderless cards (radius 20) and grouped inset lists (radius 14) with no shadows; hierarchy comes from type, never from color or glow. On phones the sidebar becomes a floating glass tab bar with five tabs.

**Color: one tint, plus status.** The first Apple pass used a different system hue for every category and every sidebar item; it read as noisy and leaned on color alone. The rule now: blue is the only hue in normal use (buttons, links, focus, selection, the main data series in every chart), status colors appear only when something needs attention (red for over budget or below the overdraft, orange for nearly empty or stale, green only for money coming in), and everything else is label grays. Categories are told apart by name, icon and order, not by color: the spending chart is single-tint bars with a ranked, labeled category list beside it, envelope rings are all blue until they turn orange or red, and list icons sit in neutral gray circles. Issuer dots are dropped; the issuer is named in text. Neutrals are Apple's grouped backgrounds (`#F2F2F7` page and white cards in light; pure black page with `#1C1C1E` cards and `#2C2C2E` elevated in dark), but text colors are opaque instead of Apple's translucent ones, because the translucent secondary label measures 3.5:1 on the page and fails AA. Blue as the tint reverses the survey's "avoid blue" finding on purpose: the household asked for Apple. HIG notes the system values can shift between releases; the tokens store them as reference values.

**Typography.** The system font: `-apple-system, BlinkMacSystemFont, system-ui` resolves to SF Pro and SF Hebrew on Apple devices and Segoe UI elsewhere. Big values use `ui-rounded` (SF Pro Rounded, as Health and Fitness do) with the system font as fallback. Nothing is self-hosted; Heebo's package can be dropped once the fallback is checked on a non-Apple machine. This replaces the earlier "fontsource package" requirement; tabular figures and the ₪ glyph still need checking in both SF and the fallback. Sizes follow macOS on desktop (large title 30, card title 17, body 14, caption 12) and iOS under `sm`; D3's scale covers both.

**Data views (each dresses an existing feature in an Apple pattern).**
1. Health summary tiles for the headline figures: neutral title with a gray icon, big rounded number with a small unit, one supporting line or mini chart, chevron. Status appears inside a tile only as an icon plus text (the envelopes tile names the envelope that is over and the one nearly empty). Four tiles: expected to be left (with actual vs expected bars for in and out, both in the tint), checking balance (with spark and "as of" time), next card charge (issuer, amount, date, installments), envelopes needing attention.
2. Apple Card's activity layout for day-to-day spend, in one color: daily bars in the tint (today's bar a shade darker), rounded data ends, and a ranked category list with names, amounts and gray length bars under it. The category breakdown per day is in the hover tooltip and in a visually hidden data table.
3. Fitness-style rings for envelopes: every ring in the tint on a gray track, orange when more than 85% is used, red overflow arc when over, and the same state written under the ring ("כמעט ריקה", "חריגה"). Each ring is one image with a full spoken label.
4. A Stocks-style line for the checking forecast: solid for actual, dotted for forecast, soft area under actual, the overdraft line and the lowest point marked, card charge days on the axis.
5. Wallet-style grouped lists for transactions and alerts: a category icon in a neutral gray circle, merchant, issuer and detail line, amount at the inline end with smaller cents (income in green with a "+", spend in the label color with a minus), chevron; day groups with a daily total. Alert icons are the only colored circles, and each state has its own glyph (alert, clock) as well as its color.

**Illustration layer.** Used in exactly three kinds of places: the Overview hero (greeting, the month in one sentence, two pill buttons, one illustration), spot panels that invite an action (adding a planned expense, connecting a bank), and empty or onboarding states. Never inside charts, tables, lists or tiles. Rules: strokes 2px in near-black `#1D1D1F`; fills from a four-color illustration palette (blue, light blue, yellow, white) that is separate from the UI tokens; "+" sparkles and cloud shapes without outlines; solid offset shadows (a dark copy of the shape a few pixels down) instead of blur; panels in a single pastel sky with a 1.5px outline and radius 32; pill buttons, filled blue or white with an outline. Subjects come from this household's world: coins with ₪, envelopes, cards, a bar-chart sheet, a calendar, a plane for a planned trip. Illustrations are inline SVG components in `web/src/illustrations/`, using CSS variables so dark mode can darken panels while the objects keep their light fills. In dark mode the panel outline drops to a translucent white.

**Motion.** Apple-like and brief: spring on press (scale 0.97), cross-fades on value change, rings and bars drawing in once. No page rise-in, no card stagger, no count-up from zero, no hover lift. Reduced-motion handling stays.

**Alternatives considered.** The "statement" direction (graphite chrome, one accent for focus and selection, IBM Plex Sans Hebrew set large and light) went through three accent variants (none, highlighter yellow, process cyan) and was judged too austere. "Family album" (rounded, member-colored, illustrated everywhere) survives only as the illustration layer, limited to the hero, spot panels and empty states.

### Accessibility (a requirement of the direction, not a later pass)

Target WCAG 2.2 AA in both appearances; these checks gate phase 2.

- **Contrast, measured, not assumed.** Body and secondary text 4.5:1 or better on every surface it sits on (page, card, elevated, glass). The mockup's values: secondary label `#636366` is 5.4:1 on the page and 6.0:1 on cards (light), `#A1A1A8` is 6.6:1 on dark cards. White on the tint button `#0068D6` is 5.3:1 (Apple's `#007AFF` gives only 4.0:1). Colored text uses darker variants: green `#1F7A35` (5.4:1), red `#D70015` (5.4:1), orange `#C93400` (5.3:1). Chart marks, focus rings and control outlines 3:1 or better (the blue bars are 4.0:1 on white). The lint in phase 0 gets a contrast check over the token pairs so a later token change cannot regress this.
- **Never color alone.** Every status has an icon and words; income has a "+"; forecast vs actual is dotted vs solid; categories have names. A grayscale screenshot of any page must still be fully understandable, and that is a phase-2 review step.
- **Charts have a text alternative.** Each chart is an image with a summary label (lowest point, end value), and each has a visually hidden data table (or a "show as table" toggle).
- **Respect the OS settings.** `prefers-reduced-transparency` turns all glass opaque; `prefers-contrast: more` makes secondary text full strength and adds outlines to cards; `prefers-reduced-motion` keeps only cross-fades; Dynamic Type equivalents: layouts must hold at 200% browser zoom without horizontal scrolling.
- **Targets and focus.** Interactive targets 24x24px or larger (WCAG 2.2), 44px on touch; a visible 2px focus ring in the tint on everything focusable, including tiles and list rows (which are buttons).
- **RTL and language.** `lang="he"` and `dir="rtl"` on the root, numbers LTR-isolated, chevrons pointing in the reading direction; screen-reader labels in Hebrew.

### What tokens alone won't change

Swapping values in `index.css` carries most of the refresh only after phase 0 and 1 land. These spots hardcode the old look and must be edited by hand: the `body` background gradients; `.btn-primary`; `.card-hover`; `.seg-pill` and its static fallback (literal oklch shadows); `.scroll-x` edge shadows (literal oklch); the oklch literals inside `--shadow-*`; `Stat` (wash, icon tile, layout); `Progress` gradients; `MemberAvatar` gradient; the sidebar and its active state in `App.tsx`; the Dashboard savings tile; `animate-page-in`/`stagger` usage; `AnimatedNumber`'s first-view count-up. That list is short, which is the argument for doing phase 0 and 1 first.

## Migration, ordered by ROI

Phases 0 and 1 are designed to produce no visual change in light mode, which makes them cheap to review and means the refresh in phase 2 is a change of token values plus the short hand-edit list above, reviewable on `/kit` and a few pages.

**Phase 0: foundations (no visual change).** Add status tones with soft/strong roles, `text-2xs`/`text-md`/`text-kpi`, `lib/motion.ts`, the D7 theme restructure. Land `check-design.mjs` in report mode with baselines. Add `/kit`. Delete the 12 unused presentational kit files listed in D4 (including `kit/chart.tsx`), and `kit/button` once `dialog` no longer needs it.

**Phase 1: mechanical codemods.** `text-zinc-500` -> `text-muted-foreground` (80 sites; near-identical in light, and a dark-mode fix since `zinc-500` does not lighten). `text-[11px]`/`text-[10px]` -> `text-2xs`; `text-[0.9375rem]` -> `text-md`; `text-[1.625rem]` -> `text-kpi`. Alias tokens and `brand-*` -> canonical names. Physical direction classes -> logical. Each is a sed-able replacement reviewed with a diff and a `/kit` + page screenshot spot check.

**Phase 2: the refresh.** Gate: the visual direction is approved (mockup reviewed) and the system-font fallback is checked on a non-Apple machine. Set the new token values for both themes, switch to the system font stack, then work the hand-edit list in "What tokens alone won't change". Rebuild the Dashboard as the hero plus Health-style tiles, the activity chart, rings and forecast, and the transactions page as Wallet-style grouped lists; add `web/src/illustrations/` with the hero and spot illustrations. In the same sweep, replace rose/emerald/amber + `dark:` pairs with tone tokens: `Stat` warn tone, `Progress` over/warning gradients, stale-balance text, alert boxes, the Dashboard savings tile, Cashflow and Fixed highlights (Fixed has the most `dark:` overrides at 9). Introduce `Alert` and `StatusBadge` and `.chip-{tone}` as part of this sweep. Apply the "amount color is not status" rule where pages currently color plain expenses.

**Phase 3: composite consolidation (done).** `Modal` rebuilt on Radix Dialog (focus trap, scroll lock, inert background, Escape, focus return), and the bottom-sheet look on phones kept in CSS, so `kit/sheet` was not needed. `components/ui.tsx` split into `components/ui/{numbers,feedback,layout,overlays,forms}.tsx` behind `components/ui/index.ts`, so every `../components/ui` import is unchanged. Unused kit files (`dropdown-menu`, `select`, `sheet`) deleted; `npx shadcn add` restores any of them. `SectionTitle` already covers card headers, so `.card-title` was not pushed further.

**Phase 4: page sweeps and lock (done).** The remaining hand-rolled red/amber/green/zinc pairs and their `dark:` overrides (StartOfMonth, ScrapeButton, AgentChat, Cashflow, Categories, Fixed, Insights, Insurance, Pension, Settings and others) now use the tone tokens; the last arbitrary font sizes became `text-xl` and a `.code-inline` class; raw amounts in chart tooltips carry `.num`. Every rule's baseline is zero, so the design check (run by `npm --prefix web run typecheck`) fails on any new hit.

**Phase 5 (optional):** visible theme toggle (open question 2).

## Risks

- Phase 1 "no visual change" holds for light mode only by approximation (`zinc-500` vs `muted-foreground` differ slightly in hue). Accept it; verify with screenshots, not by assumption.
- Soft/strong tone values need contrast checks in both themes; pick them with a contrast tool, not by eye.
- `recharts` reads some colors as props, not CSS; any tone used in charts must be passed as `var(--token)` strings, which it supports.
- Not visually verified against live data: on this machine (Node 24.21) `npm run demo` and the API server crash natively at startup/exit (`node::RemoveEnvironmentCleanupHook` assertion), so only the empty shell could be seen. Fixing that, or pinning a Node version the native deps support, is a prerequisite for screenshot-based review in phases 1 and 2.
- The refresh changes layout on the Dashboard and transactions table, not just colors, so phase 2 is the one phase that needs real review with the people who use the app.

## Open questions

1. **Apple direction and the illustration layer.** Confirm on the mockup before phase 2: Apple-native structure, one blue tint plus status colors, opaque AA-checked text colors, the system font, and the outlined-vector illustrations limited to the hero, spot panels and empty states. Who draws the illustrations beyond the two in the mockup (hand-drawn SVG by the implementer, or commissioned) is open.
2. **Manual theme toggle?** D7 makes it cheap; does anyone in the household want it, or is OS-following enough?
3. **Sign color for amounts.** Today the transactions table colors every row amount by sign (`Transactions.tsx:273`, `<Money ... colored />`), so every expense is red; `Money colored` appears 22 times overall. The proposed rule (neutral amounts, color only when the sign is the message) is a product call worth confirming with the people who use it daily.
4. **Phone as primary?** If most use is on phones, phase 4 should also revisit table layouts (card-list fallback under `sm`) rather than only token cleanup.
5. **Data chat rendering.** `AgentChat` renders model output; should its markdown (tables, numbers) use the same `.table`/`.num` rules? Likely yes, but it is a separate surface with its own constraints.
