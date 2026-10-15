import { Cloud, ILL, IllustrationSvg, type IllustrationProps, Sparkle } from './base';

/** Spot for adding a planned expense: a calendar page and a plane heading for an island. */
export function PlannedExpenseSpot(props: IllustrationProps) {
  return (
    <IllustrationSvg viewBox="0 0 320 130" {...props}>
      <Cloud x={196} y={30} w={60} />

      {/* calendar page */}
      <rect x={40} y={44} width={110} height={92} rx={6} fill={ILL.ink} />
      <rect x={40} y={38} width={110} height={92} rx={6} fill={ILL.paper} />
      <rect x={40} y={38} width={110} height={22} rx={6} fill={ILL.blue} />
      <rect x={61} y={30} width={6} height={16} rx={3} fill={ILL.paper} />
      <rect x={123} y={30} width={6} height={16} rx={3} fill={ILL.paper} />
      <rect x={58} y={74} width={16} height={14} fill={ILL.blue2} />
      <rect x={86} y={74} width={16} height={14} fill={ILL.yellow} />
      <rect x={114} y={74} width={16} height={14} fill={ILL.paper} />
      <rect x={58} y={98} width={16} height={14} fill={ILL.paper} />
      <rect x={86} y={98} width={16} height={14} fill={ILL.paper} />

      {/* plane and its trail */}
      <path d="M196 70l78-34c10-4 18 4 12 12l-50 46-6-14-22 4z" fill={ILL.paper} />
      <path d="M230 80l-34-10 14-8 34 4z" fill={ILL.blue} />
      <path d="M236 94l-4 22 12-10 4-22z" fill={ILL.yellow} />
      <path d="M186 104l-14 12M196 110l-10 10M178 96l-12 8" stroke={ILL.free} strokeDasharray="3 4" />

      {/* island */}
      <path d="M220 130c6-16 20-22 34-22 16 0 26 8 30 22z" fill={ILL.blue2} />

      <Sparkle x={290} y={40} size={12} />
      <Sparkle x={174} y={35} size={10} />
    </IllustrationSvg>
  );
}
