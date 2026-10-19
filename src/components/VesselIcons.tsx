import type { ReactNode } from "react";

export type IconProps = {
  size?: number;
  className?: string;
};

function Base({ size = 18, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Waterline squiggle shared across hull-based icons. */
function Waterline() {
  return (
    <path
      d="M2 19.5c1.2-1 2.4-1 3.6 0s2.4 1 3.6 0s2.4-1 3.6 0s2.4 1 3.6 0s2.4-1 3.6 0"
      opacity={0.45}
    />
  );
}

/** Heavy Lift Vessel — hull + mast/boom crane hoisting a load. */
export function HlvIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Waterline />
      <path d="M4 15h16l-2 3.4H6z" />
      <path d="M9 15V4" />
      <path d="M9 5l8 4" />
      <path d="M17 9v4" />
      <rect x="15" y="13" width="4" height="2.2" />
    </Base>
  );
}

/** Jack-Up Barge / Liftboat — deck box on legs jacked through the waterline. */
export function JubIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="5.3" width="14" height="5" rx="0.4" />
      <path d="M9 5.3V3.1M14 5.3V3.1" />
      <path d="M7.5 10.3V21M12 10.3V21M16.5 10.3V21" />
      <path d="M2 16h20" strokeDasharray="1.4 1.8" opacity={0.55} />
    </Base>
  );
}

/** Offshore Construction Vessel — hull, helideck forward, crane aft. */
export function OcvIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Waterline />
      <path d="M3 15h18l-2 3.4H5z" />
      <circle cx="7.5" cy="11.8" r="2" />
      <path d="M16 15V7l5 3" />
      <path d="M19 9.5v5.5" />
    </Base>
  );
}

/** Diving Support Vessel — hull with moon pool lowering a diving bell. */
export function DsvIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Waterline />
      <path d="M3 15h18l-2 3.4H5z" />
      <rect x="10.4" y="12.3" width="3.2" height="2.4" />
      <path d="M12 14.7v4.3" />
      <path d="M10.5 20.5h3" />
    </Base>
  );
}

/** Derrick Lay Barge — low barge carrying a tall lattice derrick tower. */
export function DlbIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="16.6" width="18" height="2.4" />
      <path d="M8 16.6V4M16 16.6V4M8 4h8" />
      <path d="M8 10.8h8M8 14.2h8" opacity={0.6} />
    </Base>
  );
}

/** Floatover Barge — flat, wide hull with a large topside module riding on deck. */
export function FloatoverIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="2" y="17" width="20" height="2" />
      <rect x="6" y="8" width="12" height="9" />
      <path d="M6 11.3h12M6 14h12" opacity={0.55} />
    </Base>
  );
}

/** Floatel — barge hull supporting a multi-storey accommodation block + helideck. */
export function FloatelIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="17.6" width="18" height="2" />
      <rect x="7" y="6" width="10" height="11.6" />
      <path d="M7 9.6h10M7 13.2h10" opacity={0.6} />
      <circle cx="12" cy="3.4" r="1.5" />
      <path d="M12 4.9V6" />
    </Base>
  );
}

/** Workboat — compact hull with a boxy wheelhouse forward. */
export function WorkboatIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Waterline />
      <path d="M3 16h17l-2.4 3H5.4z" />
      <path d="M8 16v-6h5v6" />
    </Base>
  );
}

/** Supply Boat (PSV) — forward bridge block with a long open cargo deck aft. */
export function SupplyBoatIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Waterline />
      <path d="M2 16h19l-2.4 3H4.4z" />
      <path d="M5 16V9h5v7" />
      <path d="M13 16.3h6M13 14.3h4" opacity={0.6} />
    </Base>
  );
}

/** Crewboat — sleek low planing hull with a small cabin and a fast wake. */
export function CrewboatIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M2 17c2-1.5 4.5-2 8-2h10l-2 3.4H4z" />
      <path d="M9 15v-3.4c0-.6.4-1 1-1h3c.6 0 1 .4 1 1V15" />
      <path d="M18.2 19.4l3-1M18.7 20.9l3.1-1.3" opacity={0.5} />
    </Base>
  );
}

export const vesselIconMap: Record<string, (props: IconProps) => JSX.Element> = {
  hlv: HlvIcon,
  htv: FloatoverIcon,
  jub: JubIcon,
  ocv: OcvIcon,
  ahts: OcvIcon,
  dsv: DsvIcon,
  dlb: DlbIcon,
  "floatover-barge": FloatoverIcon,
  floatel: FloatelIcon,
  workboat: WorkboatIcon,
  "supply-boat": SupplyBoatIcon,
  crewboat: CrewboatIcon,
};
