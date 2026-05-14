/**
 * Icons from the Sendible Figma design system.
 *
 * Source of truth: Figma file "Reporting", icon library node 1133:104275
 * (https://www.figma.com/design/hyfP3xxKFX2FftRlGSeUE8/Reporting?node-id=1133-104275).
 *
 * Extraction rules:
 *  - Each icon's raw SVG was pulled directly from Figma's localhost asset
 *    server at export time and cached under `components/icons/svg/*.svg`. The
 *    inline JSX paths below are verbatim copies of those exports.
 *  - Each icon declares its native path bounds as `nativeW` × `nativeH` (the
 *    dimensions Figma emits on export, stroke margin included). The
 *    `FigmaIcon` wrapper then places that native path inside a 24×24 tile —
 *    Figma's design-system icon container — so a `size=16` render produces
 *    exactly the same visual proportions as a Figma instance sized to 16×16.
 *    This is the one source of truth for stroke thickness, aspect ratio, and
 *    tile alignment.
 *  - Stroke color flows through the `--stroke-0` CSS variable (the same token
 *    the Figma exports reference). `color` prop overrides it per-icon.
 *
 * Hand-authoring icons is NOT permitted. If an icon isn't in the library,
 * surface it as a `needsFigmaSource` stub rather than improvising.
 */

import { CSSProperties, ReactNode } from 'react';

interface IconProps {
  className?: string;
  size?: number;
  color?: string;
}

/**
 * Base wrapper for a Figma-exported icon path set.
 *
 * Figma's design system treats every icon as a 24×24 tile. The native SVG
 * export has a smaller, asymmetric viewBox that matches just the path bounds
 * (e.g. chevron_down is 13.5×7.5, plus is 15.5×15.5). Figma's own React
 * export places that native SVG at `((24 − nativeW) / 2, (24 − nativeH) / 2)`
 * inside the 24×24 tile — verified against
 * figma://node/1133:104546 (chevron_down) which maps to
 * `left/right-1/4 top/bottom-37.5%` + an outset of half the stroke width.
 *
 * This wrapper replicates that: a single outer viewBox of `0 0 24 24` with a
 * nested SVG hosting the native path. That means:
 *   1. Stroke width `1.5` in Figma's 24-unit space renders at the same
 *      proportional thickness as Figma at any `size` (e.g. at `size=16`,
 *      stroke is `1.5 × (16/24) = 1.0`px, matching the Figma spec).
 *   2. Non-square icons are no longer stretched to fill the tile — they sit
 *      at their Figma-native aspect inside the square footprint.
 *   3. `size` is always the tile size, not the path extent, so layout code
 *      gets a predictable square regardless of the icon shape.
 *
 * The default placement is "centered in the tile". If any icon turns out to
 * have a non-centered offset in Figma (caught during the per-component
 * refinement pass), pass an explicit `tileX`/`tileY` override.
 */
function FigmaIcon({
  size,
  color,
  nativeW,
  nativeH,
  tileW,
  tileH,
  tileX,
  tileY,
  className,
  children,
}: {
  size: number;
  color: string;
  /** Native viewBox width of the exported SVG (stroke margin included). */
  nativeW: number;
  /** Native viewBox height of the exported SVG. */
  nativeH: number;
  /**
   * How much of the 24×24 tile the icon should *visually* fill. Defaults to
   * `nativeW` / `nativeH`, which is correct for icons whose native viewBox
   * already equals Figma's Vector-plus-stroke footprint. Override when Figma's
   * `Vector inset-…` in a 16/20-tile implies a different fill ratio — e.g.
   * `close_sm` has viewBox 9.5×9.5 but Figma places it at `inset-1/4` within a
   * 20-tile, i.e. a 14.25-unit footprint in 24-tile space.
   */
  tileW?: number;
  tileH?: number;
  /** Override the tile x-offset if the icon isn't centered. */
  tileX?: number;
  /** Override the tile y-offset if the icon isn't centered. */
  tileY?: number;
  className?: string;
  children: ReactNode;
}) {
  const tw = tileW ?? nativeW;
  const th = tileH ?? nativeH;
  const x = tileX ?? (24 - tw) / 2;
  const y = tileY ?? (24 - th) / 2;
  const style: CSSProperties & Record<'--stroke-0', string> = {
    display: 'inline-flex',
    width: size,
    height: size,
    flexShrink: 0,
    ['--stroke-0']: color,
  };
  return (
    <span className={className} style={style} aria-hidden="true">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <svg
          x={x}
          y={y}
          width={tw}
          height={th}
          viewBox={`0 0 ${nativeW} ${nativeH}`}
          overflow="visible"
        >
          {children}
        </svg>
      </svg>
    </span>
  );
}

// Shared path attrs — every stroke icon in the Figma library uses these.
//
// `vectorEffect: 'non-scaling-stroke'` is the load-bearing line: Figma
// specs every stroke icon at strokeWeight=1.5 *CSS pixels* regardless of
// the tile size it ships in (the pagination chevron at 16-tile, for
// example, has a `inset-[-9.38%_-18.75%]` stroke margin → 0.75 px on
// each side → exactly 1.5 px stroke on screen). Our inner viewBox is
// 7.5 × 13.5 (the path's native units) and the outer SVG is 24-unit, so
// without `non-scaling-stroke` the 1.5-unit stroke would scale with the
// viewBox and render at `1.5 × (size/24)` — only ~1.0 CSS px at size=16,
// which read as visibly too thin in the pagination footer. With
// `non-scaling-stroke`, the 1.5 is interpreted in CSS-px irrespective of
// the viewBox scaling, so strokes render at a consistent 1.5 px at every
// tile size and match Figma exactly.
const S = {
  stroke: 'var(--stroke-0, #201E24)',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  vectorEffect: 'non-scaling-stroke' as const,
};

// ─── Navigation / UI ────────────────────────────────────────────────────────

// Figma: close_sm (1133:104495) — the X-shaped close mark.
// Tile-fill: verified against both a 20-tile usage (1026:38597, close button in
// ReportHeader) and a 16-tile usage (1026:38529, close button in AddModulePanel).
// Both place the Vector at `inset-1/4` inside their icon-l tile, meaning the
// stroke-free path body spans half the tile in each axis. The native viewBox is
// 9.5 but the path body itself is 8 units (0.75 → 8.75); to render the 8-unit
// body as 50 % of the icon size (matching Figma), the 9.5-unit viewBox must fill
// 14.25 of 24 tile-units → `tileW/H = 14.25`.
export function IconClose({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon
      size={size}
      color={color}
      nativeW={9.5}
      nativeH={9.5}
      tileW={14.25}
      tileH={14.25}
      className={className}
    >
      <path d="M8.75 0.75L0.75 8.75M0.75 0.75L8.75 8.75" {...S} />
    </FigmaIcon>
  );
}

// Figma: rename (1133:104511) — freestanding pencil glyph used as a
// rename / inline-edit affordance (e.g. next to a title). NOT the same
// as `IconEdit` below (which has a rectangle behind the pencil and is
// used by buttons like "Edit report"). The historical name `IconPencil`
// is kept to avoid a churning rename across the codebase, but the
// canonical Figma name is "rename".
export function IconPencil({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={21.7426} nativeH={21.7426} className={className}>
      <path
        d="M18.75 8.99264L12.75 2.99264M0.75 14.9926V20.9926H6.75L19.75 7.99264C21.4069 6.33578 21.4069 3.64949 19.75 1.99264C18.0931 0.335787 15.4069 0.335786 13.75 1.99264L0.75 14.9926Z"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: edit (1133:104422) — pencil writing on a rectangle (page).
// This is the action-button glyph (e.g. "Edit report" in the report
// header) — visually distinct from `IconPencil` (freestanding pencil
// for rename / inline-edit affordances) because the rectangle reads as
// a *document being edited*, not just a pencil tool. Path authored at
// 16-tile native in Figma (14.66 viewBox, stroke 1.33). We force-fill
// the 24-tile via `tileW/H = 24` and use the `SE` 1.25-stroke spread
// (same convention as the other 16-tile-native icons in this file —
// see the `SE` block near IconText). At size=16 the rendered stroke is
// ~1.36 px, within 0.03 px of Figma's 1.33 spec.
export function IconEdit({ className, size = 16, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon
      size={size}
      color={color}
      nativeW={14.6633}
      nativeH={14.6633}
      tileW={24}
      tileH={24}
      className={className}
    >
      <path
        d="M12.8905 4.73692L9.92641 1.77288M6.665 1.99833H1.99833C1.64471 1.99833 1.30557 2.13881 1.05552 2.38886C0.805476 2.63891 0.665 2.97804 0.665 3.33167V12.665C0.665 13.0186 0.805476 13.3578 1.05552 13.6078C1.30557 13.8579 1.64471 13.9983 1.99833 13.9983H11.3317C11.6853 13.9983 12.0244 13.8579 12.2745 13.6078C12.5245 13.3578 12.665 13.0186 12.665 12.665V7.99833M3.99833 7.70096V10.665H6.96237L13.3845 4.24291C14.203 3.42441 14.203 2.09737 13.3845 1.27887C12.566 0.460376 11.2389 0.460376 10.4204 1.27887L3.99833 7.70096Z"
        {...SE}
      />
    </FigmaIcon>
  );
}

// Figma: more_horizontal (1133:104501) — three horizontal dots.
export function IconMore({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={17.5} nativeH={3.5} className={className}>
      <path d="M8.75 2.75C9.30228 2.75 9.75 2.30228 9.75 1.75C9.75 1.19772 9.30228 0.75 8.75 0.75C8.19772 0.75 7.75 1.19772 7.75 1.75C7.75 2.30228 8.19772 2.75 8.75 2.75Z" {...S} />
      <path d="M15.75 2.75C16.3023 2.75 16.75 2.30228 16.75 1.75C16.75 1.19772 16.3023 0.75 15.75 0.75C15.1977 0.75 14.75 1.19772 14.75 1.75C14.75 2.30228 15.1977 2.75 15.75 2.75Z" {...S} />
      <path d="M1.75 2.75C2.30228 2.75 2.75 2.30228 2.75 1.75C2.75 1.19772 2.30228 0.75 1.75 0.75C1.19772 0.75 0.75 1.19772 0.75 1.75C0.75 2.30228 1.19772 2.75 1.75 2.75Z" {...S} />
    </FigmaIcon>
  );
}

// Figma: more_vertical (1133:104502) — three vertically stacked dots (kebab).
// Used by the ReportHeader's right-rail "more" button (frame 1026:38595), which
// Figma places as a 20×20 icon whose Vector has inset-[16.67%_45.83%] — i.e.
// a narrow-tall footprint matching the vertical dots pattern, NOT more_horizontal.
export function IconMoreVertical({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={3.5} nativeH={17.5} className={className}>
      <path d="M1.75 9.75C2.30228 9.75 2.75 9.30228 2.75 8.75C2.75 8.19772 2.30228 7.75 1.75 7.75C1.19772 7.75 0.75 8.19772 0.75 8.75C0.75 9.30228 1.19772 9.75 1.75 9.75Z" {...S} />
      <path d="M1.75 2.75C2.30228 2.75 2.75 2.30228 2.75 1.75C2.75 1.19772 2.30228 0.75 1.75 0.75C1.19772 0.75 0.75 1.19772 0.75 1.75C0.75 2.30228 1.19772 2.75 1.75 2.75Z" {...S} />
      <path d="M1.75 16.75C2.30228 16.75 2.75 16.3023 2.75 15.75C2.75 15.1977 2.30228 14.75 1.75 14.75C1.19772 14.75 0.75 15.1977 0.75 15.75C0.75 16.3023 1.19772 16.75 1.75 16.75Z" {...S} />
    </FigmaIcon>
  );
}

// Figma: plus (1133:104311).
export function IconPlus({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={15.5} nativeH={15.5} className={className}>
      <path d="M7.75 0.75V14.75M0.75 7.75H14.75" {...S} />
    </FigmaIcon>
  );
}

// Figma: activity (683:1361) — the pulse/heartbeat glyph used in the
// module-card empty state ("Select a matching profile to see data",
// Figma 1916:37022). Standard Lucide-shape activity icon — a flat line
// from the right edge that drops into a heartbeat spike and flattens
// out on the left.  Native viewBox is 24×24, with the path naturally
// occupying ~20×18 in the center; Figma's 32-tile usage in 1916:37022
// applies the same 12.5%/8.33% inset that our default centering math
// produces, so no tileW/tileH overrides are needed.  Stroke matches
// the rest of the library (1.5 px non-scaling).
export function IconActivity({ className, size = 32, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={24} nativeH={24} tileW={24} tileH={24} tileX={0} tileY={0} className={className}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" {...S} />
    </FigmaIcon>
  );
}

// Figma: checkbox (Sendible design system).  Self-contained
// component with three states baked into a single 24×24 viewBox so
// the box outline + inner glyph stay perfectly aligned regardless
// of size.  The paths come from the design-system export verbatim:
//
//   • box outline — 17×17 rounded square at (3.5, 3.5) → (20.5,
//                   20.5) with ~3.5 px corner radius.  Filled
//                   `#4D36FF` (brand-purple) when active; white
//                   with a 1-px `rgba(32,30,36,0.2)` stroke at rest.
//   • checked     — filled-path checkmark glyph rendered in white.
//   • indeterminate — filled-path horizontal bar rendered in white.
//
// Lives outside the `FigmaIcon` wrapper because it isn't a simple
// stroke-only path — it pairs an outline + inner glyph that the
// 24-tile centering math doesn't apply to cleanly.
interface IconCheckboxProps {
  state: 'checked' | 'unchecked' | 'indeterminate';
  className?: string;
  size?: number;
}
export function IconCheckbox({ state, className, size = 24 }: IconCheckboxProps) {
  const filled = state !== 'unchecked';
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-flex',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M7 3.5H17C18.933 3.5 20.5 5.067 20.5 7V17C20.5 18.933 18.933 20.5 17 20.5H7C5.067 20.5 3.5 18.933 3.5 17V7C3.5 5.067 5.067 3.5 7 3.5Z"
          fill={filled ? '#4D36FF' : '#FFFFFF'}
          stroke={filled ? '#4D36FF' : 'rgba(32,30,36,0.2)'}
        />
        {state === 'checked' && (
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M15.2603 9.14519L10.2853 14.0867L8.33982 12.3212C8.14182 12.1417 7.83882 12.1492 7.65032 12.3377L7.64682 12.3412C7.44632 12.5417 7.45182 12.8682 7.65932 13.0612L9.58132 14.8467C9.97482 15.2122 10.5863 15.2017 10.9668 14.8232L15.9648 9.85469C16.1613 9.65969 16.1613 9.34219 15.9658 9.14619C15.7713 8.95169 15.4558 8.95119 15.2603 9.14519Z"
            fill="white"
          />
        )}
        {state === 'indeterminate' && (
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M14.4994 11.4999C14.7762 11.4995 15 11.7233 14.9993 11.9998C14.9997 12.2759 14.7762 12.4994 14.4994 12.4997L9.49992 12.4994C9.22345 12.5001 8.99965 12.2763 9 11.9994C8.99965 11.7233 9.22309 11.4999 9.49992 11.4995L14.4994 11.4999Z"
            fill="white"
          />
        )}
      </svg>
    </span>
  );
}

// Figma: plus_circle (1:35) — plus glyph inside an outlined circle. Used
// as the "Select profiles" affordance in the report header.
export function IconPlusCircle({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={21.5} nativeH={21.5} className={className}>
      <path d="M10.75 6.75V14.75M6.75 10.75H14.75M20.75 10.75C20.75 16.2728 16.2728 20.75 10.75 20.75C5.22715 20.75 0.75 16.2728 0.75 10.75C0.75 5.22715 5.22715 0.75 10.75 0.75C16.2728 0.75 20.75 5.22715 20.75 10.75Z" {...S} />
    </FigmaIcon>
  );
}

// Figma: close_circle (1975:55513 — "Close" row in the report-header
// more-actions dropdown).  Mirrors `IconPlusCircle`'s footprint
// (21.5 × 21.5 viewBox, identical outer circle path) but swaps the
// inner plus for an X — 6-unit centered cross from (7.75, 7.75) to
// (13.75, 13.75) so the X visually matches the circle's stroke
// weight without dominating it.
export function IconCloseCircle({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={21.5} nativeH={21.5} className={className}>
      <path d="M7.75 7.75L13.75 13.75M13.75 7.75L7.75 13.75M20.75 10.75C20.75 16.2728 16.2728 20.75 10.75 20.75C5.22715 20.75 0.75 16.2728 0.75 10.75C0.75 5.22715 5.22715 0.75 10.75 0.75C16.2728 0.75 20.75 5.22715 20.75 10.75Z" {...S} />
    </FigmaIcon>
  );
}

// Figma: list-bars (1844:78434, slot 3 — `Vector`).  Replaces the
// older 2×2 grid glyph: 4 horizontal bars (3 long + 3 short tick
// marks) at native viewBox 15.25 × 11.5, stroke 1.5.  The simpler
// "modules-as-list" reading aligns with how the panel below renders
// its items as stacked rows (not a 2×2 grid of cards).
export function IconModules({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={15.25} nativeH={11.5} className={className}>
      <path d="M5.125 0.75H14.5M5.125 5.75H14.5M5.125 10.75H14.5M0.75 0.75H2M0.75 5.75H2M0.75 10.75H2" {...S} />
    </FigmaIcon>
  );
}

// Figma: stack_plus (1844:78438) — the "Data modules" rail glyph in
// the split-sidebar architecture.  5 stroked paths at native viewBox
// 20×20, stroke 1.67.  Reads as "stacked layers + a small `+` ribbon
// at the bottom-right" — the data-source-add metaphor.  Brand-purple
// `#4D36FF` is the default fill the design renders against the
// active rail tint (#EDEAFF).
//
// `tileW={24} tileH={24}` scales the native 20×20 paths up to fill
// the entire 24×24 design tile (Figma's icon container), matching
// the size the rail design specs the glyph at.  Without the
// override, FigmaIcon would centre the 20×20 native inside the 24
// container, leaving 2 px of padding around the path bounds and
// shrinking the on-screen icon by ~17 % relative to spec.
export function IconStackPlus({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon
      size={size}
      color={color}
      nativeW={20}
      nativeH={20}
      tileW={24}
      tileH={24}
      tileX={0}
      tileY={0}
      className={className}
    >
      <path d="M2.5 10L10 14.375L17.5 10" {...S} strokeWidth={1.67} />
      <path d="M2.5 6.25L10 10.625L17.5 6.25L10 1.875L2.5 6.25Z" {...S} strokeWidth={1.67} />
      <path d="M14.375 15.625H18.125" {...S} strokeWidth={1.67} />
      <path d="M16.25 13.75V17.5" {...S} strokeWidth={1.67} />
      <path d="M2.5 13.75L10 18.125L11.25 17.3961" {...S} strokeWidth={1.67} />
    </FigmaIcon>
  );
}

// Figma: elements (1844:78446) — the "Elements" rail glyph in the
// split-sidebar architecture.  Filled-path icon (NOT stroked) at
// native viewBox 20×20.  Reads as "document with a list cluster +
// detail-cell" — a content-blocks metaphor that pairs with the
// Text / Heading / Image elements the panel exposes.  Same
// `tileW/tileH=24` override as IconStackPlus so both rail glyphs
// fill the same on-screen footprint.
export function IconElements({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon
      size={size}
      color={color}
      nativeW={20}
      nativeH={20}
      tileW={24}
      tileH={24}
      tileX={0}
      tileY={0}
      className={className}
    >
      <path
        d="M7.7449 17.015H8.4949V15.515H7.7449V16.265V17.015ZM8.25947 12.8626L8.7898 12.3323L7.72914 11.2716L7.19881 11.8019L7.72914 12.3323L8.25947 12.8626ZM14.8983 7.14053V7.89053H16.3983V7.14053H15.6483H14.8983ZM10.2689 11.651C10.2689 12.0652 10.6047 12.401 11.0189 12.401C11.4332 12.401 11.7689 12.0652 11.7689 11.651H11.0189H10.2689ZM11.0189 10.401V9.65097C10.6047 9.65097 10.2689 9.98676 10.2689 10.401H11.0189ZM17.6856 10.401H18.4356C18.4356 9.98676 18.0998 9.65097 17.6856 9.65097V10.401ZM16.9356 11.651C16.9356 12.0652 17.2714 12.401 17.6856 12.401C18.0998 12.401 18.4356 12.0652 18.4356 11.651H17.6856H16.9356ZM13.1023 16.3176C12.6881 16.3176 12.3523 16.6534 12.3523 17.0676C12.3523 17.4819 12.6881 17.8176 13.1023 17.8176V17.0676V16.3176ZM15.6023 17.8176C16.0165 17.8176 16.3523 17.4819 16.3523 17.0676C16.3523 16.6534 16.0165 16.3176 15.6023 16.3176V17.0676V17.8176ZM15.1023 10.401C15.1023 9.98676 14.7665 9.65097 14.3523 9.65097C13.9381 9.65097 13.6023 9.98676 13.6023 10.401H14.3523H15.1023ZM13.6023 17.0676C13.6023 17.4819 13.9381 17.8176 14.3523 17.8176C14.7665 17.8176 15.1023 17.4819 15.1023 17.0676H14.3523H13.6023ZM3.79642 2.93164V3.68164H14.1668V2.93164V2.18164H3.79642V2.93164ZM14.1668 2.93164V3.68164C14.5708 3.68164 14.8983 4.00914 14.8983 4.41312H15.6483H16.3983C16.3983 3.18071 15.3992 2.18164 14.1668 2.18164V2.93164ZM3.79642 16.265V15.515C3.39244 15.515 3.06494 15.1875 3.06494 14.7835H2.31494H1.56494C1.56494 16.0159 2.56401 17.015 3.79642 17.015V16.265ZM2.31494 14.7835H3.06494V4.41312H2.31494H1.56494V14.7835H2.31494ZM2.31494 4.41312H3.06494C3.06494 4.00914 3.39244 3.68164 3.79642 3.68164V2.93164V2.18164C2.56401 2.18164 1.56494 3.18071 1.56494 4.41312H2.31494ZM7.50013 7.00571H6.75013C6.75013 7.20515 6.58845 7.36683 6.38902 7.36683V8.11683V8.86683C7.41688 8.86683 8.25013 8.03358 8.25013 7.00571H7.50013ZM6.38902 8.11683V7.36683C6.18958 7.36683 6.0279 7.20515 6.0279 7.00571H5.2779H4.5279C4.5279 8.03358 5.36115 8.86683 6.38902 8.86683V8.11683ZM5.2779 7.00571H6.0279C6.0279 6.80628 6.18958 6.6446 6.38902 6.6446V5.8946V5.1446C5.36115 5.1446 4.5279 5.97785 4.5279 7.00571H5.2779ZM6.38902 5.8946V6.6446C6.58845 6.6446 6.75013 6.80628 6.75013 7.00571H7.50013H8.25013C8.25013 5.97785 7.41688 5.1446 6.38902 5.1446V5.8946ZM7.7449 16.265V15.515H3.79642V16.265V17.015H7.7449V16.265ZM7.72914 12.3323L7.19881 11.8019L3.26609 15.7346L3.79642 16.265L4.32675 16.7953L8.25947 12.8626L7.72914 12.3323ZM15.6483 4.41312H14.8983V7.14053H15.6483H16.3983V4.41312H15.6483ZM11.0189 11.651H11.7689V10.401H11.0189H10.2689V11.651H11.0189ZM11.0189 10.401V11.151H17.6856V10.401V9.65097H11.0189V10.401ZM17.6856 10.401H16.9356V11.651H17.6856H18.4356V10.401H17.6856ZM13.1023 17.0676V17.8176H15.6023V17.0676V16.3176H13.1023V17.0676ZM14.3523 10.401H13.6023V17.0676H14.3523H15.1023V10.401H14.3523Z"
        fill="var(--stroke-0, currentColor)"
      />
    </FigmaIcon>
  );
}

// Figma: gear (1133:104368) — settings cog.
export function IconSettings({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={21.7246} nativeH={23.5} className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18.9766 13.2075C19.0604 12.7345 19.1127 12.2477 19.1127 11.75C19.1127 11.2522 19.0604 10.7655 18.9766 10.2925L20.2668 9.23032C20.9012 8.70806 21.167 7.84298 20.8198 7.09826C20.5521 6.52419 20.2356 5.97408 19.8738 5.45442C19.4038 4.77954 18.5209 4.57653 17.7508 4.86491L16.1853 5.45112C15.4428 4.82412 14.5889 4.33187 13.6567 3.99637L13.3801 2.33594C13.2457 1.52923 12.6347 0.867472 11.8202 0.793492C11.5014 0.76453 11.182 0.75 10.8627 0.75C10.5433 0.75 10.2237 0.764535 9.90459 0.793505C9.09039 0.86743 8.47974 1.52896 8.3454 2.33539L8.06869 3.99637C7.13645 4.33187 6.28257 4.82412 5.54007 5.45112L3.97458 4.86491C3.20444 4.57653 2.32154 4.77953 1.85143 5.45429C1.48916 5.97427 1.17233 6.52474 0.904585 7.09919C0.557705 7.84341 0.82375 8.70767 1.45766 9.22954L2.74882 10.2925C2.66495 10.7655 2.6127 11.2522 2.6127 11.75C2.6127 12.2477 2.66495 12.7345 2.74882 13.2075L1.45766 14.2704C0.82375 14.7923 0.557706 15.6566 0.904585 16.4008C1.17233 16.9752 1.48916 17.5257 1.85144 18.0457C2.32154 18.7204 3.20443 18.9234 3.97458 18.6351L5.54007 18.0489C6.28257 18.6759 7.13645 19.1681 8.06869 19.5036L8.34539 21.1646C8.47974 21.971 9.09039 22.6325 9.90459 22.7065C10.2237 22.7354 10.5433 22.75 10.8627 22.75C11.182 22.75 11.5014 22.7354 11.8202 22.7065C12.6347 22.6325 13.2457 21.9707 13.3801 21.164L13.6567 19.5036C14.5889 19.1681 15.4428 18.6759 16.1853 18.0489L17.7508 18.6351C18.5209 18.9234 19.4038 18.7204 19.8738 18.0456C20.2356 17.5259 20.5521 16.9758 20.8198 16.4017C21.167 15.657 20.9012 14.7919 20.2668 14.2697L18.9766 13.2075Z"
        {...S}
      />
      <path
        d="M10.8672 14.75C12.5241 14.75 13.8672 13.4069 13.8672 11.75C13.8672 10.0931 12.5241 8.75 10.8672 8.75C9.21035 8.75 7.8672 10.0931 7.8672 11.75C7.8672 13.4069 9.21035 14.75 10.8672 14.75Z"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: info (1133:104453) — circled "i".
export function IconInfo({ className, size = 14, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={21.5} nativeH={21.5} className={className}>
      <path
        d="M10.75 14.75V10.75M10.75 6.75H10.76M20.75 10.75C20.75 16.2728 16.2728 20.75 10.75 20.75C5.22715 20.75 0.75 16.2728 0.75 10.75C0.75 5.22715 5.22715 0.75 10.75 0.75C16.2728 0.75 20.75 5.22715 20.75 10.75Z"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: search (1133:104345) — magnifier.
export function IconSearch({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={19.5} nativeH={19.5} className={className}>
      <path
        d="M18.75 18.75L14.4 14.4M16.75 8.75C16.75 13.1683 13.1683 16.75 8.75 16.75C4.33172 16.75 0.75 13.1683 0.75 8.75C0.75 4.33172 4.33172 0.75 8.75 0.75C13.1683 0.75 16.75 4.33172 16.75 8.75Z"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: chevron_down (1133:104546).
export function IconChevronDown({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={13.5} nativeH={7.5} className={className}>
      <path d="M0.75 0.75L6.75 6.75L12.75 0.75" {...S} />
    </FigmaIcon>
  );
}

// Figma: chevron_right (1133:104545).
export function IconChevronRight({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={7.5} nativeH={13.5} className={className}>
      <path d="M0.75 12.75L6.75 6.75L0.75 0.75" {...S} />
    </FigmaIcon>
  );
}

// Figma: select (711:2287) — bidirectional up/down chevrons shown next
// to a column header. Path + viewBox copied verbatim from the Figma
// asset (`08f7b0fbfe65343b9c5544dd90f829671221f15f.svg`):
//
//     viewBox  6.8333 × 10.8333
//     stroke   1.5  (round caps + joins)
//     d        M0.75 7.41667 L3.41667 10.0833 L6.08333 7.41667
//              M6.08333 3.41667 L3.41667 0.75 L0.75 3.41667
//
// Figma places the icon inside a 16-tile via inset-[20.83%_33.33%] (the
// vector itself) plus inset-[-8.04%_-14.06%] (stroke margin). We honor
// that by overriding `tileW`/`tileH` so the inner SVG occupies 10.26 ×
// 16.26 of our 24-unit base tile — exactly 6.84 × 10.84 px when size=16,
// matching Figma's footprint pixel-for-pixel. The viewBox-to-tile scale
// (1.502×) cancels out so the rendered stroke remains 1.5 px on screen,
// not stretched.
export function IconSortUpDown({ className, size = 16, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon
      size={size}
      color={color}
      nativeW={6.8333}
      nativeH={10.8333}
      tileW={10.26}
      tileH={16.26}
      className={className}
    >
      <path
        d="M0.75 7.41667L3.41667 10.0833L6.08333 7.41667M6.08333 3.41667L3.41667 0.75L0.75 3.41667"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: sort_down (711:2291) — vertical line + down-chevron at the
// foot, indicating the column is sorted DESCENDING. Path + viewBox copied
// verbatim from the Figma asset (`60064a17ac8af667c6556942e235a403a2ff6231.svg`):
//
//     viewBox  6.8333 × 10.8333
//     stroke   1.5  (round caps + joins)
//     d        M3.41667 0.75 V10.0833
//              M3.41667 10.0833 L6.08333 7.41667
//              M3.41667 10.0833 L0.75 7.41667
//
// Tile sizing matches `IconSortUpDown` exactly (10.26 × 16.26 within the
// 24-unit base tile) so the three sort glyphs occupy the same footprint
// and stroke weight when swapped in/out per sort state.
export function IconSortDown({ className, size = 16, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon
      size={size}
      color={color}
      nativeW={6.8333}
      nativeH={10.8333}
      tileW={10.26}
      tileH={16.26}
      className={className}
    >
      <path
        d="M3.41667 0.75V10.0833M3.41667 10.0833L6.08333 7.41667M3.41667 10.0833L0.75 7.41667"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: sort_up (711:2292) — vertical line + up-chevron at the head,
// indicating the column is sorted ASCENDING. Path + viewBox copied
// verbatim from the Figma asset (`8fb08a9b54d664d2bd626c4f29b7d16c212f55d9.svg`).
// Tile sizing matches `IconSortUpDown` / `IconSortDown`.
export function IconSortUp({ className, size = 16, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon
      size={size}
      color={color}
      nativeW={6.8333}
      nativeH={10.8333}
      tileW={10.26}
      tileH={16.26}
      className={className}
    >
      <path
        d="M3.41667 10.0833V0.75M3.41667 0.75L0.75 3.41667M3.41667 0.75L6.08333 3.41667"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: arrow_up_right — diagonal "open in / launch" arrow. Used by the
// "Open" item in the row action menu. Authored as a stroke-only path body
// at 24-tile so it shares the rest of the library's stroke treatment.
export function IconArrowUpRight({ className, size = 16, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={11.5} nativeH={11.5} className={className}>
      <path d="M0.75 10.75L10.75 0.75M10.75 0.75H0.75M10.75 0.75V10.75" {...S} />
    </FigmaIcon>
  );
}

// Figma: external_link (1133:104563) — boxed-frame with an arrow leaving
// from the top-right corner, the canonical "opens in a new place" glyph.
// Used by the row action menu's `Share` item (the row-level kebab menu's
// share affordance routes the user OUT to a share surface, so the
// external-link metaphor matches better than the generic share-fan).
// Native 19.5 × 19.5 viewBox, stroke 1.5, exported verbatim from Figma.
export function IconExternalLink({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={19.5} nativeH={19.5} className={className}>
      <path
        d="M15.75 10.75V16.75C15.75 17.2804 15.5393 17.7891 15.1642 18.1642C14.7891 18.5393 14.2804 18.75 13.75 18.75H2.75C2.21957 18.75 1.71086 18.5393 1.33579 18.1642C0.960714 17.7891 0.75 17.2804 0.75 16.75V5.75C0.75 5.21957 0.960714 4.71086 1.33579 4.33579C1.71086 3.96071 2.21957 3.75 2.75 3.75H8.75M12.75 0.75H18.75M18.75 0.75V6.75M18.75 0.75L7.75 11.75"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: arrow_right (icon-l on the carousel forward button, 1295:124151).
// Source: 16×16 stroke arrow `M1 8H15M15 8L8 1M15 8L8 15` — straight line
// + V-head — rendered at stroke-width 2 in #585764 (button neutral fg).
export function IconArrowRight({ className, size = 16, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={14} nativeH={14} className={className}>
      <path d="M0.75 7L13.25 7M13.25 7L7 0.75M13.25 7L7 13.25" {...S} />
    </FigmaIcon>
  );
}

// Figma: arrow_left — mirror of `arrow_right`. Same 14×14 footprint and
// stroke-width-1.5 treatment as the rest of the stroke library, so it
// pairs visually with `IconArrowRight` on a back/forward carousel.
// Path = arrow_right reflected through x=7 (head moved to the left
// terminus, tail stays horizontal).
export function IconArrowLeft({ className, size = 16, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={14} nativeH={14} className={className}>
      <path d="M13.25 7L0.75 7M0.75 7L7 0.75M0.75 7L7 13.25" {...S} />
    </FigmaIcon>
  );
}

// Figma: bell (1133:104343-ish) — outline bell with clapper, used by the
// app bar's notification button. Not present in earlier exports — added
// here so the top-app-bar can avoid raw SVG.
export function IconBell({ className, size = 18, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={17.5} nativeH={19.5} className={className}>
      <path
        d="M8.75 0.75C5.99 0.75 3.75 2.99 3.75 5.75V8.25C3.75 9.46 3.27 10.62 2.41 11.48L0.75 13.14V14.75H16.75V13.14L15.09 11.48C14.23 10.62 13.75 9.46 13.75 8.25V5.75C13.75 2.99 11.51 0.75 8.75 0.75ZM8.75 18.75C7.65 18.75 6.75 17.85 6.75 16.75H10.75C10.75 17.85 9.85 18.75 8.75 18.75Z"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: edit pen, simplified Compose-button glyph (top app bar). Native
// authored at 19×19, similar to the "edit" icon but tighter — matches the
// inline 19-px Compose icon in node 1290:101871.
export function IconCompose({ className, size = 19, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={17.5} nativeH={17.5} className={className}>
      <path
        d="M8.75 1.25H2.5C1.81 1.25 1.25 1.81 1.25 2.5V14.5C1.25 15.19 1.81 15.75 2.5 15.75H14.5C15.19 15.75 15.75 15.19 15.75 14.5V8.25M14.99 1.07L17.18 3.26C17.66 3.74 17.66 4.51 17.18 4.99L9.42 12.75L5.25 13.75L6.25 9.58L14.01 1.82C14.49 1.34 15.26 1.34 15.74 1.82L14.99 1.07Z"
        {...S}
      />
    </FigmaIcon>
  );
}

// Lucide "printer" — used in the report header's more-actions
// dropdown alongside Share.  Standard Lucide path at 24×24 viewBox;
// FigmaIcon's centering math handles the inset.  Stroke matches the
// rest of the library (1.5 px non-scaling) so the glyph reads at the
// same weight as Share's `IconExternalLink` neighbour in the
// dropdown.
export function IconPrinter({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={24} nativeH={24} tileW={24} tileH={24} tileX={0} tileY={0} className={className}>
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" {...S} />
    </FigmaIcon>
  );
}

// Premium tag glyph — "diamond" icon used in the Start-from-scratch tag
// (Figma I701:34684;244:2277). Native authored 14-tile rhombus.
export function IconPremiumDiamond({ className, size = 14, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={11.5} nativeH={9.5} tileW={11.5} tileH={9.5} className={className}>
      <path
        d="M3.0625 0.75L0.75 3.0625L5.75 8.0625L10.75 3.0625L8.4375 0.75H3.0625Z M0.75 3.0625H10.75"
        stroke="var(--stroke-0, currentColor)"
        strokeWidth={1.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </FigmaIcon>
  );
}

// Figma: user (1133:104277).
export function IconUser({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={17.5} nativeH={19.5} className={className}>
      <path
        d="M8.75 8.75C10.9591 8.75 12.75 6.95914 12.75 4.75C12.75 2.54086 10.9591 0.75 8.75 0.75C6.54086 0.75 4.75 2.54086 4.75 4.75C4.75 6.95914 6.54086 8.75 8.75 8.75Z"
        {...S}
      />
      <path
        d="M0.75 15.75C0.75 14.0931 2.09315 12.75 3.75 12.75H13.75C15.4069 12.75 16.75 14.0931 16.75 15.75C16.75 17.4069 15.4069 18.75 13.75 18.75H3.75C2.09315 18.75 0.75 17.4069 0.75 15.75Z"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: user_plus (1133:104280).
export function IconUserPlus({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={23.5} nativeH={19.5} className={className}>
      <path
        d="M19.75 5.75V11.75M22.75 8.75H16.75M3.75 18.75C2.09315 18.75 0.75 17.4069 0.75 15.75C0.75 14.0931 2.09315 12.75 3.75 12.75H12.75C14.4069 12.75 15.75 14.0931 15.75 15.75C15.75 17.4069 14.4069 18.75 12.75 18.75H3.75ZM12.25 4.75C12.25 6.95914 10.4591 8.75 8.25 8.75C6.04086 8.75 4.25 6.95914 4.25 4.75C4.25 2.54086 6.04086 0.75 8.25 0.75C10.4591 0.75 12.25 2.54086 12.25 4.75Z"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: calendar (1133:104373).
export function IconCalendar({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={19.5} nativeH={21.5} className={className}>
      <path
        d="M13.75 0.75V4.75M5.75 0.75V4.75M0.75 8.75H18.75M2.75 2.75H16.75C17.8546 2.75 18.75 3.64543 18.75 4.75V18.75C18.75 19.8546 17.8546 20.75 16.75 20.75H2.75C1.64543 20.75 0.75 19.8546 0.75 18.75V4.75C0.75 3.64543 1.64543 2.75 2.75 2.75Z"
        {...S}
      />
    </FigmaIcon>
  );
}

// ─── Chart types ─────────────────────────────────────────────────────────────

// Figma: bar_chart (1133:104699).
export function IconBarChart({ className, size = 14, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={13.5} nativeH={17.5} className={className}>
      <path d="M12.75 16.75V6.75M6.75 16.75V0.75M0.75 16.75V10.75" {...S} />
    </FigmaIcon>
  );
}

// Figma: ChartLineUp (1026:38628) — L-shaped axes with an upward-trending
// zigzag and arrow head. This is the chart-type INDICATOR variant used in
// module headers AND the Visual-type chip row (1026:40392). Native SVG is
// authored in 16-tile coordinates (0 0 16 16); we pair nativeW=16 with
// tileW=24 to render it at the full 24-tile extent. Stroke width is 1.0 in
// the 16-unit path space, which scales to the canonical 1.5 in 24-tile
// space (1.0 × 24/16 = 1.5) — matching every other chart icon in the
// design system. Previously this was 1.33 (→ 2.0 visual), incorrectly
// rendering noticeably thicker than Figma.
export function IconLineChart({ className, size = 14, color = 'currentColor' }: IconProps) {
  const chartStroke = {
    stroke: 'var(--stroke-0, #201E24)',
    strokeWidth: 1.0,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <FigmaIcon size={size} color={color} nativeW={16} nativeH={16} tileW={24} tileH={24} className={className}>
      <path d="M14 13H2V3" {...chartStroke} />
      <path d="M12.5 4.5L8 9L6 7L2 11" {...chartStroke} />
      <path d="M12.5 7V4.5H10" {...chartStroke} />
    </FigmaIcon>
  );
}

// Figma: TrendUp (1026:40395) — ascending trend line inside an L-shaped axis
// frame. Used in the Visual-type chip row (1026:40316) as the AREA chart
// marker. Authored at 24×24 natively; path body spans the whole tile.
// Stroke width 1.5 in 24-tile space matches the rest of the library.
export function IconAreaChart({ className, size = 14, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={24} nativeH={24} className={className}>
      <path d="M21.75 5.25L12.75 13.25L9 9.5L2.25 17.25" {...S} />
      <path d="M21.7861 5.29492L21.7861 16.2511C21.7861 16.8034 21.3383 17.2511 20.786 17.2511L2.30063 17.2504" {...S} />
    </FigmaIcon>
  );
}

// Bubble / scatter chart — three circles of varying radius plotted
// against an L-axis. Authored at 24×24 to match the rest of the
// chart-type icon set. Stroke-only (no fills) so it reads at 14 px in
// the segmented control and 20 px in the dropdown.
export function IconBubbleChart({ className, size = 14, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={24} nativeH={24} className={className}>
      <path d="M3 3V21H21" {...S} />
      <circle cx="9"  cy="15" r="2"   {...S} fill="none" />
      <circle cx="14" cy="9"  r="3"   {...S} fill="none" />
      <circle cx="18" cy="16" r="1.5" {...S} fill="none" />
    </FigmaIcon>
  );
}

// Figma: pie_chart (1133:104703).
export function IconPieChart({ className, size = 14, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={21.5004} nativeH={21.4953} className={className}>
      <path
        d="M19.9604 14.64C19.3242 16.1445 18.3292 17.4702 17.0623 18.5013C15.7954 19.5324 14.2952 20.2374 12.6928 20.5548C11.0905 20.8721 9.43483 20.7921 7.87055 20.3218C6.30627 19.8514 4.88103 19.0051 3.71942 17.8567C2.55782 16.7082 1.69522 15.2928 1.20704 13.7339C0.718859 12.1751 0.619965 10.5205 0.919001 8.91463C1.21804 7.30878 1.9059 5.80063 2.92245 4.52203C3.939 3.24343 5.25329 2.23332 6.7504 1.58M20.7504 10.75C20.7504 9.43678 20.4917 8.13642 19.9892 6.92317C19.4867 5.70991 18.7501 4.60752 17.8215 3.67893C16.8929 2.75035 15.7905 2.01375 14.5772 1.5112C13.364 1.00866 12.0636 0.75 10.7504 0.75V10.75H20.7504Z"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: Hashtag (373:25230) — two horizontal + two vertical strokes forming
// a `#` glyph. Used in the Visual-type chip row (1026:40316) as the METRIC
// CARD marker. Authored at 24×24 natively; stroke width 1.5 in 24-tile
// space matches the rest of the library.
export function IconMetric({ className, size = 14, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={24} nativeH={24} className={className}>
      <path d="M4 9H20M4 15H20M10 3L8 21M16 3L14 21" {...S} />
    </FigmaIcon>
  );
}

// Figma: Table (1133:104733).
export function IconTable({ className, size = 14, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={19.5} nativeH={19.5} className={className}>
      <path
        d="M7.5 0.75C7.5 0.335786 7.16421 0 6.75 0C6.33579 0 6 0.335786 6 0.75H6.75H7.5ZM6 18.75C6 19.1642 6.33579 19.5 6.75 19.5C7.16421 19.5 7.5 19.1642 7.5 18.75H6.75H6ZM13.5 0.75C13.5 0.335786 13.1642 0 12.75 0C12.3358 0 12 0.335786 12 0.75H12.75H13.5ZM12 18.75C12 19.1642 12.3358 19.5 12.75 19.5C13.1642 19.5 13.5 19.1642 13.5 18.75H12.75H12ZM2.75 0.75V1.5H16.75V0.75V0H2.75V0.75ZM16.75 0.75V1.5C17.4404 1.5 18 2.05964 18 2.75H18.75H19.5C19.5 1.23122 18.2688 0 16.75 0V0.75ZM18.75 2.75H18V16.75H18.75H19.5V2.75H18.75ZM18.75 16.75H18C18 17.4404 17.4404 18 16.75 18V18.75V19.5C18.2688 19.5 19.5 18.2688 19.5 16.75H18.75ZM16.75 18.75V18H2.75V18.75V19.5H16.75V18.75ZM2.75 18.75V18C2.05964 18 1.5 17.4404 1.5 16.75H0.75H0C0 18.2688 1.23122 19.5 2.75 19.5V18.75ZM0.75 16.75H1.5V2.75H0.75H0V16.75H0.75ZM0.75 2.75H1.5C1.5 2.05964 2.05964 1.5 2.75 1.5V0.75V0C1.23122 0 0 1.23122 0 2.75H0.75ZM6.75 0.75H6V18.75H6.75H7.5V0.75H6.75ZM12.75 0.75H12V18.75H12.75H13.5V0.75H12.75ZM0.75 6.59789V7.34789H18.75V6.59789V5.84789H0.75V6.59789ZM0.75 12.7446V13.4946H18.75V12.7446V11.9946H0.75V12.7446Z"
        fill="var(--stroke-0, #201E24)"
      />
    </FigmaIcon>
  );
}

// Figma: ListDashes (1133:104734) — bulleted list.
export function IconList({ className, size = 14, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={18} nativeH={13.5} className={className}>
      <path
        d="M6 0.75H17.25M6 6.75H17.25M6 12.75H17.25M0.75 0.75H2.25M0.75 6.75H2.25M0.75 12.75H2.25"
        {...S}
      />
    </FigmaIcon>
  );
}

// ─── Actions ─────────────────────────────────────────────────────────────────

// Figma: file_copy (1133:104353).
export function IconCopy({ className, size = 14, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={17.5} nativeH={21.5} className={className}>
      <path
        d="M10.75 3.75H5.75C5.21957 3.75 4.71086 3.96071 4.33579 4.33579C3.96071 4.71086 3.75 5.21957 3.75 5.75V18.75C3.75 19.2804 3.96071 19.7891 4.33579 20.1642C4.71086 20.5393 5.21957 20.75 5.75 20.75H14.75C15.2804 20.75 15.7891 20.5393 16.1642 20.1642C16.5393 19.7891 16.75 19.2804 16.75 18.75V9.75M10.75 3.75L16.75 9.75M10.75 3.75V9.75H16.75M10.75 0.75H2.75004C1.64545 0.749993 0.749996 1.64544 0.75 2.75002V16.75"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: trash (1133:104328).
export function IconTrash({ className, size = 14, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={19.5} nativeH={21.5} className={className}>
      <path
        d="M0.75 4.75H2.75M2.75 4.75H18.75M2.75 4.75V18.75C2.75 19.2804 2.96071 19.7891 3.33579 20.1642C3.71086 20.5393 4.21957 20.75 4.75 20.75H14.75C15.2804 20.75 15.7891 20.5393 16.1642 20.1642C16.5393 19.7891 16.75 19.2804 16.75 18.75V4.75H2.75ZM5.75 4.75V2.75C5.75 2.21957 5.96071 1.71086 6.33579 1.33579C6.71086 0.960714 7.21957 0.75 7.75 0.75H11.75C12.2804 0.75 12.7891 0.960714 13.1642 1.33579C13.5393 1.71086 13.75 2.21957 13.75 2.75V4.75M7.75 9.75V15.75M11.75 9.75V15.75"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: check (node I1232:311163;683:998 as used in the chart-type
// dropdown row's active indicator). Standard Phosphor-style checkmark:
// two-segment polyline from lower-left through a low pivot up to the
// upper-right. Path authored at the same 24-tile stroke convention as
// the rest of the library (stroke width 1.5).
export function IconCheck({ className, size = 16, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={15.5} nativeH={11.5} className={className}>
      <path d="M0.75 6.25L5.25 10.75L14.75 0.75" {...S} />
    </FigmaIcon>
  );
}

// Figma: share (1133:104401).
export function IconShare({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={19.5} nativeH={21.5} className={className}>
      <path
        d="M6.34 12.26L13.17 16.24M13.16 5.26L6.34 9.24M18.75 3.75C18.75 5.40685 17.4069 6.75 15.75 6.75C14.0931 6.75 12.75 5.40685 12.75 3.75C12.75 2.09315 14.0931 0.75 15.75 0.75C17.4069 0.75 18.75 2.09315 18.75 3.75ZM6.75 10.75C6.75 12.4069 5.40685 13.75 3.75 13.75C2.09315 13.75 0.75 12.4069 0.75 10.75C0.75 9.09315 2.09315 7.75 3.75 7.75C5.40685 7.75 6.75 9.09315 6.75 10.75ZM18.75 17.75C18.75 19.4069 17.4069 20.75 15.75 20.75C14.0931 20.75 12.75 19.4069 12.75 17.75C12.75 16.0931 14.0931 14.75 15.75 14.75C17.4069 14.75 18.75 16.0931 18.75 17.75Z"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: download (1133:104336).
export function IconDownload({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={19.5} nativeH={19.5} className={className}>
      <path
        d="M18.75 12.75V16.75C18.75 17.2804 18.5393 17.7891 18.1642 18.1642C17.7891 18.5393 17.2804 18.75 16.75 18.75H2.75C2.21957 18.75 1.71086 18.5393 1.33579 18.1642C0.960714 17.7891 0.75 17.2804 0.75 16.75V12.75M4.75 7.75L9.75 12.75M9.75 12.75L14.75 7.75M9.75 12.75V0.75"
        {...S}
      />
    </FigmaIcon>
  );
}

// ─── Status / alert icons ─────────────────────────────────────────────────────

// Figma: danger (1133:104451).
export function IconDanger({ className, size = 14, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={21.5} nativeH={21.5} className={className}>
      <path
        d="M10.75 6.75V10.75M10.75 14.75H10.76M6.61 0.75H14.89L20.75 6.61V14.89L14.89 20.75H6.61L0.75 14.89V6.61L6.61 0.75Z"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: warning (1133:104452).
export function IconWarning({ className, size = 14, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={22.396} nativeH={19.6028} className={className}>
      <path
        d="M11.198 6.85274V10.8527M11.198 14.8527H11.208M9.48802 1.71274L1.01802 15.8527C0.843387 16.1552 0.750986 16.498 0.750008 16.8473C0.74903 17.1965 0.83951 17.5399 1.01245 17.8433C1.18538 18.1467 1.43474 18.3995 1.73573 18.5766C2.03671 18.7537 2.37882 18.8489 2.72802 18.8527H19.668C20.0172 18.8489 20.3593 18.7537 20.6603 18.5766C20.9613 18.3995 21.2107 18.1467 21.3836 17.8433C21.5565 17.5399 21.647 17.1965 21.646 16.8473C21.6451 16.498 21.5527 16.1552 21.378 15.8527L12.908 1.71274C12.7297 1.41885 12.4787 1.17586 12.1792 1.00723C11.8797 0.838592 11.5418 0.75 11.198 0.75C10.8543 0.75 10.5163 0.838592 10.2168 1.00723C9.9173 1.17586 9.66629 1.41885 9.48802 1.71274Z"
        {...S}
      />
    </FigmaIcon>
  );
}

// Figma: hourglass (1133:104462).
export function IconHourglass({ className, size = 14, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={17.5} nativeH={21.5} className={className}>
      <path
        d="M0.75 0.75H16.75M0.75 20.75H16.75M2.75 0.75V3.00371C2.75 5.34419 3.91971 7.52981 5.8671 8.82807L8.75 10.75M8.75 10.75L11.6329 12.6719C13.5803 13.9702 14.75 16.1558 14.75 18.4963V20.75M8.75 10.75L11.6329 8.82807C13.5803 7.52981 14.75 5.34419 14.75 3.00371V0.75M8.75 10.75L5.8671 12.6719C3.91971 13.9702 2.75 16.1558 2.75 18.4963V20.75"
        {...S}
      />
    </FigmaIcon>
  );
}

// ─── Elements (Basic blocks + Media) ────────────────────────────────────────
// Authored at 20×20 native (Figma's Elements panel exports icons in a 20-tile,
// NOT the 24-tile used elsewhere in the library). We fit the 20-unit viewBox
// inside the standard 24-tile via `tileW=24, tileH=24` so:
//   • stroke weight of 1.25 in path-space → 1.5 in 24-tile space (matches the
//     rest of the design-system stroke-weight convention)
//   • at `size=20`, visual stroke = 1.25 px (pixel-matches Figma's default
//     render)
// All 8 icons share the same stroke style — collected once as `SE`.

const SE = {
  stroke: 'var(--stroke-0, #201E24)',
  strokeWidth: 1.25,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// Figma: Text — capital T with serif marks.
export function IconText({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={20} nativeH={20} tileW={24} tileH={24} className={className}>
      <path d="M3.3335 5.83301V3.33301H16.6668V5.83301M7.50016 16.6663H12.5002M10.0002 3.33301V16.6663" {...SE} />
    </FigmaIcon>
  );
}

// Figma: Heading 1 — two vertical bars joined by a crossbar, plus a `1` glyph.
export function IconHeading1({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={20} nativeH={20} tileW={24} tileH={24} className={className}>
      <path d="M3.125 4.375V13.75" {...SE} />
      <path d="M11.25 9.0625H3.125" {...SE} />
      <path d="M11.25 4.375V13.75" {...SE} />
      <path d="M17.5 16.25V8.75L15.625 10" {...SE} />
    </FigmaIcon>
  );
}

// Figma: Heading 2 — two vertical bars joined by a crossbar, plus a `2` glyph.
export function IconHeading2({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={20} nativeH={20} tileW={24} tileH={24} className={className}>
      <path d="M3.125 4.375V13.75" {...SE} />
      <path d="M11.25 9.0625H3.125" {...SE} />
      <path d="M11.25 4.375V13.75" {...SE} />
      <path d="M18.75 16.2495H15L18.3727 11.7526C18.5352 11.5366 18.6492 11.2881 18.7067 11.0239C18.7642 10.7598 18.7639 10.4864 18.7059 10.2223C18.6478 9.95833 18.5334 9.70999 18.3704 9.49435C18.2074 9.27871 17.9996 9.10086 17.7615 8.973C17.5233 8.84514 17.2603 8.77029 16.9905 8.75359C16.7207 8.73688 16.4505 8.77871 16.1984 8.8762C15.9462 8.9737 15.7182 9.12456 15.5298 9.31844C15.3414 9.51233 15.1972 9.74465 15.107 9.99948" {...SE} />
    </FigmaIcon>
  );
}

// Figma: Divider — single horizontal rule.
export function IconDivider({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={20} nativeH={20} tileW={24} tileH={24} className={className}>
      <path d="M3.125 10H16.875" {...SE} />
    </FigmaIcon>
  );
}

// Figma: Emoji — smiley face.
export function IconEmoji({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={20} nativeH={20} tileW={24} tileH={24} className={className}>
      <path d="M6.6665 9.16699C6.6665 9.16699 7.9165 10.8337 9.99984 10.8337C12.0832 10.8337 13.3332 9.16699 13.3332 9.16699M7.49984 6.66699H7.50817M12.4998 6.66699H12.5082M18.3332 10.0003C18.3332 14.6027 14.6022 18.3337 9.99984 18.3337C5.39746 18.3337 1.6665 14.6027 1.6665 10.0003C1.6665 5.39795 5.39746 1.66699 9.99984 1.66699C14.6022 1.66699 18.3332 5.39795 18.3332 10.0003Z" {...SE} />
    </FigmaIcon>
  );
}

// Figma: Image — frame with mountain and sun.
export function IconImage({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={20} nativeH={20} tileW={24} tileH={24} className={className}>
      <path d="M4.16667 17.5H15.8333C16.7538 17.5 17.5 16.7538 17.5 15.8333V4.16667C17.5 3.24619 16.7538 2.5 15.8333 2.5H4.16667C3.24619 2.5 2.5 3.24619 2.5 4.16667V15.8333C2.5 16.7538 3.24619 17.5 4.16667 17.5ZM4.16667 17.5L13.3333 8.33333L17.5 12.5M4.16667 17.5L10.8333 10.8333L17.0117 17.0117M8.33333 7.08333C8.33333 7.77369 7.77369 8.33333 7.08333 8.33333C6.39298 8.33333 5.83333 7.77369 5.83333 7.08333C5.83333 6.39298 6.39298 5.83333 7.08333 5.83333C7.77369 5.83333 8.33333 6.39298 8.33333 7.08333Z" {...SE} />
    </FigmaIcon>
  );
}

// Figma: File — page with folded corner.
export function IconFile({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={20} nativeH={20} tileW={24} tileH={24} className={className}>
      <path d="M11.6668 1.66699H5.00016C4.55814 1.66699 4.13421 1.84259 3.82165 2.15515C3.50909 2.46771 3.3335 2.89163 3.3335 3.33366V16.667C3.3335 17.109 3.50909 17.5329 3.82165 17.8455C4.13421 18.1581 4.55814 18.3337 5.00016 18.3337H15.0002C15.4422 18.3337 15.8661 18.1581 16.1787 17.8455C16.4912 17.5329 16.6668 17.109 16.6668 16.667V6.66699M11.6668 1.66699L16.6668 6.66699M11.6668 1.66699V6.66699H16.6668" {...SE} />
    </FigmaIcon>
  );
}

// Figma: Link — chain link.
export function IconLink({ className, size = 20, color = 'currentColor' }: IconProps) {
  return (
    <FigmaIcon size={size} color={color} nativeW={20} nativeH={20} tileW={24} tileH={24} className={className}>
      <path d="M12.5002 5.83301H15.0002C15.5473 5.83301 16.0892 5.94078 16.5947 6.15018C17.1002 6.35957 17.5595 6.66649 17.9464 7.0534C18.3334 7.44031 18.6403 7.89964 18.8497 8.40516C19.0591 8.91068 19.1668 9.4525 19.1668 9.99967C19.1668 10.5468 19.0591 11.0887 18.8497 11.5942C18.6403 12.0997 18.3334 12.559 17.9464 12.946C17.5595 13.3329 17.1002 13.6398 16.5947 13.8492C16.0892 14.0586 15.5473 14.1663 15.0002 14.1663H12.5002M7.50016 14.1663H5.00016C4.45299 14.1663 3.91117 14.0586 3.40565 13.8492C2.90013 13.6398 2.4408 13.3329 2.05388 12.946C1.27248 12.1646 0.833496 11.1047 0.833496 9.99967C0.833496 8.89461 1.27248 7.8348 2.05388 7.0534C2.83529 6.27199 3.89509 5.83301 5.00016 5.83301H7.50016M6.66683 9.99967H13.3335" {...SE} />
    </FigmaIcon>
  );
}

// ─── Metric trend indicators ────────────────────────────────────────────────
//
// Figma: `arrow_up_right` (green circle, positive-change indicator) and
// `arrow_down_left` (red circle, negative-change indicator) as used in the
// metric-card Comparison frame (e.g. 1197:269314). Authored at 16×16 native
// with a filled circle + stroked arrow path — distinct from the rest of the
// library which is stroke-only.
//
// Color handling: the circle fill and the stroke are BOTH design-token
// values that differ between up/down variants. Unlike stroke-only icons we
// can't drive them via a single --stroke-0 override; instead each variant
// hardcodes its semantic colors. These are not recolorable — that's
// intentional: "green up / red down" is part of the message, not a theme
// decision.
//
// We render the 16-unit authored SVG filling the whole 24-tile (tileW=24,
// tileH=24), which means a `size=16` render draws at native proportions
// (1px stroke renders as 1 × (16/24 × 24/16) = 1 px).

export function IconTrendUp({ className, size = 16 }: IconProps) {
  return (
    <FigmaIcon size={size} color="transparent" nativeW={16} nativeH={16} tileW={24} tileH={24} className={className}>
      {/* Green-600 circle background (#006B43) with a light-green stroked
          arrow (#CCF6E6) pointing to the top-right. Exact hex values from
          the Figma variable defs — DO NOT approximate to generic green. */}
      <rect width="16" height="16" rx="8" fill="#006B43" />
      <path
        d="M4.6665 11.3337L11.3332 4.66699M11.3332 4.66699H4.6665M11.3332 4.66699V11.3337"
        stroke="#CCF6E6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </FigmaIcon>
  );
}

export function IconTrendDown({ className, size = 16 }: IconProps) {
  return (
    <FigmaIcon size={size} color="transparent" nativeW={16} nativeH={16} tileW={24} tileH={24} className={className}>
      {/* Red circle background (#CE091C) with a light-red stroked arrow
          (#FACED2) pointing to the bottom-left. */}
      <rect width="16" height="16" rx="8" fill="#CE091C" />
      <path
        d="M11.3332 4.66699L4.6665 11.3337M4.6665 11.3337H11.3332M4.6665 11.3337V4.66699"
        stroke="#FACED2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </FigmaIcon>
  );
}

// ─── Drag handle ─────────────────────────────────────────────────────────────

// Figma: DotsSixVertical (349:19030) — the 2×3 grip-dot pattern used on
// AddModulePanel module-list rows (I1026:38579;349:19030) and equivalent
// drag handles. The native SVG is authored directly in 24-tile coordinates
// (viewBox 0 0 24 24), so nativeW/nativeH = 24 and the whole tile is the
// Vector footprint — no tileW/tileH override needed.
//
// Note: this is a FILLED icon (six solid circles), not stroked, so we skip
// the shared `S` props and use `fill` from the --stroke-0 variable. The
// default color is DARK/dark--tint_70 (#BCBBBD) per the Figma style.
export function IconDragHandle({ className, size = 16, color = '#BCBBBD' }: IconProps) {
  const fill = 'var(--stroke-0, #BCBBBD)';
  return (
    <FigmaIcon size={size} color={color} nativeW={24} nativeH={24} className={className}>
      <path d="M9.5 8.49997C10.3284 8.49997 11 7.8284 11 6.99997C11 6.17154 10.3284 5.49997 9.5 5.49997C8.67157 5.49997 8 6.17154 8 6.99997C8 7.8284 8.67157 8.49997 9.5 8.49997Z" fill={fill} />
      <path d="M14.5 8.49997C15.3284 8.49997 16 7.8284 16 6.99997C16 6.17154 15.3284 5.49997 14.5 5.49997C13.6716 5.49997 13 6.17154 13 6.99997C13 7.8284 13.6716 8.49997 14.5 8.49997Z" fill={fill} />
      <path d="M9.5 13.5C10.3284 13.5 11 12.8284 11 12C11 11.1715 10.3284 10.5 9.5 10.5C8.67157 10.5 8 11.1715 8 12C8 12.8284 8.67157 13.5 9.5 13.5Z" fill={fill} />
      <path d="M14.5 13.5C15.3284 13.5 16 12.8284 16 12C16 11.1715 15.3284 10.5 14.5 10.5C13.6716 10.5 13 11.1715 13 12C13 12.8284 13.6716 13.5 14.5 13.5Z" fill={fill} />
      <path d="M9.5 18.5C10.3284 18.5 11 17.8284 11 17C11 16.1715 10.3284 15.5 9.5 15.5C8.67157 15.5 8 16.1715 8 17C8 17.8284 8.67157 18.5 9.5 18.5Z" fill={fill} />
      <path d="M14.5 18.5C15.3284 18.5 16 17.8284 16 17C16 16.1715 15.3284 15.5 14.5 15.5C13.6716 15.5 13 16.1715 13 17C13 17.8284 13.6716 18.5 14.5 18.5Z" fill={fill} />
    </FigmaIcon>
  );
}
