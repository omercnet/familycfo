import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  ArrowLeftRight, ChartColumn, Bell, Briefcase, CalendarCheck, Home, Layers, LayoutDashboard, Lightbulb, Menu, PieChart,
  ChartCandlestick, Settings2, ShieldCheck, Tags, TrendingUp, Umbrella, Wallet, X, type LucideIcon,
} from 'lucide-react';
import { api, type Alert } from './api';
import { useFilters, useMeta } from './state';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Cashflow from './pages/Cashflow';
import Businesses from './pages/Businesses';
import Savings from './pages/Savings';
import Loans from './pages/Loans';
import Insights from './pages/Insights';
import Settings from './pages/Settings';
import Events from './pages/Events';
import Categories from './pages/Categories';
import Fixed from './pages/Fixed';
import Trends from './pages/Trends';
import Insurance from './pages/Insurance';
import Pension from './pages/Pension';
import Investments from './pages/Investments';
import Kit from './pages/Kit';
import { Picker, Segmented } from './components/ui';
import { AgentChat } from './components/AgentChat';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/kit/tooltip';
import { MemberAvatar } from '@/lib/visuals';
import { cn } from '@/lib/utils';

type NavItem = { to: string; label: string; icon: LucideIcon };
/** Sidebar sections, in the System Settings pattern (headings hide in the icon rail). */
const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: 'החודש', items: [
    { to: '/', label: 'סקירה', icon: LayoutDashboard },
    { to: '/transactions', label: 'תנועות', icon: ArrowLeftRight },
    { to: '/fixed', label: 'קבועות החודש', icon: CalendarCheck },
    { to: '/budgets', label: 'תקציב', icon: PieChart },
    { to: '/cashflow', label: 'תזרים ותחזית', icon: TrendingUp },
  ] },
  { title: 'תכנון', items: [
    { to: '/trends', label: 'מגמות הוצאות', icon: ChartColumn },
    { to: '/insights', label: 'תובנות והתראות', icon: Lightbulb },
    { to: '/events', label: 'אירועים ותגיות', icon: Tags },
    { to: '/savings', label: 'חסכונות והון', icon: Wallet },
    { to: '/businesses', label: 'עסקים', icon: Briefcase },
  ] },
  { title: 'לטווח ארוך', items: [
    { to: '/investments', label: 'השקעות', icon: ChartCandlestick },
    { to: '/pension', label: 'פנסיה וגמל', icon: Umbrella },
    { to: '/loans', label: 'הלוואות ומשכנתא', icon: Home },
    { to: '/insurance', label: 'ביטוחים', icon: ShieldCheck },
  ] },
  { title: 'הגדרות', items: [
    { to: '/categories', label: 'קטגוריות', icon: Layers },
    { to: '/settings', label: 'הגדרות', icon: Settings2 },
  ] },
];
const NAV = NAV_SECTIONS.flatMap(s => s.items);

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    cb => { const m = window.matchMedia(query); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function FilterBar() {
  const { filters, setFilters } = useFilters();
  const { data: meta } = useMeta();
  if (!meta) return <div className="h-9" aria-hidden />;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented value={filters.memberId} onChange={memberId => setFilters({ ...filters, memberId })}
        className="max-md:flex max-md:w-full max-md:flex-nowrap max-md:[&>*]:flex-1 max-md:[&>*]:px-2"
        options={[
          { value: undefined as number | undefined, label: 'כל הבית' },
          ...meta.members.map(m => ({ value: m.id as number | undefined, label: <><MemberAvatar name={m.name} color={m.color} size={18} />{m.name}</> })),
        ]} />
      {meta.businesses.length > 0 && (
        <Picker className="input w-auto min-w-36 max-md:min-w-0 max-md:flex-1" aria-label="עסק"
          value={filters.businessId != null ? String(filters.businessId) : ''}
          onChange={v => setFilters({ ...filters, businessId: v ? Number(v) : undefined })}
          options={[{ value: '', label: 'כל העסקים', icon: <Briefcase /> }, ...meta.businesses.map(b => ({ value: String(b.id), label: b.name, icon: <Briefcase /> }))]} />
      )}
      {meta.tags.length > 0 && (
        <Picker className="input w-auto min-w-32 max-md:min-w-0 max-md:flex-1" aria-label="תגית" value="" placeholder="+ תגית" searchPlaceholder="חיפוש תגית…"
          onChange={v => v && setFilters({ ...filters, tagIds: [...new Set([...filters.tagIds, Number(v)])] })}
          options={[{ value: '', label: '+ תגית', icon: <Tags /> }, ...meta.tags.filter(t => !filters.tagIds.includes(t.id)).map(t => ({ value: String(t.id), label: `#${t.name}`, icon: <Tags /> }))]} />
      )}
      {filters.tagIds.map(id => (
        <motion.button key={id} type="button" layout initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
          className="chip min-h-7 gap-1.5 bg-accent px-2 text-accent-foreground hover:bg-accent"
          onClick={() => setFilters({ ...filters, tagIds: filters.tagIds.filter(x => x !== id) })}>
          #{meta.tags.find(t => t.id === id)?.name}
          <X className="h-3 w-3 opacity-70" />
        </motion.button>
      ))}
    </div>
  );
}

function BrandMark() {
  return (
    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fill-2 font-rounded text-sm font-semibold">
      ₪
    </span>
  );
}

function AlertsBell({ unseen }: { unseen: number }) {
  return (
    <Link to="/insights" aria-label="התראות" className="btn-ghost btn-icon relative text-muted-foreground">
      <motion.span animate={unseen ? { rotate: [0, -14, 12, -8, 0] } : {}} transition={{ duration: 0.9, delay: 0.6 }} className="inline-flex">
        <Bell className="h-[1.15rem] w-[1.15rem]" />
      </motion.span>
      {unseen > 0 && (
        <span className="num absolute end-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-semibold text-destructive-foreground ring-2 ring-background">
          {unseen}
        </span>
      )}
    </Link>
  );
}

export default function App() {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  const isTabletUp = useMediaQuery('(min-width: 768px)');
  const isRail = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const { data: alerts } = useQuery({ queryKey: ['alerts', 'open'], queryFn: () => api.get<Alert[]>('/alerts') });
  const unseen = alerts?.filter(a => !a.seenAt).length ?? 0;
  const drawerMode = !isTabletUp;
  const current = NAV.find(n => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)));

  useEffect(() => { if (isTabletUp) setNavOpen(false); }, [isTabletUp]);

  useEffect(() => {
    if (!navOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer.current?.querySelector<HTMLElement>('a[aria-current="page"], a')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
      if (e.key === 'Tab' && drawer.current) {
        const items = [...drawer.current.querySelectorAll<HTMLElement>('a, button')];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const button = menuButton.current;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      button?.focus({ preventScroll: true });
    };
  }, [navOpen]);

  return (
    <div className="min-h-dvh md:flex">
      <div aria-hidden onClick={() => setNavOpen(false)}
        className={`fixed inset-0 z-40 bg-(--scrim) transition-opacity duration-(--duration-slow) ease-(--ease-out) md:hidden ${navOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />

      {/* floating glass panel: inset from the window edge on tablet and up, a full-height drawer on phones */}
      <aside ref={drawer} id="app-nav" aria-label="ניווט ראשי"
        role={drawerMode ? 'dialog' : undefined} aria-modal={drawerMode && navOpen ? true : undefined}
        inert={drawerMode && !navOpen}
        className={cn('fixed inset-y-0 start-0 z-50 flex w-[min(18rem,86vw)] flex-col p-2 text-sidebar-foreground',
          'max-md:transition-[translate] max-md:duration-(--duration-slow) max-md:ease-(--ease-out) motion-transform',
          navOpen ? 'translate-x-0' : 'translate-x-full',
          'md:sticky md:top-0 md:z-auto md:h-dvh md:w-(--rail-w) md:shrink-0 md:translate-x-0 md:p-2.5 lg:w-(--sidebar-w)')}>
        <div className="glass-panel flex min-h-0 flex-1 flex-col rounded-[1.375rem]">
          <div className="flex h-(--header-h) shrink-0 items-center gap-2.5 px-4 pt-[env(safe-area-inset-top)] md:justify-center md:px-0 lg:justify-start lg:px-4">
            <BrandMark />
            <span className="truncate text-md font-semibold tracking-tight md:max-lg:sr-only">הכספים של הבית</span>
            <button type="button" className="btn-ghost btn-icon ms-auto md:hidden"
              aria-label="סגור תפריט" onClick={() => setNavOpen(false)}>
              <X />
            </button>
          </div>

          <nav className="flex-1 space-y-3.5 overflow-y-auto px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 md:max-lg:overflow-visible lg:px-2.5">
            {NAV_SECTIONS.map(section => (
              <div key={section.title}>
                <h2 className="mb-1 px-2.5 text-2xs font-semibold text-sidebar-muted md:max-lg:sr-only">{section.title}</h2>
                <ul className="space-y-px">
                  {section.items.map(n => {
                    const Icon = n.icon;
                    const link = (
                      <NavLink to={n.to} end={n.to === '/'} onClick={() => setNavOpen(false)}
                        className={({ isActive }) => cn('relative flex h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors duration-(--duration-fast)',
                          'md:h-10 md:justify-center md:px-0 lg:h-8 lg:justify-start lg:px-2',
                          isActive ? 'bg-sidebar-accent font-semibold' : 'hover:bg-fill')}>
                        {({ isActive }) => (
                          <>
                            <Icon className={cn('h-[1.1rem] w-[1.1rem] shrink-0', isActive ? 'text-sidebar-primary' : 'text-sidebar-muted')} />
                            <span className="flex-1 truncate md:max-lg:sr-only">{n.label}</span>
                            {n.to === '/insights' && unseen > 0 && (
                              <span className="num flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-destructive px-1 text-2xs font-semibold leading-none text-destructive-foreground
                                md:max-lg:absolute md:max-lg:end-1 md:max-lg:top-1 md:max-lg:h-4 md:max-lg:min-w-4">
                                {unseen}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                    return (
                      <li key={n.to}>
                        {isRail ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{link}</TooltipTrigger>
                            <TooltipContent side="left">{n.label}</TooltipContent>
                          </Tooltip>
                        ) : link}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="glass sticky top-0 z-30 border-b border-border/60 pt-[env(safe-area-inset-top)]">
          <div className="flex min-h-(--header-h) items-center gap-2 px-3 py-2.5 sm:px-6 lg:px-8">
            <button ref={menuButton} type="button" className="btn-ghost btn-icon -ms-1 text-foreground md:hidden" aria-label="פתח תפריט"
              aria-expanded={navOpen} aria-controls="app-nav" onClick={() => setNavOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <span className="flex min-w-0 items-center gap-2 truncate text-md font-bold tracking-tight md:hidden">
              {current && <current.icon className="h-4 w-4 text-link" />}
              {current?.label ?? 'הכספים של הבית'}
            </span>
            <div className="hidden min-w-0 flex-1 md:block"><FilterBar /></div>
            <div className="ms-auto flex shrink-0 items-center gap-1">
              <AgentChat />
              <AlertsBell unseen={unseen} />
            </div>
          </div>
        </header>
        <div className="border-b border-border/60 px-4 py-3 sm:px-6 md:hidden"><FilterBar /></div>

        <main className="mx-auto w-full max-w-[92rem] px-4 pb-16 pt-5 sm:px-6 md:pt-7 lg:px-8 lg:pt-8">
          {/* CSS entry (backwards fill) leaves no transform behind, so fixed children stay viewport-relative */}
          <div key={pathname} className="animate-page-in">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/fixed" element={<Fixed />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/trends" element={<Trends />} />
              <Route path="/insurance" element={<Insurance />} />
              <Route path="/pension" element={<Pension />} />
              <Route path="/investments" element={<Investments />} />
              <Route path="/cashflow" element={<Cashflow />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/events" element={<Events />} />
              <Route path="/businesses" element={<Businesses />} />
              <Route path="/savings" element={<Savings />} />
              <Route path="/loans" element={<Loans />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/settings" element={<Settings />} />
              {/* design-system reference; intentionally not in NAV */}
              <Route path="/kit" element={<Kit />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
