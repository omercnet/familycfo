import { Cloud, ILL, IllustrationSvg, type IllustrationProps, Sparkle } from './base';

/** Overview hero: stacked ₪ coins, a budget envelope, a card, a bar-chart sheet and a hill. */
export function OverviewHero(props: IllustrationProps) {
  return (
    <IllustrationSvg viewBox="0 0 420 250" {...props}>
      <Cloud x={24} y={92} w={78} />
      <Cloud x={300} y={54} w={57} />

      <path d="M268 250c4-46 26-74 56-74 28 0 40 22 44 44 14-6 34-2 40 30z" fill={ILL.blue2} />

      {/* bar-chart sheet */}
      <path d="M96 250V112h66l22 22v116" fill={ILL.paper} />
      <path d="M162 112v22h22" fill={ILL.blue2} />
      <rect x={112} y={176} width={16} height={50} fill={ILL.yellow} />
      <rect x={134} y={152} width={16} height={74} fill={ILL.blue} />
      <rect x={156} y={190} width={16} height={36} fill={ILL.blue2} />
      <path d="M110 140h36M110 128h22" />

      {/* budget envelope */}
      <rect x={176} y={150} width={120} height={84} fill={ILL.blue2} />
      <path d="M176 150l60 46 60-46M176 234l46-40M296 234l-46-40" />

      {/* card */}
      <g transform="rotate(-12 268 118)">
        <rect x={222} y={92} width={96} height={60} rx={8} fill={ILL.blue} />
        <rect x={234} y={106} width={18} height={13} rx={2} fill={ILL.yellow} />
        <path d="M234 136h40" />
      </g>

      {/* coins, each with a solid offset shadow */}
      <ellipse cx={72} cy={214} rx={30} ry={12} fill={ILL.ink} />
      <ellipse cx={72} cy={206} rx={30} ry={12} fill={ILL.yellow} />
      <ellipse cx={78} cy={190} rx={30} ry={12} fill={ILL.ink} />
      <ellipse cx={78} cy={182} rx={30} ry={12} fill={ILL.yellow} />
      <text x={78} y={187} textAnchor="middle" fontSize={14} fontWeight={700} fontFamily="system-ui, sans-serif" fill={ILL.ink} stroke="none">₪</text>

      {/* coin seen face-on */}
      <circle cx={356} cy={122} r={25} fill={ILL.ink} />
      <circle cx={352} cy={117} r={25} fill={ILL.paper} />
      <circle cx={352} cy={117} r={11} stroke={ILL.blue} strokeWidth={5} />

      <Sparkle x={54} y={48} size={16} />
      <Sparkle x={212} y={47} />
      <Sparkle x={392} y={203} />
      <Sparkle x={150} y={80} size={12} />
    </IllustrationSvg>
  );
}
