import { Cloud, ILL, IllustrationSvg, type IllustrationProps, rect, Shadowed, Sparkle } from './base';

/** Empty state for budgets: an open envelope with nothing inside. */
export function EmptyBudget(props: IllustrationProps) {
  return (
    <IllustrationSvg viewBox="0 0 240 160" {...props}>
      <Cloud x={150} y={36} w={56} />
      <Cloud x={12} y={96} w={50} />

      {/* open flap, behind the envelope */}
      <path d="M60 70l60-44 60 44z" fill={ILL.blue2} />
      {/* inside, then the front pocket */}
      <Shadowed d={rect(60, 70, 120, 72)} fill={ILL.blue} />
      <path d="M60 70l60 36 60-36v72H60z" fill={ILL.blue2} />
      <path d="M60 142l46-34M180 142l-46-34" />

      <Sparkle x={40} y={52} />
      <Sparkle x={204} y={84} size={12} />
      <Sparkle x={120} y={12} size={10} />
      <Sparkle x={206} y={128} size={10} />
    </IllustrationSvg>
  );
}
