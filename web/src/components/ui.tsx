import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { animate, motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ChevronsUpDown, Plus, TrendingDown, TrendingUp, X } from 'lucide-react';
import { api, type Tag } from '../api';
import { money } from '../format';
import { useLookups } from '../state';
import { cn } from '@/lib/utils';
import { duration, ease } from '@/lib/motion';
import { accountIcon, categoryIcon, MemberAvatar } from '@/lib/visuals';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/kit/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/kit/command';
import { Sparkline } from './charts';

// ---- numbers ---------------------------------------------------------------------------

/** A number shown as-is on first view that glides when its value changes (no count-up from zero). */
export function AnimatedNumber({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const last = useRef(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || last.current === value) { el.textContent = format(value); last.current = value; return; }
    const controls = animate(last.current, value, {
      duration: duration.slow, ease: ease.out,
      onUpdate: v => { el.textContent = format(v); },
    });
    last.current = value;
    return () => controls.stop();
  }, [value, reduce, format]);
  return <span ref={ref} className={className}>{format(value)}</span>;
}

/**
 * An amount. `colored`: the sign is the message (net, delta), so negative is red and positive green.
 * `flow`: a row in a statement, where spending is not bad news: money in is green with a "+",
 * money out stays in the text color. With `cents` the agorot are set a step smaller.
 */
export function Money({ value, cents, colored, flow, animated, className = '' }: {
  value: number | null | undefined; cents?: boolean; colored?: boolean; flow?: boolean; animated?: boolean; className?: string;
}) {
  const color = value == null ? '' : value > 0 && (colored || flow) ? 'text-positive' : value < 0 && colored ? 'text-negative' : '';
  const fmt = useMemo(() => (n: number) => money(n, cents), [cents]);
  if (animated && value != null) return <AnimatedNumber value={value} format={fmt} className={`num ${color} ${className}`} />;
  const text = money(value, cents);
  const parts = cents && value != null ? /^(.*\d)([.,]\d{2})(.*)$/.exec(text) : null;
  return (
    <span className={`num ${color} ${className}`}>
      {flow && value != null && value > 0 && '+'}
      {parts ? <>{parts[1]}<span className="cents">{parts[2]}</span>{parts[3]}</> : text}
    </span>
  );
}

// ---- KPI cards -------------------------------------------------------------------------

type Tone = 'good' | 'bad' | 'warn';
const TONE_TEXT: Record<Tone, string> = { good: 'text-positive', bad: 'text-negative', warn: 'text-warning' };
const TONE_MARK: Record<Tone, string> = { good: 'var(--positive)', bad: 'var(--negative)', warn: 'var(--warning)' };

/**
 * KPI tile in the Health summary style: neutral title with a gray icon, a big rounded value,
 * an optional sparkline (in the tint, or the status color) and a supporting line with a delta chip.
 * `value` may be a number (money unless `format` is given) or any node. `color` and `index` are
 * accepted for existing call sites but no longer change anything (one tint, no staggered entry).
 */
export function Stat({ label, value, hint, tone, icon: Icon, spark, delta, format }: {
  label: string; value: ReactNode | number; hint?: ReactNode; tone?: Tone;
  icon?: ComponentType<{ className?: string }>; color?: string; spark?: number[];
  /** change vs a reference, as a fraction (0.12 = +12%); positiveIsGood flips the colouring */
  delta?: { value: number; label?: string; positiveIsGood?: boolean };
  index?: number;
  /** how a numeric value is shown (default: money) */
  format?: (n: number) => string;
}) {
  const deltaGood = delta ? (delta.value >= 0) === (delta.positiveIsGood ?? true) : false;
  return (
    <div className="card flex min-w-0 flex-col">
      <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold leading-5">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className={cn('min-w-0 font-rounded text-xl font-semibold leading-7 tracking-tight sm:text-kpi sm:leading-8', tone && TONE_TEXT[tone])}>
          {typeof value === 'number' ? (format ? <AnimatedNumber value={value} format={format} className="num" /> : <Money value={value} animated />) : value}
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} color={tone ? TONE_MARK[tone] : 'var(--chart-1)'} className="-mb-0.5 h-9 w-16 shrink-0 sm:w-24" />}
      </div>
      <div className="mt-auto pt-2">
        <div className="min-w-0 text-xs leading-relaxed text-muted-foreground">
          {delta && (
            <span className={cn('me-1.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold',
              deltaGood ? 'chip-positive' : 'chip-negative')}>
              {delta.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span className="num">{Math.abs(Math.round(delta.value * 100))}%</span>
            </span>
          )}
          {delta?.label && <span className="me-1">{delta.label}</span>}
          {hint}
        </div>
      </div>
    </div>
  );
}

export function Progress({ value, max, status, className }: { value: number; max: number; status?: string; className?: string }) {
  const pctValue = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = status === 'over' ? 'bg-negative' : status === 'warning' ? 'bg-warning' : 'bg-chart-1';
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-fill', className)} role="presentation">
      <motion.div className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }} whileInView={{ width: `${pctValue}%` }} viewport={{ once: true }}
        animate={{ width: `${pctValue}%` }} transition={{ duration: 0.8, ease: ease.out }} />
    </div>
  );
}

/** Placeholder while a query loads — appears only after a short delay so fast loads don't flash. */
export function Loading() {
  return (
    <div role="status" aria-live="polite" className="animate-delayed-in space-y-4">
      <span className="sr-only">טוען…</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="card space-y-3"><div className="skeleton h-3 w-20" /><div className="skeleton h-7 w-28" /><div className="skeleton h-3 w-32" /></div>
        ))}
      </div>
      <div className="card space-y-3">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-48 w-full" />
      </div>
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div role="alert" className="card bg-negative-soft text-sm text-negative-strong">
      שגיאה: {String((error as Error)?.message ?? error)}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="animate-rise-in rounded-(--radius-panel) border border-dashed border-input bg-card/60 px-6 py-8 text-center text-sm leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, icon: Icon }: { title: string; subtitle?: ReactNode; actions?: ReactNode; icon?: ComponentType<{ className?: string }> }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 md:mb-7">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="icon-tile hidden h-11 w-11 sm:inline-flex [&_svg]:h-5 [&_svg]:w-5">
            <Icon />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-[1.375rem] font-bold leading-8 tracking-tight md:text-kpi">{title}</h1>
          {subtitle && <p className="mt-0.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Card heading with a gray icon tile and an optional action on the end side (`color` is ignored: one tint). */
export function SectionTitle({ icon: Icon, children, action, as: As = 'span' }: {
  icon: ComponentType<{ className?: string }>; color?: string; children: ReactNode; action?: ReactNode; as?: 'span' | 'h2' | 'h3';
}) {
  return (
    <div className="card-title">
      <As className="flex min-w-0 items-center gap-2.5 text-[length:inherit] font-[inherit]">
        <span className="icon-tile h-7 w-7 [&_svg]:h-4 [&_svg]:w-4"><Icon /></span>
        <span className="min-w-0">{children}</span>
      </As>
      {action}
    </div>
  );
}

/** "See more" link for card headings (arrow points to the RTL end). */
export function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="btn-ghost group text-xs">
      {children}<ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
    </Link>
  );
}

export function MemberBadge({ id }: { id: number | null | undefined }) {
  const { member } = useLookups();
  const m = member(id);
  if (!m) return null;
  return (
    <span className="chip gap-1 ps-0.5">
      <MemberAvatar name={m.name} color={m.color} size={16} />
      {m.name}
    </span>
  );
}

export function SeverityDot({ severity }: { severity: string }) {
  const color = severity === 'critical' ? 'bg-negative text-negative animate-pulse-dot' : severity === 'warning' ? 'bg-warning text-warning' : 'bg-info text-info';
  return <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

/** Segmented control whose active pill slides between options. */
export function Segmented<T extends string | number | undefined>({ value, onChange, options, className, itemClassName }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: ComponentType<{ className?: string }> }[];
  className?: string; itemClassName?: string;
}) {
  const group = useId();
  return (
    <div className={cn('seg', className)} role="group">
      {options.map(o => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button key={String(o.value ?? 'all')} type="button" className={cn('seg-item', itemClassName)} aria-pressed={on} onClick={() => onChange(o.value)}>
            {on && <motion.span layoutId={`seg-${group}`} className="seg-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            {Icon && <Icon className="h-3.5 w-3.5 opacity-70" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Dialog. Centered on larger screens, a bottom sheet on phones. Escape and the backdrop close it,
 * focus stays inside while open and returns to where it was on close.
 */
export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!dialog.current?.contains(document.activeElement)) dialog.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      // an open picker inside the dialog closes first
      if (e.key === 'Escape') {
        if (document.querySelector('[data-radix-popper-content-wrapper]')) return;
        e.stopPropagation(); onCloseRef.current(); return;
      }
      if (e.key !== 'Tab' || !dialog.current) return;
      const items = [...dialog.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      returnTo?.focus?.({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <div className="animate-fade-in absolute inset-0 bg-(--scrim)" onClick={onClose} aria-hidden />
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`animate-dialog-in relative flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-t-(--radius-dialog) bg-popover shadow-(--shadow-overlay) outline-none
          sm:max-h-[min(88dvh,56rem)] sm:rounded-(--radius-dialog) ${wide ? 'sm:max-w-4xl' : 'sm:max-w-lg'}`}>
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30 sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-3 sm:px-6 sm:pt-5">
          <h2 id={titleId} className="min-w-0 break-words pt-1 text-base font-semibold leading-6 tracking-tight">{title}</h2>
          <button type="button" className="btn-ghost btn-icon -me-2 shrink-0" onClick={onClose} aria-label="סגור"><X /></button>
        </div>
        <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 sm:px-6 ${footer ? 'pb-5' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6'}`}>
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t bg-muted/60 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 max-sm:[&>*]:flex-1">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

// ---- pickers ---------------------------------------------------------------------------

export interface PickerOption {
  value: string;
  label: string;
  icon?: ReactNode;
  /** heading the option is listed under */
  group?: string;
  /** extra words that should find it in search */
  keywords?: string[];
  /** shown in the trigger instead of the label */
  short?: string;
}

/**
 * Modern dropdown: a button that opens a searchable list with icons and a check on the selected
 * option. `className` sizes the trigger the way the old `<select className="input …">` did.
 */
export function Picker({ value, onChange, options, placeholder = 'בחר…', className = 'input', searchable, searchPlaceholder = 'חיפוש…', disabled, align = 'start', style, 'aria-label': ariaLabel }: {
  value: string | null | undefined; onChange: (v: string | null) => void; options: PickerOption[]; placeholder?: string;
  className?: string; searchable?: boolean; searchPlaceholder?: string; disabled?: boolean; align?: 'start' | 'end' | 'center';
  style?: React.CSSProperties; 'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === (value ?? ''));
  const groups = useMemo(() => {
    const m = new Map<string, PickerOption[]>();
    for (const o of options) m.set(o.group ?? '', [...(m.get(o.group ?? '') ?? []), o]);
    return [...m.entries()];
  }, [options]);
  const withSearch = searchable ?? options.length > 8;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" role="combobox" aria-expanded={open} aria-label={ariaLabel} style={style}
          className={cn(className, 'group/picker flex items-center gap-2 text-start data-[state=open]:border-ring data-[state=open]:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)]')}>
          {selected?.icon && <span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">{selected.icon}</span>}
          <span className={cn('min-w-0 flex-1 truncate', !selected?.label && 'text-muted-foreground')}>
            {selected ? (selected.short ?? selected.label) : placeholder}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-45 transition-opacity group-hover/picker:opacity-80" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} sideOffset={6} className="w-[max(var(--radix-popover-trigger-width),14rem)] max-w-[calc(100vw-1.5rem)] overflow-hidden p-0">
        <Command dir="rtl" filter={(v, search, keywords) => ((`${v} ${keywords?.join(' ') ?? ''}`).toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          {withSearch && <CommandInput placeholder={searchPlaceholder} />}
          <CommandList className="max-h-72">
            <CommandEmpty>אין תוצאות</CommandEmpty>
            {groups.map(([group, items]) => (
              <CommandGroup key={group || '_'} heading={group || undefined}>
                {items.map(o => (
                  <CommandItem key={o.value || '_empty'} value={`${o.label} ${o.value}`} keywords={o.keywords}
                    onSelect={() => { onChange(o.value === '' ? null : o.value); setOpen(false); }}
                    className="gap-2">
                    {o.icon ? <span className="flex w-4 shrink-0 justify-center text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{o.icon}</span> : null}
                    <span className={cn('min-w-0 flex-1 truncate', o.value === '' && 'text-muted-foreground')}>{o.label}</span>
                    <Check className={cn('h-4 w-4 shrink-0 text-link transition-opacity', o.value === (value ?? '') ? 'opacity-100' : 'opacity-0')} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Numeric-id convenience wrapper over Picker. */
function IdPicker(props: Omit<Parameters<typeof Picker>[0], 'value' | 'onChange'> & { value: number | null | undefined; onChange: (id: number | null) => void }) {
  const { value, onChange, ...rest } = props;
  return <Picker {...rest} value={value == null ? '' : String(value)} onChange={v => onChange(v ? Number(v) : null)} />;
}

const iconOf = (Icon: ComponentType<{ className?: string }>, color?: string) => <Icon className={color} />;

export function CategorySelect({ value, onChange, allowEmpty = true, className = 'input', emptyLabel = 'ללא קטגוריה', onlyTopLevel = false, exclude }: {
  value: number | null | undefined; onChange: (id: number | null) => void; allowEmpty?: boolean; className?: string;
  emptyLabel?: string; onlyTopLevel?: boolean; exclude?: number;
}) {
  const { meta } = useLookups();
  const options = useMemo(() => {
    const cats = (meta?.categories ?? []).filter(c => c.id !== exclude);
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'he');
    const children = (id: number) => cats.filter(c => c.parentId === id).sort(byName);
    const tops = cats.filter(c => c.parentId == null).sort(byName);
    const opt = (c: { id: number; name: string }, group?: string, label = c.name, parentName?: string): PickerOption => ({
      value: String(c.id), label, group, short: label, keywords: parentName ? [parentName] : undefined,
      icon: iconOf(categoryIcon(parentName ? `${c.name} ${parentName}` : c.name)),
    });
    const out: PickerOption[] = allowEmpty ? [{ value: '', label: emptyLabel }] : [];
    if (onlyTopLevel) return [...out, ...tops.map(c => opt(c))];
    const parents = tops.filter(c => children(c.id).length);
    const standalone = tops.filter(c => !children(c.id).length);
    for (const p of parents) {
      out.push(opt(p, p.name, `${p.name} (כללי)`));
      for (const c of children(p.id)) out.push(opt(c, p.name, c.name, p.name));
    }
    for (const c of standalone) out.push(opt(c, parents.length ? 'שאר הקטגוריות' : undefined));
    return out;
  }, [meta, exclude, allowEmpty, emptyLabel, onlyTopLevel]);
  return <IdPicker className={className} value={value} onChange={onChange} options={options} searchable searchPlaceholder="חיפוש קטגוריה…" placeholder={emptyLabel} />;
}

export function MemberSelect({ value, onChange, emptyLabel = 'לפי בעל החשבון', className = 'input' }: {
  value: number | null | undefined; onChange: (id: number | null) => void; emptyLabel?: string; className?: string;
}) {
  const { meta } = useLookups();
  const options: PickerOption[] = [
    { value: '', label: emptyLabel },
    ...(meta?.members ?? []).map(m => ({ value: String(m.id), label: m.name, icon: <MemberAvatar name={m.name} color={m.color} size={18} /> })),
  ];
  return <IdPicker className={className} value={value} onChange={onChange} options={options} searchable={false} placeholder={emptyLabel} />;
}

export function BusinessSelect({ value, onChange, className = 'input' }: {
  value: number | null | undefined; onChange: (id: number | null) => void; className?: string;
}) {
  const { meta } = useLookups();
  const BizIcon = categoryIcon('עסק');
  const options: PickerOption[] = [
    { value: '', label: 'פרטי (לא עסקי)', short: 'פרטי' },
    ...(meta?.businesses ?? []).filter(b => !b.archived).map(b => ({ value: String(b.id), label: b.name, icon: <BizIcon /> })),
  ];
  return <IdPicker className={className} value={value} onChange={onChange} options={options} placeholder="פרטי" />;
}

export function AccountSelect({ value, onChange, kind, emptyLabel = 'בחר חשבון', className = 'input' }: {
  value: string | null | undefined; onChange: (id: string | null) => void; kind?: 'bank' | 'card'; emptyLabel?: string; className?: string;
}) {
  const { meta } = useLookups();
  const options: PickerOption[] = [
    { value: '', label: emptyLabel },
    ...(meta?.accounts ?? []).filter(a => !kind || a.kind === kind).map(a => {
      const Icon = accountIcon(a.kind);
      return { value: a.id, label: a.displayName ?? a.id, keywords: [a.id, a.company], group: kind ? undefined : a.kind === 'bank' ? 'חשבונות בנק' : 'כרטיסים', icon: <Icon /> };
    }),
  ];
  return <Picker className={className} value={value ?? ''} onChange={onChange} options={options} placeholder={emptyLabel} searchPlaceholder="חיפוש חשבון…" />;
}

export function TagPicker({ value, onChange }: { value: number[]; onChange: (ids: number[]) => void }) {
  const { meta } = useLookups();
  const tags = meta?.tags.filter(t => !t.archived || value.includes(t.id)) ?? [];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map(t => {
        const on = value.includes(t.id);
        return (
          <motion.button key={t.id} type="button" layout whileTap={{ scale: 0.92 }}
            onClick={() => onChange(on ? value.filter(x => x !== t.id) : [...value, t.id])}
            className={cn('chip min-h-7 border px-2', on ? 'border-primary/40 bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : 'border-transparent')}>
            {on ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3 opacity-60" />}
            #{t.name}
          </motion.button>
        );
      })}
      <NewTagInput onCreated={t => onChange([...value, t.id])} />
    </div>
  );
}

/** Inline "+ new tag" — creates the tag (event) and hands it back. */
export function NewTagInput({ onCreated, placeholder = '+ תגית חדשה' }: { onCreated: (tag: Tag) => void; placeholder?: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: (n: string) => api.post<Tag>('/tags', { name: n }),
    onSuccess: tag => {
      qc.invalidateQueries({ queryKey: ['meta'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      setName('');
      onCreated(tag);
    },
  });
  return (
    <input className="input w-36 py-0.5 text-xs" placeholder={placeholder} value={name} onChange={e => setName(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { e.preventDefault(); create.mutate(name.trim()); } }} />
  );
}

