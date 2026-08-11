'use client';

/**
 * Video sources — sister carousel to `VideoEngagementModule` and
 * `VideoWatchMetricsModule` (Figma 2222:48693).  Same 240 × 479
 * card shell, same horizontal-snap carousel chrome, same seeded
 * picsum preview image inside the 9 : 16 letterbox; the
 * differences vs the engagement deck are concentrated in the card's
 * vertical proportions and its summary table:
 *
 *   • Thumbnail shrinks from 249 → 177 px (giving up 72 px to the
 *     summary) so the 9 : 16 inner preview is now 100 × 177 — still
 *     exact TikTok aspect (100 / 177 = 0.5650 ≈ 9 / 16), just
 *     proportionally narrower against the gradient backdrop.
 *   • Summary frame grows from 112 → 184 px to fit a 7-row table
 *     reporting where the views came from in TikTok's surface:
 *     Direct message / Follow / For you / Others / Personal profile
 *     / Search / Sound.  Each row stays at the engagement deck's
 *     24-px height (4 px top/bottom padding) — not the watch
 *     metrics' breathing 32-px rows — because 7 × 32 wouldn't fit.
 *   • Card overall still measures 240 × 479: 118 (details) + 177
 *     (thumbnail) + 184 (summary) = 479 ✓
 *
 * The three video carousels live in separate files per the user's
 * "do them separately" guidance — the small amount of duplicated
 * card-rendering JSX is the price of keeping each module free to
 * evolve independently as the design iterates.
 */

import { useEffect, useRef, useState } from 'react';
import { VideoCardData } from '@/types';
import { MockProfile } from '@/lib/profile-data';
import { ModuleNetworks } from './ModuleNetworks';
import { COMPACT_NETWORKS_THRESHOLD_PX } from './AudienceGrowthModule';
import { IconArrowLeft, IconArrowRight } from '@/components/icons/SendiIcons';
import { VideoPostBox } from './VideoPostBox';

/** Manual rAF-driven smooth scrollBy.  See the engagement module's
 *  copy for the rationale (Chrome's native `behavior: 'smooth'` is
 *  broken on `scroll-snap-type: x mandatory` containers). */
function smoothScrollBy(el: HTMLElement, deltaX: number, durationMs = 320) {
  const start = el.scrollLeft;
  const startTime = performance.now();
  function tick() {
    const t = Math.min((performance.now() - startTime) / durationMs, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.scrollLeft = start + deltaX * eased;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Card geometry per Figma 2704:55955 — a single 244 × 320 tile with
// two internal sections (grey "post box" on top, source-percentage
// summary below).  The old 240 × 479 layout kept a full-width 9:16
// thumbnail below the header — the 2704 redesign folds that into a
// 48 × 48 tile inline with the caption, freeing vertical budget so
// the whole card fits in 320 px.
const CARD_WIDTH = 244;
const CARD_HEIGHT = 320;
/** Inner corner-inset of the card's chrome — 6 px on every side
 *  wraps the post-box + summary at 232 px content width. */
const CARD_INNER_PADDING = 6;
const CARD_GAP = 24;
const SCROLL_STEP = CARD_WIDTH + CARD_GAP;

// ── Inline SVG helpers — same as the engagement / watch-metrics
// modules.  Kept inline so each carousel file is self-contained.

function CarouselScrollButton({
  side,
  onClick,
}: {
  side: 'prev' | 'next';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'prev' ? 'Show previous videos' : 'Show next videos'}
      className={`absolute top-1/2 -translate-y-1/2 ${
        side === 'prev' ? 'left-[19px]' : 'right-[19px]'
      } flex items-center justify-center bg-[#FAFAFA] border border-[rgba(88,87,100,0.2)] rounded-full transition-colors hover:bg-[#F3F3F4]`}
      style={{
        width: 48,
        height: 48,
        boxShadow:
          '0 1px 18px rgba(27, 27, 32, 0.12), 0 6px 10px rgba(27, 27, 32, 0.14), 0 3px 5px -1px rgba(27, 27, 32, 0.2)',
      }}
    >
      {side === 'prev' ? (
        <IconArrowLeft size={24} color="#585764" />
      ) : (
        <IconArrowRight size={24} color="#585764" />
      )}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────
// Figma 2704:55955 — 244 × 320 tile with two internal sections:
//   • Post box (top)   — grey `#F3F3F4` frame with 8-px rounded
//     corners.  Rows:
//       1. date/time (LEFT) + external-link icon (RIGHT)
//       2. 24-px avatar w/ TikTok badge + name/@handle
//       3. caption text (flex 1) + 48 × 48 inline preview tile with
//          right-corners rounded, dark gradient overlay, play glyph
//   • Summary (bottom) — 7-row source-percentage table.  Rows are
//     `justify-between` label/value with bottom hairline borders
//     (`rgba(32,30,36,0.1)`); the last row has no border.
//
// The earlier 240 × 479 layout with a full-width portrait thumbnail
// under the header is retired — the 2704 redesign folds the preview
// into the caption row.

function VideoCard({ card }: { card: VideoCardData }) {
  return (
    <div
      className="bg-white flex flex-col flex-shrink-0 overflow-clip"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        // Card chrome per Figma: 12-px radius, dark 10 %-alpha
        // hairline border, 6-px inner inset.  Retired the earlier
        // `#D2D2D3` / 4-px radius / 0-padding chrome outright.
        borderRadius: 12,
        border: '1px solid rgba(32,30,36,0.1)',
        padding: CARD_INNER_PADDING,
        scrollSnapAlign: 'start',
      }}
    >
      <VideoPostBox
        date={card.date}
        profile={card.profile}
        caption={card.caption}
        image={card.image}
      />

      {/* Summary — 7-row source-percentage table filling remaining height.
          `flex-1 min-h-0` distributes the rows across the leftover space
          instead of overflowing the fixed-height card.  Row internals
          match Figma 2704:55976 exactly: `py-4`, `justify-between`,
          bottom border 1px `rgba(32,30,36,0.1)` except the last row. */}
      <div
        className="flex flex-col flex-1 min-h-0 w-full"
        style={{ paddingTop: 8, paddingLeft: 2, paddingRight: 2 }}
      >
        {card.metrics.map((row, i) => (
          <div
            key={row.label}
            className="flex flex-1 items-center w-full"
            style={{
              gap: 4,
              padding: '4px 0',
              borderBottom:
                i < card.metrics.length - 1
                  ? '1px solid rgba(32,30,36,0.1)'
                  : 'none',
            }}
          >
            <p
              className="flex-1 min-w-0"
              style={{
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontSize: 12,
                lineHeight: '16px',
                letterSpacing: 0.3,
                color: '#4C4B4F',
              }}
            >
              {row.label}
            </p>
            <p
              className="tabular-nums flex-shrink-0"
              style={{
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontWeight: 500,
                fontSize: 12,
                // 16 px line-height (not 18 as the design tokens
                // spell out for `Sans-Medium/12`) so the value's
                // intrinsic line box matches the label's — otherwise
                // `items-center` locks each row to the taller side
                // (26 px), and 7 × 26 = 182 px + 8 pt overflows the
                // 184 px the fixed 320-px card leaves for the
                // summary, clipping the last "Sound" row.
                lineHeight: '16px',
                color: '#201E24',
                textAlign: 'right',
                minWidth: 88,
                whiteSpace: 'nowrap',
              }}
            >
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Module ────────────────────────────────────────────────────────────────

interface VideoSourcesModuleProps {
  cards: VideoCardData[];
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
}

export function VideoSourcesModule({
  cards,
  contentHeight: _contentHeight,
  contentWidth = 0,
  profiles = [],
}: VideoSourcesModuleProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  // Hide the prev / next buttons when there's nothing in their
  // direction.  See the engagement module's copy for rationale.
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft;
      const max = el.scrollWidth - el.clientWidth;
      setCanPrev(left > 1);
      setCanNext(left < max - 1);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [cards.length]);

  const handlePrev = () => {
    if (stripRef.current) smoothScrollBy(stripRef.current, -SCROLL_STEP);
  };

  const handleNext = () => {
    if (stripRef.current) smoothScrollBy(stripRef.current, SCROLL_STEP);
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div
        className="relative flex-shrink-0 w-full overflow-hidden"
        style={{ height: CARD_HEIGHT }}
      >
        <div
          ref={stripRef}
          className="no-scrollbar flex items-start h-full w-full"
          style={{
            gap: CARD_GAP,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollSnapType: 'x mandatory',
          }}
        >
          {cards.map((card) => (
            <VideoCard key={card.id} card={card} />
          ))}
        </div>
        {canPrev && <CarouselScrollButton side="prev" onClick={handlePrev} />}
        {canNext && <CarouselScrollButton side="next" onClick={handleNext} />}
      </div>
      {/* Footer — networks indicator only, right-aligned.  `mt-auto`
          pushes it flush with the module's bottom edge per the
          Figma footer placement; slack appears between the
          carousel and the footer rather than below it. */}
      <div
        className="flex flex-wrap items-center justify-end w-full flex-shrink-0 mt-auto"
        style={{ paddingTop: 16, columnGap: 24, rowGap: 16 }}
      >
        <ModuleNetworks
          profiles={profiles}
          maxVisible={contentWidth > 0 && contentWidth < COMPACT_NETWORKS_THRESHOLD_PX ? 1 : 3}
        />
      </div>
    </div>
  );
}
