'use client';

/**
 * Sendible top app bar — Figma 1290:101688 (`Nav` frame, 1728-wide
 * reference layout). Built to match the Figma metadata literally:
 * every fixed offset, item width, padding, and icon placement comes
 * straight from the design and is reproduced rather than approximated.
 *
 * Composition (top to bottom):
 *
 *   1. Utility row (h-29.39, bg #F1F0F8):
 *
 *        ←─ pl-20 ─→
 *        ┌──────────────────────────────────────┐  ┌────────────────┐
 *        │ My dashboard ▾   10:16     🔔        │  │ avatar  WL A ▾ │
 *        └──────────────────────────────────────┘  └────────────────┘
 *               226.22 wide, fixed                       87.16 wide
 *
 *      Children inside each group are laid out with absolute pixel
 *      offsets (avatar y=6.39, time y=7, bell y=9, etc.) — the design
 *      is too positionally-specific for flex baseline alignment to
 *      reproduce faithfully.
 *
 *   2. Main row (h-59, bg #F1F0F8, shadow `0_1px_0_rgba(32,30,36,0.2)`):
 *
 *        ┌──────┐  ┌──────────────────────────┐                 ┌─────────────────────┐
 *        │ logo │  │ Publish · Activity · …   │  ←── flex-1 ──→ │ 🔼  [✏ Compose]      │
 *        └──────┘  └──────────────────────────┘                 └─────────────────────┘
 *         w-160      ml-48 (= page-x 208)                          mr-10
 *
 *      The nav is anchored 48 px after the logo Link (so its first
 *      label sits at page-x=208 per the design) — it is NOT centered
 *      in the available space. The right cluster pins to the right
 *      edge with a 10-px gutter.
 *
 *      Each nav Item width matches Figma exactly:
 *        Publish 51.94 · Activity 52.37 · Content 54.9 ·
 *        Reports 54.31 · Profiles 69.81
 *      with a 32-px gap between Items.
 *
 * Brand assets (logo + the 5 icons) live under `/public/sendible-nav/`
 * as the SVGs Figma exports verbatim — the wordmark in particular is a
 * 3-color, 11-path glyph that doesn't belong in the one-color
 * `SendiIcons` library. The avatar PNG is served from `/sendible-avatar.png`.
 *
 * No routing wired — every link is a no-op `<button>`/`<a>` in this
 * prototype. Active route highlighting is not part of this Figma comp,
 * so we don't paint one.
 */

interface NavItemSpec {
  label: 'Publish' | 'Activity' | 'Content' | 'Reports' | 'Profiles';
  width: number;
}

// Exact Link widths from Figma (1290:101876 / 79 / 82 / 85 / 88).
const NAV_ITEMS: NavItemSpec[] = [
  { label: 'Publish',  width: 51.94 },
  { label: 'Activity', width: 52.37 },
  { label: 'Content',  width: 54.9  },
  { label: 'Reports',  width: 54.31 },
  { label: 'Profiles', width: 69.81 },
];

export function TopAppBar() {
  return (
    <header
      className="w-full bg-[#F1F0F8] select-none"
      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
    >
      {/* ── Utility row ──────────────────────────────────────────────── */}
      <div className="h-[29.39px] flex items-start justify-between pl-[20px] pr-[11px]">
        {/* Left group — My dashboard ▾ · 10:16 · bell. The three pieces
            sit at very specific vertical offsets per Figma; absolute
            positioning inside a fixed-width track reproduces the design
            literally rather than approximating with flex baselines. */}
        <div className="relative w-[226.22px] h-[29px] flex-shrink-0">
          {/* "My dashboard ▾" Link (1290:101901): pt-6.75 pb-0.25 pr-10,
              gap-7 between text and chevron. */}
          <button
            type="button"
            className="absolute left-0 top-0 flex items-center gap-[7px] pr-[10px] pt-[6.75px] pb-[0.25px] hover:opacity-80 transition-opacity"
          >
            <span className="text-[14px] leading-[22px] font-medium text-[#201E24] whitespace-nowrap">
              My dashboard
            </span>
            <img
              src="/sendible-nav/chevron.svg"
              alt=""
              style={{ width: 6.86, height: 12 }}
              className="block -scale-y-100"
            />
          </button>

          {/* "10:16" — IBM Plex Sans Regular 13/22 uppercase #201E24,
              container pt-7 (1290:101898). */}
          <span className="absolute left-[127.5px] top-[7px] text-[13px] leading-[22px] uppercase text-[#201E24] whitespace-nowrap tabular-nums">
            10:16
          </span>

          {/* Bell — 1290:101906 Item is 45.72 × 28 with overflow-clip
              and an inner Link `pt-9 px-10`, so the 16.72×18 icon sits
              at x=10, y=9 within the Item. */}
          <button
            type="button"
            aria-label="Notifications"
            className="absolute left-[172.5px] top-0 h-[28px] flex items-start pt-[9px] px-[10px] overflow-hidden hover:opacity-80 transition-opacity"
          >
            <img
              src="/sendible-nav/bell.svg"
              alt=""
              style={{ width: 16.72, height: 18 }}
              className="block -scale-y-100"
            />
          </button>
        </div>

        {/* Right group — 22-px avatar + "WL A" + chevron. Link inside
            has y=1 offset (1290:101912), so the inner offsets are all
            relative to the row top + 1. */}
        <div className="relative w-[87.16px] h-[28.39px] flex-shrink-0 mt-[1px]">
          <span
            aria-hidden="true"
            className="absolute left-0 top-[6.39px] block w-[22px] h-[22px] rounded-[11px] overflow-hidden bg-[#E8E8E9]"
          >
            <img
              src="/sendible-avatar.png"
              alt=""
              className="block w-full h-full object-cover"
            />
          </span>
          <span className="absolute left-[27.3px] top-[15.75px] -translate-y-1/2 text-[14px] leading-[22px] font-medium text-[#201E24] whitespace-nowrap">
            WL A
          </span>
          <img
            src="/sendible-nav/chevron.svg"
            alt=""
            style={{ width: 6.86, height: 12 }}
            className="absolute left-[70.3px] top-[9.5px] block -scale-y-100"
          />
        </div>
      </div>

      {/* ── Main row ────────────────────────────────────────────────── */}
      <div
        className="h-[59px] flex items-stretch bg-[#F1F0F8] shadow-[0_1px_0_0_rgba(32,30,36,0.2)] pr-[10px]"
      >
        {/* Logo — Figma Link is 160-wide with pl-12 pt-11 pb-15.07 pr-16.
            We anchor to the top of the link area (pt-[11px]) so the
            132×29.93 wordmark sits at row-top + 11, exactly per design. */}
        <a
          href="#"
          aria-label="Sendible"
          className="flex-shrink-0 w-[160px] flex items-start pt-[11px] pb-[15.07px] pl-[12px] pr-[16px]"
        >
          <img
            src="/sendible-nav/logo.svg"
            alt="Sendible"
            style={{ width: 132, height: 29.934 }}
            className="block"
          />
        </a>

        {/* Nav — anchored 48 px after the logo Link (page-x=208 in the
            1728-wide reference, regardless of viewport width). NOT
            centered. Each Item has its exact Figma Link width with a
            fixed 32-px gap between adjacent Items. */}
        <nav className="flex-shrink-0 ml-[48px] flex items-center gap-[32px]">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href="#"
              style={{ width: item.width }}
              className="h-[44px] flex items-center justify-center text-[14px] leading-[14px] font-medium text-[#201E24] whitespace-nowrap hover:text-[#4D36FF] transition-colors"
            >
              {item.label === 'Profiles' ? (
                <span className="inline-flex items-center gap-[3.65px]">
                  <span>Profiles</span>
                  <img
                    src="/sendible-nav/profiles-arrow.svg"
                    alt=""
                    style={{ width: 8, height: 8 }}
                    className="block"
                  />
                </span>
              ) : (
                <span>{item.label}</span>
              )}
            </a>
          ))}
        </nav>

        {/* Spacer — fills the empty middle so the right cluster pins to
            the right edge regardless of viewport width. */}
        <div className="flex-1" />

        {/* Right cluster — 44×44 share circle + 134.42×42 Compose pill,
            gap-[12.31px] per Figma. Container has 1-px top padding so
            the buttons sit 1 px below the row's natural top. */}
        <div className="flex-shrink-0 flex items-center gap-[12.31px] pt-[1px]">
          {/* Share circle (1290:101865). Figma uses `pt-12 pb-17.5 px-px`
              to sit the 13.94×14.5 icon 2.75 px above the circle's
              vertical center; we do the same so the optical balance
              matches (the upload-arrow icon is bottom-heavy because of
              its tray). */}
          <button
            type="button"
            aria-label="Share"
            className="w-[44px] h-[44px] rounded-full bg-white border border-[rgba(32,30,36,0.2)] flex items-start justify-center pt-[12px] pb-[17.5px] hover:bg-[#F8F8F9] transition-colors"
          >
            <img
              src="/sendible-nav/share.svg"
              alt=""
              style={{ width: 13.94, height: 14.5 }}
              className="block -scale-y-100"
            />
          </button>

          {/* Compose pill (1290:101869). Width 134.42, height 42, BRAND
              primary fill #4D36FF, hairline rgba(77,54,255,0.7) stroke.
              Inner gap between icon and label is ~9.5 in Figma's
              absolute-position layout; we approximate with gap-[9px]. */}
          <button
            type="button"
            className="h-[42px] w-[134.42px] rounded-full bg-[#4D36FF] border border-[rgba(77,54,255,0.7)] flex items-center justify-center gap-[9px] hover:bg-[#3D29D9] transition-colors"
          >
            <img
              src="/sendible-nav/compose.svg"
              alt=""
              style={{ width: 19, height: 19 }}
              className="block -scale-y-100"
            />
            <span className="text-[14px] leading-[14px] font-medium text-white">
              Compose
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
