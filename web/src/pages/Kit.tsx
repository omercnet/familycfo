import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Bell, Info, Palette, Plus, Shapes, Trash2, Type, Wallet } from 'lucide-react';
import {
  Empty, ErrorBox, Field, Loading, Modal, Money, MoreLink, PageHeader, Picker, Progress, SectionTitle, Segmented, SeverityDot, Stat,
} from '../components/ui';
import { BarList, DonutChart, Gauge, Legend, Sparkline } from '../components/charts';
import { categoryIcon, MemberAvatar } from '@/lib/visuals';

/**
 * Living reference of the design system (route /kit, not in the nav). Static sample data only,
 * so it renders without a database. Open it in light and dark before and after a design change.
 */

type Theme = 'system' | 'light' | 'dark';

/** Forces a theme while the page is open (sets <html data-theme>); leaving the page restores the OS default. */
function useForcedTheme(theme: Theme) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);
  useEffect(() => () => { delete document.documentElement.dataset.theme; }, []);
}

/** Bumps when the effective theme may have changed, so computed colors are re-read. */
function useThemeVersion(theme: Theme) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const bump = () => requestAnimationFrame(() => setV(n => n + 1));
    bump();
    mq.addEventListener('change', bump);
    return () => mq.removeEventListener('change', bump);
  }, [theme]);
  return v;
}

/** The sRGB bytes a CSS color paints as (any color syntax the browser knows). */
function paint(color: string): [number, number, number] {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.fillStyle = color;
  x.fillRect(0, 0, 1, 1);
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}
function luminance([r, g, b]: [number, number, number]) {
  const lin = (v: number) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(fg: string, bg: string) {
  const [a, b] = [luminance(paint(fg)), luminance(paint(bg))].sort((p, q) => q - p);
  return (a + 0.05) / (b + 0.05);
}
/** Resolved value of a custom property on <html>. */
const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// ---- sample data ---------------------------------------------------------------------------

const TOKENS: { title: string; names: string[] }[] = [
  { title: 'משטחים וטקסט', names: ['background', 'foreground', 'card', 'popover', 'muted', 'muted-foreground', 'secondary', 'secondary-foreground', 'accent', 'accent-foreground'] },
  { title: 'פעולה ומסגרות', names: ['primary', 'primary-foreground', 'destructive', 'border', 'input', 'ring'] },
  { title: 'גרפים', names: ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6', 'chart-7', 'chart-8'] },
  { title: 'סרגל צד', names: ['sidebar', 'sidebar-foreground', 'sidebar-muted', 'sidebar-accent', 'sidebar-border', 'sidebar-primary'] },
];

const TONES = [
  { tone: 'positive', label: 'חיובי', example: 'נשאר עודף החודש', icon: Wallet },
  { tone: 'negative', label: 'שלילי', example: 'חריגה מהתקציב', icon: AlertTriangle },
  { tone: 'warning', label: 'אזהרה', example: 'היתרה לא עודכנה 5 ימים', icon: Bell },
  { tone: 'info', label: 'מידע', example: 'חיוב כרטיס צפוי ב-10 לחודש', icon: Info },
] as const;

const TYPE_SCALE = [
  { cls: 'text-2xs', px: 11, use: 'מטא בטבלה, צירי גרף, כיתובים' },
  { cls: 'text-xs', px: 12, use: 'תוויות, כותרות עמודה, צ׳יפים' },
  { cls: 'text-sm', px: 14, use: 'גוף (ברירת המחדל), טבלאות, כפתורים' },
  { cls: 'text-md', px: 15, use: 'כותרות כרטיס' },
  { cls: 'text-lg', px: 18, use: 'כותרות משנה' },
  { cls: 'text-xl', px: 20, use: 'ערך KPI בטלפון' },
  { cls: 'text-kpi', px: 26, use: 'ערכי KPI' },
] as const;

const SPARK = [12, 14, 13, 17, 16, 19, 22, 21, 24];
const PICKER_OPTIONS = ['סופרמרקט', 'מסעדות', 'דלק', 'ביטוח', 'חינוך'].map(name => {
  const Icon = categoryIcon(name);
  return { value: name, label: name, icon: <Icon /> };
});
const ROWS = [
  { date: '2026-10-12', desc: 'שופרסל דיל', category: 'סופרמרקט', amount: -412.9 },
  { date: '2026-10-10', desc: 'משכורת', category: 'הכנסה', amount: 18450 },
  { date: '2026-10-08', desc: 'פז דלק', category: 'דלק', amount: -286 },
];

// ---- page ----------------------------------------------------------------------------------

export default function Kit() {
  const [theme, setTheme] = useState<Theme>('system');
  useForcedTheme(theme);
  const version = useThemeVersion(theme);
  const [seg, setSeg] = useState<'month' | 'year'>('month');
  const [picked, setPicked] = useState<string | null>('דלק');
  const [modal, setModal] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader title="מערכת העיצוב" icon={Palette}
        subtitle="טוקנים, סולם טיפוגרפיה, מחלקות בסיס ורכיבים מורכבים. לא מקושר מהתפריט; נתוני דוגמה בלבד."
        actions={<Segmented value={theme} onChange={setTheme}
          options={[{ value: 'system', label: 'לפי המערכת' }, { value: 'light', label: 'בהיר' }, { value: 'dark', label: 'כהה' }]} />} />

      <Section icon={Palette} title="טוקנים" note="שמות shadcn הם הקנוניים: bg-card, text-muted-foreground, border-border…">
        <div className="space-y-5">
          {TOKENS.map(g => (
            <div key={g.title}>
              <div className="mb-2 text-xs font-medium text-muted-foreground">{g.title}</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {g.names.map(n => <Swatch key={n} name={n} version={version} />)}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={AlertTriangle} title="גווני סטטוס" note="--{tone} לסימנים ופסים, -soft לרקע, -strong לטקסט על הרקע. היחס מחושב בזמן אמת (AA = 4.5).">
        <div className="grid gap-3 md:grid-cols-2">
          {TONES.map(t => <ToneRow key={t.tone} {...t} version={version} />)}
        </div>
      </Section>

      <Section icon={Type} title="טיפוגרפיה" note="גוף 14px. משקלים: 400 גוף, 500 תוויות ופקדים, 600 כותרות, 700 ערכי KPI בלבד.">
        <div className="divide-y divide-border">
          {TYPE_SCALE.map(s => (
            <div key={s.cls} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-2.5">
              <code className="num w-24 shrink-0 text-xs text-muted-foreground">{s.cls} · {s.px}px</code>
              <span className={`${s.cls} min-w-0 flex-1`}>
                הוצאות החודש <Money value={11035} className={s.cls === 'text-kpi' ? 'font-bold' : ''} />
              </span>
              <span className="text-xs text-muted-foreground">{s.use}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-md">
          <span className="font-normal">400 גוף</span>
          <span className="font-medium">500 תווית</span>
          <span className="font-semibold">600 כותרת</span>
          <span className="font-bold">700 ערך</span>
        </div>
      </Section>

      <Section icon={Shapes} title="מחלקות בסיס" note="אלמנטים בלי התנהגות: CSS ב-index.css, משתמשים בהם ישירות ב-className.">
        <div className="space-y-6">
          <Demo label=".btn · .btn-primary · .btn-danger · .btn-ghost · .btn-sm · .btn-icon">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn">רגיל</button>
              <button type="button" className="btn btn-primary"><Plus />הוספה</button>
              <button type="button" className="btn btn-danger"><Trash2 />מחיקה</button>
              <button type="button" className="btn-ghost">שקוף</button>
              <button type="button" className="btn btn-sm">קטן</button>
              <button type="button" className="btn btn-icon" aria-label="הוספה"><Plus /></button>
              <button type="button" className="btn-ghost btn-icon" aria-label="מחיקה"><Trash2 /></button>
              <button type="button" className="btn" disabled>מושבת</button>
              <button type="button" className="btn btn-primary" disabled>מושבת</button>
            </div>
          </Demo>

          <Demo label=".label · .input · textarea.input · date · checkbox">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block"><span className="label">תיאור</span><input className="input" placeholder="למשל: סופר" /></label>
              <label className="block"><span className="label">תאריך</span><input className="input" type="date" defaultValue="2026-10-15" /></label>
              <label className="block"><span className="label">מושבת</span><input className="input" disabled value="לא ניתן לעריכה" readOnly /></label>
              <label className="block"><span className="label">הערה</span><textarea className="input" rows={1} defaultValue="שורה אחת" /></label>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" defaultChecked />מסומן</label>
              <label className="flex items-center gap-2"><input type="checkbox" />לא מסומן</label>
              <label className="flex items-center gap-2"><input type="checkbox" disabled />מושבת</label>
            </div>
          </Demo>

          <Demo label=".chip · .seg (סימון ידני) · .num · .skeleton · .icon-tile">
            <div className="flex flex-wrap items-center gap-3">
              <span className="chip">צ׳יפ</span>
              <button type="button" className="chip">צ׳יפ לחיץ</button>
              <div className="seg" role="group">
                <button type="button" className="seg-item" aria-pressed="true">חודש</button>
                <button type="button" className="seg-item" aria-pressed="false">שנה</button>
              </div>
              <span className="num">1,234.50</span>
              <div className="skeleton h-4 w-24" />
              {(['primary', 'positive', 'negative', 'warning', 'info'] as const).map(t => (
                <span key={t} className="icon-tile" style={{ ['--tile' as string]: `var(--${t})` }}><Wallet /></span>
              ))}
            </div>
          </Demo>

          <Demo label=".card · .card-hover · .card-title">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="card"><div className="card-title">כרטיס<span className="text-xs font-normal text-muted-foreground">פעולה</span></div>תוכן הכרטיס.</div>
              <div className="card card-hover"><div className="card-title">כרטיס מגיב</div>מרחף מעליו מרים אותו.</div>
            </div>
          </Demo>

          <Demo label=".table (עמודות מספריות: .num + text-end) · .scroll-x">
            <div className="card p-0">
              <div className="scroll-x">
                <table className="table min-w-[32rem]">
                  <thead><tr><th>תאריך</th><th>תיאור</th><th>קטגוריה</th><th className="text-end">סכום</th></tr></thead>
                  <tbody>
                    {ROWS.map(r => (
                      <tr key={r.desc}>
                        <td className="num text-start text-muted-foreground">{r.date}</td>
                        <td>{r.desc}</td>
                        <td><span className="chip">{r.category}</span></td>
                        <td className="text-end"><Money value={r.amount} cents /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Demo>

          <Demo label="details > summary">
            <details><summary className="text-sm text-muted-foreground">פרטים נוספים</summary><p className="mt-2 text-sm">תוכן נפתח.</p></details>
          </Demo>
        </div>
      </Section>

      <Section icon={Shapes} title="רכיבים מורכבים" note="components/ui.tsx ו-components/charts.tsx.">
        <div className="space-y-6">
          <Demo label="<Stat> · tone good / bad / warn · delta · spark">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="יתרה בבנקים" value={24680} icon={Wallet} spark={SPARK} />
              <Stat label="עודף חודשי" value={14504} tone="good" icon={Wallet} delta={{ value: 0.12, label: 'מול חודש קודם' }} index={1} />
              <Stat label="חריגה" value={-1030} tone="bad" icon={AlertTriangle} delta={{ value: 0.08, positiveIsGood: false }} index={2} />
              <Stat label="ממתין לסיווג" value={7} tone="warn" icon={Bell} format={n => String(Math.round(n))} hint="תנועות" index={3} />
            </div>
          </Demo>

          <Demo label="<Money> · colored · cents · בתוך משפט">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
              <Money value={1234} />
              <Money value={1234.5} cents />
              <Money value={-860} colored />
              <Money value={2400} colored />
              <Money value={null} />
              <span>נשאר לך <Money value={3250} /> עד סוף החודש, אחרי <Money value={-412.9} cents /> בסופר.</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">צבע לפי סימן רק כשהסימן הוא המסר (תזרים נטו, שינוי, יתרה). הוצאה רגילה אינה &quot;רעה&quot;.</p>
          </Demo>

          <Demo label="<Progress> · ok / warning / over">
            <div className="grid gap-3 sm:grid-cols-3">
              <Progress value={40} max={100} />
              <Progress value={85} max={100} status="warning" />
              <Progress value={120} max={100} status="over" />
            </div>
          </Demo>

          <Demo label="<Segmented> · <Field> + <Picker> · <Modal>">
            <div className="flex flex-wrap items-end gap-3">
              <Segmented value={seg} onChange={setSeg} options={[{ value: 'month', label: 'חודש' }, { value: 'year', label: 'שנה' }]} />
              <div className="w-56"><Field label="קטגוריה"><Picker value={picked} onChange={setPicked} options={PICKER_OPTIONS} /></Field></div>
              <button type="button" className="btn" onClick={() => setModal(true)}>פתיחת חלון</button>
            </div>
            {modal && (
              <Modal title="חלון לדוגמה" onClose={() => setModal(false)}
                footer={<><button type="button" className="btn" onClick={() => setModal(false)}>ביטול</button><button type="button" className="btn btn-primary" onClick={() => setModal(false)}>שמירה</button></>}>
                <Field label="שם"><input className="input" defaultValue="דוגמה" /></Field>
              </Modal>
            )}
          </Demo>

          <Demo label="<SectionTitle> · <MoreLink> · <SeverityDot> · <MemberAvatar>">
            <div className="card">
              <SectionTitle icon={Bell} color="var(--warning)" action={<MoreLink to="/insights">הכל</MoreLink>}>התראות</SectionTitle>
              <ul className="space-y-2 text-sm">
                {(['critical', 'warning', 'info'] as const).map(s => <li key={s} className="flex gap-2"><SeverityDot severity={s} />{s}</li>)}
              </ul>
              <div className="mt-3 flex gap-2">
                {['דנה', 'יואב', 'משותף'].map((n, i) => <MemberAvatar key={n} name={n} color={`var(--chart-${i + 1})`} size={24} />)}
              </div>
            </div>
          </Demo>

          <Demo label="<Empty> · <ErrorBox> · <Loading>">
            <div className="grid gap-3 md:grid-cols-2">
              <Empty>אין עדיין נתונים לתקופה הזו.</Empty>
              <ErrorBox error={new Error('Bad Gateway')} />
            </div>
            <div className="mt-3"><LoadingOnce /></div>
          </Demo>

          <Demo label="charts: <Sparkline> · <Gauge> · <BarList> · <Legend> · <DonutChart>">
            <div className="grid items-center gap-4 md:grid-cols-3">
              <div className="space-y-3">
                <Sparkline data={SPARK} className="h-10 w-40" />
                <Sparkline data={[...SPARK].reverse()} color="var(--negative)" className="h-10 w-40" />
                <Legend items={[{ label: 'הכנסות', color: 'var(--chart-2)' }, { label: 'קבועות', color: 'var(--chart-1)' }, { label: 'נטו', color: 'var(--negative)', line: true }]} />
              </div>
              <div className="flex justify-center gap-3">
                <Gauge value={62} max={100} label="62%" sub="מהתקציב" size={110} />
                <Gauge value={104} max={100} label="104%" sub="חריגה" size={110} status="over" />
              </div>
              <BarList items={[
                { key: 'a', label: 'סופרמרקט', value: 2512 },
                { key: 'b', label: 'רכב ותחבורה', value: 1998, color: 'var(--chart-3)' },
                { key: 'c', label: 'מסעדות', value: 779, color: 'var(--chart-4)' },
              ]} />
            </div>
            <div className="mt-4 max-w-sm">
              <DonutChart centerLabel="הוצאות" height={200} data={[
                { key: '1', name: 'משכנתא', value: 5200 }, { key: '2', name: 'סופר', value: 2512 },
                { key: '3', name: 'רכב', value: 1998 }, { key: '4', name: 'חינוך', value: 368 },
              ]} />
            </div>
          </Demo>
        </div>
      </Section>

      <Section icon={Info} title="כללים" note="נאכפים ב-web/scripts/check-design.mjs (חלק מ-npm --prefix web run typecheck).">
        <ul className="list-disc space-y-1.5 ps-5 text-sm">
          <li>צבעים רק מטוקנים: <code className="text-xs">text-muted-foreground</code>, <code className="text-xs">bg-warning-soft text-warning-strong</code>; לא צבעי פלטה גולמיים (zinc, rose, amber…).</li>
          <li>גדלי טקסט רק מהסולם (<code className="text-xs">text-2xs</code> … <code className="text-xs">text-kpi</code>), לא ערכים שרירותיים.</li>
          <li>כיוון לוגי בלבד: <code className="text-xs">ms/me/ps/pe</code>, <code className="text-xs">start/end</code>, <code className="text-xs">text-start/text-end</code>.</li>
          <li>בלי הווריאנט dark של Tailwind; ההחלטה על מצב כהה נמצאת בטוקנים.</li>
          <li>סכומים דרך <code className="text-xs">&lt;Money&gt;</code> או עם <code className="text-xs">.num</code> (ספרות טבלאיות, בידוד LTR); עמודות מספריות <code className="text-xs">text-end</code>.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {TONES.map(t => (
            <span key={t.tone} className={`chip ${TONE_CLASSES[t.tone]}`}>{t.label}</span>
          ))}
        </div>
      </Section>
    </div>
  );
}

// spelled out so Tailwind sees every class
const TONE_CLASSES: Record<(typeof TONES)[number]['tone'], string> = {
  positive: 'bg-positive-soft text-positive-strong',
  negative: 'bg-negative-soft text-negative-strong',
  warning: 'bg-warning-soft text-warning-strong',
  info: 'bg-info-soft text-info-strong',
};

function Section({ icon, title, note, children }: { icon: Parameters<typeof SectionTitle>[0]['icon']; title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <SectionTitle icon={icon} as="h2">{title}</SectionTitle>
      {note && <p className="-mt-2 mb-4 text-xs text-muted-foreground">{note}</p>}
      {children}
    </section>
  );
}

function Demo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 font-mono text-2xs text-muted-foreground" dir="ltr">{label}</div>
      {children}
    </div>
  );
}

function Swatch({ name, version }: { name: string; version: number }) {
  const value = useMemo(() => cssVar(`--${name}`), [name, version]); // version: re-read after a theme change
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border">
      <div className="h-10 border-b border-border" style={{ background: `var(--${name})` }} />
      <div className="px-2 py-1.5">
        <div className="truncate text-xs font-medium" dir="ltr">{name}</div>
        <div className="truncate font-mono text-2xs text-muted-foreground" dir="ltr" title={value}>{value}</div>
      </div>
    </div>
  );
}

function ToneRow({ tone, label, example, icon: Icon, version }: (typeof TONES)[number] & { version: number }) {
  const [ratios, setRatios] = useState<{ soft: number; card: number } | null>(null);
  useEffect(() => {
    setRatios({
      soft: contrast(cssVar(`--${tone}-strong`), cssVar(`--${tone}-soft`)),
      card: contrast(cssVar(`--${tone}-strong`), cssVar('--card')),
    });
  }, [tone, version]);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: `var(--${tone})` }} />
      <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-sm ${TONE_CLASSES[tone]}`}>
        <Icon className="h-4 w-4 shrink-0" style={{ color: `var(--${tone})` }} />
        <span className="font-semibold">{label}</span>
        <span className="min-w-0 truncate">{example}</span>
      </div>
      <div className="w-24 shrink-0 text-end text-2xs leading-4 text-muted-foreground">
        <div dir="ltr">{tone}</div>
        {ratios && <div className="num" title="strong על soft · strong על card">{ratios.soft.toFixed(1)} · {ratios.card.toFixed(1)}</div>}
      </div>
    </div>
  );
}

/** <Loading> renders after a short delay; replay it on demand. */
function LoadingOnce() {
  const [key, setKey] = useState(0);
  return (
    <div>
      <button type="button" className="btn btn-sm mb-2" onClick={() => setKey(k => k + 1)}>הצגה מחדש</button>
      <Loading key={key} />
    </div>
  );
}
