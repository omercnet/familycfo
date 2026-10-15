import { useId, type ComponentType, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLookups } from '../../state';
import { cn } from '@/lib/utils';
import { MemberAvatar } from '@/lib/visuals';

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
