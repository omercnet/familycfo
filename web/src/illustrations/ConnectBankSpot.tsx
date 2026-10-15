import { circle, Cloud, ILL, IllustrationSvg, type IllustrationProps, rect, Shadowed, Sparkle } from './base';

/** Spot for connecting a bank: a bank building whose cable plugs into a socket. */
export function ConnectBankSpot(props: IllustrationProps) {
  return (
    <IllustrationSvg viewBox="0 0 320 130" {...props}>
      <Cloud x={176} y={34} w={64} />

      {/* cables, under the plug and the socket */}
      <path d="M154 104c26 0 24-28 52-28M282 76c18 0 20 26 40 26" stroke={ILL.free} />

      {/* bank building */}
      <Shadowed d="M36 58l59-30 59 30z" fill={ILL.blue} />
      <Shadowed d={circle(95, 46, 6)} fill={ILL.yellow} dy={0} />
      <rect x={40} y={58} width={110} height={10} fill={ILL.paper} />
      {[50, 76, 102, 128].map(x => <rect key={x} x={x} y={68} width={12} height={44} fill={ILL.paper} />)}
      <Shadowed d={rect(34, 112, 122, 12)} fill={ILL.blue2} />

      {/* plug */}
      <Shadowed d={rect(204, 64, 26, 24, 5)} fill={ILL.yellow} dy={4} />
      <path d="M230 70h10M230 82h10" />

      {/* socket */}
      <Shadowed d={rect(252, 60, 30, 32, 6)} fill={ILL.blue} dy={4} />
      <rect x={258} y={68} width={7} height={4} rx={1} fill={ILL.ink} />
      <rect x={258} y={80} width={7} height={4} rx={1} fill={ILL.ink} />

      <Sparkle x={246} y={46} size={10} />
      <Sparkle x={176} y={30} size={12} />
      <Sparkle x={302} y={28} size={12} />
    </IllustrationSvg>
  );
}
