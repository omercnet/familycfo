import { circle, Cloud, ILL, IllustrationSvg, type IllustrationProps, Shadowed, Sparkle } from './base';

/** Nothing left to handle: a check mark with sparkles. */
export function AllCaughtUp(props: IllustrationProps) {
  return (
    <IllustrationSvg viewBox="0 0 240 160" {...props}>
      <Cloud x={6} y={70} w={60} />
      <Cloud x={164} y={146} w={64} />

      <Shadowed d={circle(120, 76, 44)} fill={ILL.blue} />
      <path d="M94 80l8-8 12 12 26-26 8 8-34 34z" fill={ILL.paper} />

      <circle cx={66} cy={98} r={5} fill={ILL.yellow} />
      <circle cx={182} cy={64} r={5} fill={ILL.yellow} />

      <Sparkle x={62} y={40} />
      <Sparkle x={184} y={32} size={12} />
      <Sparkle x={192} y={106} />
      <Sparkle x={52} y={128} size={10} />
    </IllustrationSvg>
  );
}
