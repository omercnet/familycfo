import { circle, Cloud, ILL, IllustrationSvg, type IllustrationProps, Shadowed, Sparkle } from './base';

// a receipt with a torn (zigzag) bottom edge
const RECEIPT = 'M78 24h84v104l-7 8l-7-8l-7 8l-7-8l-7 8l-7-8l-7 8l-7-8l-7 8l-7-8l-7 8l-7-8z';

/** Empty state for a transaction list: a blank receipt and a magnifying glass. */
export function EmptyTransactions(props: IllustrationProps) {
  return (
    <IllustrationSvg viewBox="0 0 240 160" {...props}>
      <Cloud x={16} y={58} w={64} />
      <Cloud x={168} y={34} w={50} />

      <Shadowed d={RECEIPT} fill={ILL.paper} />
      <circle cx={120} cy={42} r={7} fill={ILL.blue2} />
      <path d="M92 62h24M132 62h16M92 78h24M132 78h16M92 94h24M132 94h16" strokeDasharray="2 5" />
      <path d="M92 110h56" />

      {/* magnifying glass */}
      <rect x={-4} y={0} width={8} height={24} rx={3} transform="translate(185 119) rotate(-45)" fill={ILL.yellow} />
      <Shadowed d={circle(176, 110, 16)} fill={ILL.blue2} dy={4} />
      <path d="M168 104a10 10 0 0 1 8-5" />

      <Sparkle x={56} y={104} size={12} />
      <Sparkle x={204} y={76} />
      <Sparkle x={60} y={24} size={10} />
    </IllustrationSvg>
  );
}
