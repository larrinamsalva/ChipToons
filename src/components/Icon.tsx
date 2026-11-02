import type { CSSProperties } from "react";

const paths: Record<string, string> = {
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M19 12H5m6-6-6 6 6 6",
  play: "m9 5 11 7-11 7Z",
  pause: "M8 5v14M16 5v14",
  restart: "M3 10a9 9 0 1 1 1 7M3 4v6h6",
  previous: "M5 5v14m14-14L8 12l11 7Z",
  next: "M19 5v14M5 5l11 7-11 7Z",
  bulb: "M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2",
  upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
  download: "M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4",
  pencil: "m15 4 5 5M4 20l5-1L21 7l-5-5L4 14Z",
  folder: "M3 7V4h7l3 3h8v13H3Z",
  heart: "M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 0 9 8 15 8-6 12-11 8-15Z",
  sparkles:
    "m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5ZM21 2v4m-2-2h4",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  moon: "M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z",
  cloud: "M5 19a4 4 0 0 1 0-8 7 7 0 0 1 13-2 5 5 0 0 1 0 10Z",
  shield: "m12 3 9 4v6c0 5-9 9-9 9s-9-4-9-9V7Zm-4 9 3 3 5-5",
  flower:
    "M12 13v9m0-3c-5 0-7-4-7-4s5-1 7 4m0-7c-8 4-9-4-4-5-2-7 10-7 8 0 5 1 4 9-4 5Z",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2",
  copy: "M8 8h13v13H8ZM16 8V3H3v13h5",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  undo: "M3 9h10a7 7 0 0 1 0 14M3 9l6-6M3 9l6 6",
  redo: "M21 9H11a7 7 0 0 0 0 14M21 9l-6-6m6 6-6 6",
  help: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1-1.5 3m0 3h.01",
  film: "M3 3h18v18H3ZM7 3v18M17 3v18M3 8h4m-4 8h4m10-8h4m-4 8h4",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  menu: "M4 6h16M4 12h16M4 18h16",
  lock: "M5 10h14v11H5Zm3 0V7a4 4 0 0 1 8 0v3",
  grid: "M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-8 0v6",
  image: "M3 3h18v18H3Zm0 13 5-5 6 6 3-3 4 4M16 8h.01",
  book: "M12 5C9 3 5 3 2 5v16c3-2 7-2 10 0m0-16c3-2 7-2 10 0v16c-3-2-7-2-10 0Zm0 0v16",
};
export function Icon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d={paths[name] ?? paths.sparkles} />
    </svg>
  );
}
export function Logo() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true">
          <path d="m5 12 15-8 15 8v16l-15 8-15-8Z" fill="#fff5da" />
          <path d="m16 12 14 8-14 8Z" fill="#292d44" />
        </svg>
      </span>
      <span>
        ChipToons<span className="brand-sub">STUDIO</span>
      </span>
    </span>
  );
}
