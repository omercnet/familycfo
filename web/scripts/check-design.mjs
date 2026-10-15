#!/usr/bin/env node
/**
 * Design-system check for web/src (rules from docs/design-system-plan.md, "Rules").
 *
 *   node scripts/check-design.mjs            check: fail only if a rule has more hits than its baseline
 *   node scripts/check-design.mjs --report   list every hit (optionally: --report <rule-id>)
 *   node scripts/check-design.mjs --update   write the current counts as the new baseline
 *
 * A grep-style scanner over .ts/.tsx, not a parser: it reads class strings wherever they appear.
 * index.css and components/kit/ are out of scope (that is where tokens and Radix wrappers live).
 * Comment lines are skipped. Rule `amounts` is a heuristic (see its comment) and will miss
 * multi-line JSX. Exemptions go in ALLOW below, with a reason, not in the patterns.
 *
 * Rule `contrast` is different: it reads the token values in index.css (light block and the
 * `@variant dark` block) and measures every text/background pair in PAIRS below with the WCAG
 * formula. It has no baseline: any pair under its minimum fails the check.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(WEB, 'src');
const BASELINE = join(WEB, 'scripts', 'design-baseline.json');
const SKIP = [/^components\/kit\//, /^index\.css$/];

const PALETTE = 'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone';
const COLOR_UTIL = 'text|bg|border(?:-[xytbse])?|ring|ring-offset|outline|divide|fill|stroke|from|via|to|decoration|shadow|accent|caret|placeholder';
// a class token starts after whitespace, a quote, a backtick, `{`/`(`, or a variant's `:`
const START = '(?<![\\w\\-\\[/.#])';
// a directional suffix ends the token or continues with `-`
const END = '(?=$|[\\s"\'`}\\-:/\\])])';

const RULES = [
  {
    id: 'palette',
    title: 'raw Tailwind palette colors (use tokens: foreground, muted-foreground, positive, warning-soft...)',
    patterns: [new RegExp(`${START}-?(?:${COLOR_UTIL})-(?:${PALETTE})-\\d{2,3}(?:/\\d+)?(?![\\w])`, 'g')],
  },
  {
    id: 'font-size',
    title: 'arbitrary font sizes (use text-2xs/xs/sm/md/base/lg/xl/kpi)',
    patterns: [/(?<![\w-])text-\[(?:length:)?(?:[\d.]+(?:px|rem|em)|(?:calc|clamp|min|max)\()[^\]]*\]/g],
  },
  {
    id: 'direction',
    title: 'physical direction utilities (use ms/me/ps/pe/start/end/text-start/text-end, border-s/e, rounded-s/e)',
    patterns: [
      new RegExp(`${START}-?(?:ml|mr|pl|pr|left|right|scroll-m[lr]|scroll-p[lr])-[\\w.\\[\\]/()%-]+`, 'g'),
      new RegExp(`${START}(?:text|float|clear)-(?:left|right)${END}`, 'g'),
      // border-l / border-r[-n|-color] but not border-line / border-rose / border-red
      new RegExp(`${START}border-[lr]${END}[\\w.\\[\\]/-]*`, 'g'),
      new RegExp(`${START}rounded-(?:[lr]|tl|tr|bl|br)${END}[\\w.\\[\\]/-]*`, 'g'),
    ],
  },
  {
    id: 'dark-variant',
    title: '`dark:` variants (the dark decision belongs in the tokens)',
    patterns: [/(?<![\w-])dark:[^\s"'`]+/g],
  },
  {
    id: 'literal-color',
    title: 'hex/rgb/oklch literals or palette names (reference var(--token))',
    patterns: [
      /(?<![\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g,
      /(?<![\w-])(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/g,
      new RegExp(`${START}-?(?:${COLOR_UTIL})-(?:white|black)(?![\\w-])`, 'g'),
      /(?<![\w-])(?:white|black)(?![\w-])/g,
    ],
  },
  {
    // heuristic: a JSX `{money(...)}` on a line with no `num` class, or a <td> that holds a number
    // (`num` or <Money>) without text-end; an explicit text-start/center (a date column) is a choice
    id: 'amounts',
    title: 'amounts render through <Money> or carry .num; numeric table cells are text-end',
    patterns: [
      { re: /\{\s*money(?:In)?\(/g, unless: /\bnum\b|<Money/ },
      { re: /<td\b[^>]*\bnum\b[^>]*>/g, unless: /\btext-(?:end|start|center)\b/, within: true },
      { re: /<td\b[^>]*>\s*<Money\b/g, unless: /\btext-end\b/, within: true },
    ],
  },
];

/** Exemptions: rule + optional file (path under src/) + a regex on the hit and/or its line. */
const ALLOW = [
  { rule: 'literal-color', hit: /^(?:white|black)$/, line: /color-mix\(/, why: 'tinting toward white/black inside color-mix() (plan, rule 5)' },
  { rule: 'literal-color', file: 'lib/visuals.tsx', hit: /^text-white$/, why: 'initials on a filled member-color avatar (plan, rule 5)' },
  { rule: 'literal-color', file: 'pages/Settings.tsx', hit: /^#[0-9a-fA-F]{6}$/, line: /color/, why: 'member color data (default value of a color input), not styling' },
];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(e.name) ? [p] : [];
  });
}

function scan() {
  const hits = [];
  for (const abs of walk(SRC)) {
    const file = relative(SRC, abs).split('\\').join('/');
    if (SKIP.some(re => re.test(file)) || file.endsWith('.css')) continue;
    const lines = readFileSync(abs, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
      for (const rule of RULES) {
        for (const p of rule.patterns) {
          const { re, unless, within } = p instanceof RegExp ? { re: p } : p;
          re.lastIndex = 0;
          for (const m of line.matchAll(re)) {
            if (unless && unless.test(within ? m[0] : line)) continue;
            const text = m[0];
            if (ALLOW.some(a => a.rule === rule.id && (!a.file || a.file === file) && (!a.hit || a.hit.test(text)) && (!a.line || a.line.test(line)))) continue;
            hits.push({ rule: rule.id, file, line: i + 1, text: text.length > 60 ? `${text.slice(0, 57)}...` : text });
          }
        }
      }
    });
  }
  return hits;
}

// ---- contrast ----------------------------------------------------------------------------
// [foreground, background, minimum]. Text 4.5 (WCAG AA), marks / outlines / focus 3. A translucent
// value (rgba) is composited over the next background in the chain: the pair's background over
// --background, so glass and fills are measured as they render on the page. `fill@card` means
// the fill over a card (over the page).
const TEXT = 4.5, MARK = 3;
const SURFACES = ['background', 'card', 'popover'];
const PAIRS = [
  ...['foreground', 'muted-foreground'].flatMap(fg => [...SURFACES, 'muted', 'secondary'].map(bg => [fg, bg, TEXT])),
  ['secondary-foreground', 'secondary', TEXT],
  ['primary-foreground', 'primary', TEXT],
  ['destructive-foreground', 'destructive', TEXT],
  ['accent-foreground', 'accent', TEXT],
  ...['link', 'positive', 'negative', 'warning', 'info'].flatMap(fg => SURFACES.map(bg => [fg, bg, TEXT])),
  ...['positive', 'negative', 'warning', 'info'].flatMap(t => [[`${t}-strong`, `${t}-soft`, TEXT], [t, `${t}-soft`, MARK]]),
  ['sidebar-foreground', 'sidebar', TEXT],
  ['sidebar-muted', 'sidebar', TEXT],
  ['sidebar-foreground', 'sidebar-accent', TEXT],
  ['sidebar-primary', 'sidebar-accent', MARK],
  ['foreground', 'seg-selected', TEXT],
  ['muted-foreground', 'fill', TEXT], ['muted-foreground', 'fill@card', TEXT],
  ['foreground', 'fill-2', TEXT], ['foreground', 'fill-2@card', TEXT],
  ...SURFACES.map(bg => ['ring', bg, MARK]),
  ['input', 'background', MARK], ['input', 'card', MARK],
  ...Array.from({ length: 8 }, (_, i) => [`chart-${i + 1}`, 'card', MARK]),
];

function tokenBlocks() {
  const css = readFileSync(join(SRC, 'index.css'), 'utf8');
  const read = body => Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
  const light = read(css.match(/^:root \{([\s\S]*?)^\}/m)[1]);
  const dark = read(css.match(/@variant dark \{([\s\S]*?)\n {2}\}/)[1]);
  return { light, dark: { ...light, ...dark } };
}
function rgba(tokens, name, seen = []) {
  const v = tokens[name];
  if (v == null) throw new Error(`contrast: --${name} is not defined in index.css`);
  const ref = v.match(/^var\(--([\w-]+)\)$/);
  if (ref) return rgba(tokens, ref[1], [...seen, name]);
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)).concat(1);
  const fn = v.match(/^rgba?\(([^)]+)\)$/);
  if (fn) { const [r, g, b, a = 1] = fn[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [r, g, b, a]; }
  throw new Error(`contrast: can't read --${name}: ${v} (use #rrggbb, rgba() or var(--token))`);
}
const over = ([r, g, b, a], [R, G, B]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
function luminance([r, g, b]) {
  const lin = v => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastPairs() {
  const out = [];
  for (const [theme, tokens] of Object.entries(tokenBlocks())) {
    const page = rgba(tokens, 'background');
    for (const [fg, bg, min] of PAIRS) {
      const back = bg.split('@').reverse().reduce((under, name) => over(rgba(tokens, name), under), page);
      const front = over(rgba(tokens, fg), back);
      const [hi, lo] = [luminance(front), luminance(back)].sort((a, b) => b - a);
      out.push({ theme, fg, bg, min, ratio: (hi + 0.05) / (lo + 0.05) });
    }
  }
  return out;
}

const args = process.argv.slice(2);
const hits = scan();
const contrast = contrastPairs();
const lowContrast = contrast.filter(c => c.ratio < c.min);
const fmtPair = c => `${c.theme.padEnd(5)} --${c.fg} on --${c.bg}: ${c.ratio.toFixed(2)} (min ${c.min})`;
const counts = Object.fromEntries(RULES.map(r => [r.id, hits.filter(h => h.rule === r.id).length]));

if (args[0] === '--update') {
  writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
  console.log(`design: baseline written to ${relative(WEB, BASELINE)}`, counts);
  process.exit(0);
}

if (args[0] === '--report') {
  const only = args[1];
  if (!only || only === 'contrast') {
    console.log(`\ncontrast (${lowContrast.length} below minimum): token pairs from index.css`);
    for (const c of contrast) console.log(`  ${fmtPair(c)}${c.ratio < c.min ? '  FAIL' : ''}`);
  }
  for (const rule of RULES.filter(r => !only || r.id === only)) {
    const rs = hits.filter(h => h.rule === rule.id);
    console.log(`\n${rule.id} (${rs.length}): ${rule.title}`);
    for (const h of rs) console.log(`  ${h.file}:${h.line}  ${h.text}`);
  }
  process.exit(0);
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
let failed = false;
const rows = [];
for (const rule of RULES) {
  const now = counts[rule.id], base = baseline[rule.id] ?? 0;
  rows.push(`${rule.id.padEnd(14)} ${String(now).padStart(4)} / ${String(base).padStart(4)}${now > base ? '  INCREASED' : now < base ? '  (lower: run --update)' : ''}`);
  if (now <= base) continue;
  failed = true;
  const perFile = {};
  for (const h of hits.filter(h => h.rule === rule.id)) perFile[h.file] = (perFile[h.file] ?? 0) + 1;
  rows.push(`  ${rule.title}`);
  for (const [f, n] of Object.entries(perFile).sort((a, b) => b[1] - a[1])) rows.push(`    ${String(n).padStart(4)}  ${f}`);
  rows.push(`  list them: node scripts/check-design.mjs --report ${rule.id}`);
}
if (lowContrast.length) {
  failed = true;
  rows.push(`contrast: ${lowContrast.length} token pair(s) below minimum (node scripts/check-design.mjs --report contrast)`);
  for (const c of lowContrast) rows.push(`    ${fmtPair(c)}`);
}
if (failed) {
  console.error(`design check failed (hits / baseline):\n${rows.join('\n')}`);
  process.exit(1);
}
console.log(`design check ok (hits / baseline): ${RULES.map(r => `${r.id} ${counts[r.id]}/${baseline[r.id] ?? 0}`).join(', ')}; contrast ${contrast.length} pairs ok`);
