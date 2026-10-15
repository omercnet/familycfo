import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import './illustrations.css';

type Props = {
  /** 'hero': text beside the art (stacked on narrow screens), art on the bottom edge. 'spot': text above the art. */
  variant?: 'hero' | 'spot';
  title?: ReactNode;
  /** Heading level of the title. */
  as?: 'h1' | 'h2' | 'h3';
  /** Small label above the title (the hero's month). */
  eyebrow?: ReactNode;
  text?: ReactNode;
  /** Buttons; the panel only lays them out. */
  actions?: ReactNode;
  /** One illustration component, e.g. <OverviewHero />. */
  illustration?: ReactNode;
  className?: string;
};

/**
 * Pastel sky panel for the illustration layer (Overview hero, spot panels that invite an action,
 * empty states). Colors come from the --ill-* variables, so it darkens in dark mode while the
 * illustration keeps its light fills. A section labelled by its title when it has one.
 */
export function IllustrationPanel({ variant = 'spot', title, as: Heading = 'h3', eyebrow, text, actions, illustration, className }: Props) {
  const id = useId();
  const hero = variant === 'hero';
  const body = (
    <div className={cn('flex min-w-0 flex-col', hero ? 'gap-3 pb-6 md:pb-7' : 'gap-2')}>
      {eyebrow && <div className="w-fit rounded-lg bg-card px-3 py-1 text-sm font-medium">{eyebrow}</div>}
      {title && (
        <Heading id={id} className={cn('font-bold tracking-tight', hero ? 'text-3xl leading-tight md:text-4xl' : 'text-lg leading-snug')}>
          {title}
        </Heading>
      )}
      {text && <div className={cn('max-w-prose', hero ? 'text-base leading-relaxed md:text-lg' : 'text-sm')}>{text}</div>}
      {actions && <div className={cn('flex flex-wrap gap-2.5', hero ? 'mt-1.5' : 'mt-1')}>{actions}</div>}
    </div>
  );
  const art = illustration && (
    <div className={hero ? 'mx-auto w-full max-w-[420px] self-end md:max-w-none' : 'mt-1'}>{illustration}</div>
  );
  const Tag = title ? 'section' : 'div';
  return (
    <Tag
      aria-labelledby={title ? id : undefined}
      className={cn(
        'ill-panel',
        hero ? 'grid items-center gap-3 px-5 pt-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:px-8 md:pt-7' : 'flex flex-col gap-2 px-5 pt-5',
        className,
      )}
    >
      {body}
      {art}
    </Tag>
  );
}
