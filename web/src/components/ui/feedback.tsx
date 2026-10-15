import { type ReactNode } from 'react';

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

export function SeverityDot({ severity }: { severity: string }) {
  const color = severity === 'critical' ? 'bg-negative text-negative animate-pulse-dot' : severity === 'warning' ? 'bg-warning text-warning' : 'bg-info text-info';
  return <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />;
}
