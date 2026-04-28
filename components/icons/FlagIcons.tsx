// Flag icons rendered as inline SVG with two render sizes: base 24×18
// for list rows 4–10, and larger 36×27 for the top 3 rows (`large`
// prop). SVG viewBoxes vary — width/height scale them into whichever
// size the rail requests.
//
// UK and Australia weren't provided in the Figma paste (US was
// duplicated in place of UK, Italy in place of one row) — simplified
// versions are defined inline here so all 10 list rows render as SVG
// rather than emoji.

// Two render sizes — rows 1–3 of the Figma list show a larger flag
// (36 × 27), rows 4–10 render at the base 24 × 18. Pass `large` to opt
// into the larger rail.
type FlagProps = { title?: string; large?: boolean };

function Frame({
  children,
  viewBox,
  large,
}: {
  children: React.ReactNode;
  viewBox: string;
  large?: boolean;
}) {
  const w = large ? 36 : 24;
  const h = large ? 27 : 18;
  return (
    <svg
      width={w}
      height={h}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

export function FlagUS({ large }: FlagProps) {
  return (
    <Frame large={large} viewBox="0 0 36 27">
      <path d="M0 0H36V27H0" fill="#BD3D44" />
      <path
        d="M0 3.11035H36M0 7.25598H36M0 11.4185H36M0 15.581H36M0 19.7435H36M0 23.906H36"
        stroke="white"
        strokeWidth="2.08125"
      />
      <path d="M0 0H20.52V14.5406H0" fill="#192F5D" />
    </Frame>
  );
}

// Simplified Union Jack — blue field with white + red cross bars.
// Not an officially exact flag, but matches the 24×18 rail and reads
// correctly at the module's rendering size.
export function FlagGB({ large }: FlagProps) {
  return (
    <Frame large={large} viewBox="0 0 24 18">
      <rect width="24" height="18" fill="#012169" />
      {/* White diagonals */}
      <path d="M0 0 L24 18 M24 0 L0 18" stroke="white" strokeWidth="3" />
      {/* Red diagonals (thinner, offset) */}
      <path d="M0 0 L24 18 M24 0 L0 18" stroke="#C8102E" strokeWidth="1.5" />
      {/* White cross */}
      <rect x="10" y="0" width="4" height="18" fill="white" />
      <rect x="0" y="7" width="24" height="4" fill="white" />
      {/* Red cross */}
      <rect x="11" y="0" width="2" height="18" fill="#C8102E" />
      <rect x="0" y="8" width="24" height="2" fill="#C8102E" />
    </Frame>
  );
}

export function FlagIN({ large }: FlagProps) {
  return (
    <Frame large={large} viewBox="0 0 36 27">
      <path d="M0 0H36V9H0V0Z" fill="#FF9933" />
      <path d="M0 9H36V18H0V9Z" fill="white" />
      <path d="M0 18H36V27H0V18Z" fill="#128807" />
      {/* Ashoka chakra — simplified as a blue circle outline */}
      <circle cx="18" cy="13.5" r="3.1" fill="none" stroke="#000088" strokeWidth="0.6" />
      <circle cx="18" cy="13.5" r="0.5" fill="#000088" />
    </Frame>
  );
}

export function FlagBR({ large }: FlagProps) {
  return (
    <Frame large={large} viewBox="0 0 24 18">
      <rect width="24" height="18" fill="#229E45" />
      <path d="M12 1.65 L23.36 9.01 L12.05 16.35 L0.64 9.03 Z" fill="#F8E509" />
      <circle cx="12.2" cy="9" r="4.78" fill="#2B49A3" />
      <path d="M7.6 7.62 C11.85 7.21 14.96 9.09 16.67 10.72 C16.76 10.48 16.83 10.23 16.88 9.97 C14.34 7.74 11.51 6.60 7.93 6.84 C7.80 7.09 7.69 7.35 7.61 7.62 Z" fill="white" />
    </Frame>
  );
}

export function FlagDE({ large }: FlagProps) {
  return (
    <Frame large={large} viewBox="0 0 24 18">
      <path d="M0 0H24V6H0Z" fill="#000001" />
      <path d="M0 6H24V12H0Z" fill="#FF0000" />
      <path d="M0 12H24V18H0Z" fill="#FFCC00" />
    </Frame>
  );
}

export function FlagIT({ large }: FlagProps) {
  return (
    <Frame large={large} viewBox="0 0 24 18">
      <rect width="24" height="18" fill="white" />
      <path d="M0 0H8V18H0Z" fill="#009246" />
      <path d="M16 0H24V18H16Z" fill="#CE2B37" />
    </Frame>
  );
}

export function FlagFR({ large }: FlagProps) {
  return (
    <Frame large={large} viewBox="0 0 24 18">
      <rect width="24" height="18" fill="white" />
      <path d="M0 0H8V18H0Z" fill="#000091" />
      <path d="M16 0H24V18H16Z" fill="#E1000F" />
    </Frame>
  );
}

export function FlagCA({ large }: FlagProps) {
  return (
    <Frame large={large} viewBox="0 0 24 18">
      <rect x="0" y="0" width="6" height="18" fill="#D52B1E" />
      <rect x="6" y="0" width="12" height="18" fill="white" />
      <rect x="18" y="0" width="6" height="18" fill="#D52B1E" />
      {/* Maple leaf — simplified as a centered red diamond */}
      <path
        d="M12 4.5 L13.4 8.1 L16.5 7.2 L14.8 10 L16 11 L13.2 11.2 L13.5 13.5 L12 12.2 L10.5 13.5 L10.8 11.2 L8 11 L9.2 10 L7.5 7.2 L10.6 8.1 Z"
        fill="#D52B1E"
      />
    </Frame>
  );
}

export function FlagJP({ large }: FlagProps) {
  return (
    <Frame large={large} viewBox="0 0 24 18">
      <rect width="24" height="18" fill="white" />
      <circle cx="12" cy="9" r="5.6" fill="#BC002D" />
    </Frame>
  );
}

// Simplified Australia — blue field, Union Jack canton as a compact
// block, Commonwealth Star (7-point) + small Southern Cross dots.
export function FlagAU({ large }: FlagProps) {
  return (
    <Frame large={large} viewBox="0 0 24 18">
      <rect width="24" height="18" fill="#012169" />
      {/* Canton (Union Jack block) — simplified */}
      <rect x="0" y="0" width="12" height="9" fill="#012169" />
      <path d="M0 0 L12 9 M12 0 L0 9" stroke="white" strokeWidth="1.4" />
      <rect x="5" y="0" width="2" height="9" fill="white" />
      <rect x="0" y="3.5" width="12" height="2" fill="white" />
      <rect x="5.5" y="0" width="1" height="9" fill="#C8102E" />
      <rect x="0" y="4" width="12" height="1" fill="#C8102E" />
      {/* Commonwealth Star under the canton */}
      <circle cx="6" cy="13" r="1.1" fill="white" />
      {/* Southern Cross (4 visible dots) */}
      <circle cx="18" cy="5" r="0.9" fill="white" />
      <circle cx="20" cy="9" r="0.9" fill="white" />
      <circle cx="17" cy="11" r="0.8" fill="white" />
      <circle cx="15" cy="8" r="0.7" fill="white" />
      <circle cx="19" cy="13" r="0.7" fill="white" />
    </Frame>
  );
}
