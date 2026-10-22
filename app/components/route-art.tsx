import { useId, type Ref } from "react";

import { ART_SIZE } from "~/lib/layouts";

type Props = {
  paths: string[];
  /** One colour per path. */
  colours: string[];
  background: string;
  strokeWidth: number;
  label: string;
  ref?: Ref<SVGSVGElement>;
};

/** The artwork itself: plain SVG, so the same markup is shown on screen and downloaded. */
export function RouteArt({
  paths,
  colours,
  background,
  strokeWidth,
  label,
  ref,
}: Props) {
  const titleId = useId();
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${ART_SIZE} ${ART_SIZE}`}
      width={ART_SIZE}
      height={ART_SIZE}
      role="img"
      aria-labelledby={titleId}
      className="h-auto w-full rounded-lg"
    >
      <title id={titleId}>{label}</title>
      <rect width={ART_SIZE} height={ART_SIZE} fill={background} />
      <g
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((d, index) => (
          <path key={index} d={d} stroke={colours[index]} />
        ))}
      </g>
    </svg>
  );
}
