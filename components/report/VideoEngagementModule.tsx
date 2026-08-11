'use client';

/**
 * Video engagement — horizontally-scrolling carousel of "video cards"
 * (Figma 2222:40922).  Each card is a self-contained 240 × 479 px
 * snapshot of a single post: timestamp, profile chip (32 px purple
 * monogram + black TikTok badge), caption (2-line ellipsis),
 * gradient thumbnail with centered white play triangle, and a 4-row
 * metric table (Views / Likes / Comments / Shares).
 *
 * Sister modules `tiktok-video-watch-metrics` (Figma 2224 family) and
 * `tiktok-video-sources` use a similar card chrome but ship their own
 * dedicated renderers per the design's "similar but with differences"
 * intent.  So this file owns the engagement-specific card and
 * carousel chrome only — it deliberately doesn't try to be a shared
 * primitive (yet).
 *
 * Carousel mechanics
 *   • Native horizontal scroll on the strip (`overflow-x: auto`) so
 *     trackpad + mouse-wheel scroll both work without us re-implementing
 *     them.  `scroll-snap-type: x mandatory` snaps to each card.
 *   • The 48-px right-arrow button calls `scrollBy({left: 264})` =
 *     1 card width + 1 gap, advancing exactly one card per click.
 *   • Scrollbar hidden via the inherited `no-scrollbar` utility
 *     (defined in `app/globals.css`) — the visual signal that there's
 *     more is the floating arrow button, not a bar.
 *
 * Module footer carries only the network indicator (same right-pinned
 * cluster every other module uses); no legend swatches since there's
 * no series shared across cards.
 */

import { useEffect, useRef, useState } from 'react';
import { VideoCardData } from '@/types';
import { MockProfile } from '@/lib/profile-data';
import { ModuleNetworks } from './ModuleNetworks';
import { COMPACT_NETWORKS_THRESHOLD_PX } from './AudienceGrowthModule';
import { IconArrowLeft, IconArrowRight } from '@/components/icons/SendiIcons';
import { VideoPostBox } from './VideoPostBox';

/**
 * Animated `scrollBy` that bypasses Chrome's broken native
 * `behavior: 'smooth'` on `scroll-snap-type: x mandatory`
 * containers (the snap engine ricochets the scroll back to the
 * current snap point mid-animation, so the strip never actually
 * moves).  Writes `scrollLeft` directly each animation frame —
 * snap-mandatory still kicks in at the END of the animation, but
 * since our `SCROLL_STEP` is an exact card stride we land on a
 * snap point anyway.
 *
 * Ease-out cubic over ~320 ms — fast enough that repeated clicks
 * feel responsive, slow enough that the cards visibly slide past.
 */
function smoothScrollBy(el: HTMLElement, deltaX: number, durationMs = 320) {
  const start = el.scrollLeft;
  const startTime = performance.now();
  function tick() {
    const t = Math.min((performance.now() - startTime) / durationMs, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.scrollLeft = start + deltaX * eased;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Card geometry per Figma 2704:56280 — same 244 × 320 tile as its
// sister modules (Video sources / Video watch metrics).  The
// summary rows below the shared `VideoPostBox` differ in count
// (engagement: 4 · sources: 7 · watch-metrics: 3); the post-box
// itself is identical, extracted into the shared component so all
// three carousels stay locked to the same top-section geometry.
const CARD_WIDTH = 244;
const CARD_HEIGHT = 320;
const CARD_INNER_PADDING = 6;
const CARD_GAP = 24;
/** One-click advance = exactly one card + one gap, so the next card
 *  lines up flush with the strip's left edge. */
const SCROLL_STEP = CARD_WIDTH + CARD_GAP;

// ── Carousel "next" button ────────────────────────────────────────────────
// Floating 48 × 48 circle pinned to the strip's right edge.  The
// shadow stack matches Figma's "Elevation 3" effect (3 stacked drop
// shadows — 1/9, 6/5, 3/2.5 px).  Hover treatment kept minimal — the
// button is the only affordance on the carousel so the user
// shouldn't have to hunt for it.

// Shared 48 × 48 floating "scroll one card" affordance.  Used twice
// per carousel — once pinned to the left edge (prev) and once to the
// right (next).  Same shadow + border + hover treatment per Figma
// 2224:50682; the prev variant just flips the icon and edge anchor.

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

// ── Single card ───────────────────────────────────────────────────────────

function VideoCard({ card }: { card: VideoCardData }) {
  return (
    <div
      className="bg-white flex flex-col flex-shrink-0 overflow-clip"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
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

      {/* Summary — 4-row engagement-metric table (Views / Likes /
          Comments / Shares).  `flex-1 min-h-0` distributes the rows
          across the leftover vertical space so the fixed-height
          card is always fully filled.  Row internals mirror the
          Video sources summary block for cross-carousel parity. */}
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
                // and the summary overflows the fixed 320-px card
                // height.  See VideoSourcesModule for the geometry
                // walk-through.
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

interface VideoEngagementModuleProps {
  cards: VideoCardData[];
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
}

export function VideoEngagementModule({
  cards,
  // contentHeight is destructured so the prop contract matches the
  // other chart modules' signature, even though the carousel height
  // is driven by `h-full` on the inner strip (no responsive
  // re-layout needed at this card size).
  contentHeight: _contentHeight,
  contentWidth = 0,
  profiles = [],
}: VideoEngagementModuleProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  // Track which scroll directions still have content to reveal so we
  // can hide the prev / next buttons when there's nothing in that
  // direction.  `canPrev` starts false (the strip mounts at
  // scrollLeft = 0); `canNext` starts true on the assumption there's
  // overflow, and `update()` corrects on the first frame if the
  // module is wide enough to show every card without scrolling.
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft;
      const max = el.scrollWidth - el.clientWidth;
      // 1 px tolerance for fractional scroll positions (snap +
      // sub-pixel rendering can leave the scroll position 0.5 px
      // short of an edge).
      setCanPrev(left > 1);
      setCanNext(left < max - 1);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    // Re-evaluate when the module is resized (the user can drag the
    // grid corner to widen the carousel; if it becomes wide enough
    // to fit every card the next button should disappear).
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
      {/* Scroll strip + floating right-arrow button.  `relative` so
          the button can anchor to the right edge of the strip
          regardless of how far the user has scrolled.
          Container height is pinned to `CARD_HEIGHT` so the button's
          50 % top-anchor lines up with the card's vertical center
          (a taller container would float the button below the
          cards). `items-start` on the strip is belt-and-braces so a
          card whose intrinsic height differs from `CARD_HEIGHT`
          still doesn't pull the strip taller. */}
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
          pushes it to the bottom of the module's content area so
          the TikTok glyph lands flush with the module's bottom
          edge per Figma 2222:41201 (footer bottom at y=523 in the
          523-tall content frame).  Any slack between the carousel's
          fixed height and the module's actual content height shows
          as quiet whitespace BETWEEN the carousel and the footer,
          rather than below the footer where it reads as a stray
          margin. */}
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
