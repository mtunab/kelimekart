import type { SVGProps } from "react";

/** Çizgi simgeler (24×24, renk yazı renginden gelir). Hepsi süs: ekran okuyucudan gizli. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, strokeWidth = 2.4, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function StudyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z" />
      <path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z" />
    </Svg>
  );
}

export function DecksIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="7" y="3" width="13" height="15" rx="2" />
      <path d="M4 7v11a3 3 0 0 0 3 3h9" />
    </Svg>
  );
}

export function StatsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 20v-8" />
      <path d="M12 20V5" />
      <path d="M19 20v-5" />
    </Svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h9" />
      <path d="M19 6h1" />
      <circle cx="16" cy="6" r="2.5" />
      <path d="M4 12h3" />
      <path d="M13 12h7" />
      <circle cx="10" cy="12" r="2.5" />
      <path d="M4 18h11" />
      <circle cx="18" cy="18" r="2.5" />
    </Svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.5 1 2.5 2 2.5 0-3-1-5.5.5-7.5z" />
    </Svg>
  );
}

export function SpeakerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    </Svg>
  );
}

export function UndoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
    </Svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 6l-6 6 6 6" />
    </Svg>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 16l-4-4 4-4" />
      <path d="M6 12h10" />
    </Svg>
  );
}
