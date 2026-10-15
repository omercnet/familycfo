import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { api, type Tag } from '../../api';
import { useLookups } from '../../state';
import { cn } from '@/lib/utils';
import { accountIcon, categoryIcon, MemberAvatar } from '@/lib/visuals';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/kit/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/kit/command';

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
