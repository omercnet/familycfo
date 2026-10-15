import { useEffect, useMemo, useRef, type ComponentType, type ReactNode } from 'react';
import { animate, motion, useReducedMotion } from 'motion/react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { money } from '../../format';
import { cn } from '@/lib/utils';
import { duration, ease } from '@/lib/motion';
import { Sparkline } from '../charts';

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
