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

const args = process.argv.slice(2);
const hits = scan();
const counts = Object.fromEntries(RULES.map(r => [r.id, hits.filter(h => h.rule === r.id).length]));

if (args[0] === '--update') {
  writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
  console.log(`design: baseline written to ${relative(WEB, BASELINE)}`, counts);
  process.exit(0);
}

if (args[0] === '--report') {
  const only = args[1];
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
if (failed) {
  console.error(`design check failed (hits / baseline):\n${rows.join('\n')}`);
  process.exit(1);
}
console.log(`design check ok (hits / baseline): ${RULES.map(r => `${r.id} ${counts[r.id]}/${baseline[r.id] ?? 0}`).join(', ')}`);
