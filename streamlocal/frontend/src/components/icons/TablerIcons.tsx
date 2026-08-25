import type { ReactNode, SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & {
  size?: number;
};

type IconProps = Props & {
  children: ReactNode;
};

function TablerIcon({ size = 24, children, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      {children}
    </svg>
  );
}

export function TablerXIcon(props: Props) {
  return (
    <TablerIcon {...props}>
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </TablerIcon>
  );
}

export function TablerPlayerPlayIcon(props: Props) {
  return (
    <TablerIcon {...props}>
      <path d="M7 4v16l13 -8z" />
    </TablerIcon>
  );
}

export function TablerPlayerPauseIcon(props: Props) {
  return (
    <TablerIcon {...props}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </TablerIcon>
  );
}

export function TablerRewindBackward10Icon(props: Props) {
  return (
    <TablerIcon {...props}>
      <path d="M7 9l-3 -3l3 -3" />
      <path d="M15.997 17.918a6.002 6.002 0 0 0 -.997 -11.918h-11" />
      <path d="M6 14v6" />
      <path d="M9 15.5v3a1.5 1.5 0 0 0 3 0v-3a1.5 1.5 0 0 0 -3 0" />
    </TablerIcon>
  );
}

export function TablerRewindForward10Icon(props: Props) {
  return (
    <TablerIcon {...props}>
      <path d="M17 9l3 -3l-3 -3" />
      <path d="M8 17.918a5.997 5.997 0 0 1 -5 -5.918a6 6 0 0 1 6 -6h11" />
      <path d="M12 14v6" />
      <path d="M15 15.5v3a1.5 1.5 0 0 0 3 0v-3a1.5 1.5 0 0 0 -3 0" />
    </TablerIcon>
  );
}

export function TablerMaximizeIcon(props: Props) {
  return (
    <TablerIcon {...props}>
      <path d="M4 8v-2a2 2 0 0 1 2 -2h2" />
      <path d="M4 16v2a2 2 0 0 0 2 2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
      <path d="M16 20h2a2 2 0 0 0 2 -2v-2" />
    </TablerIcon>
  );
}

export function TablerMinimizeIcon(props: Props) {
  return (
    <TablerIcon {...props}>
      <path d="M15 19v-2a2 2 0 0 1 2 -2h2" />
      <path d="M9 5v2a2 2 0 0 1 -2 2h-2" />
      <path d="M5 15h2a2 2 0 0 1 2 2v2" />
      <path d="M19 9h-2a2 2 0 0 1 -2 -2v-2" />
    </TablerIcon>
  );
}

export function TablerDotsIcon(props: Props) {
  return (
    <TablerIcon {...props}>
      <path d="M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    </TablerIcon>
  );
}
