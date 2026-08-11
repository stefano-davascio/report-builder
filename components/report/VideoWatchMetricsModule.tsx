'use client';

/**
 * Video watch metrics — sister carousel to `VideoEngagementModule`
 * (Figma 2224:50487).  Same 240 × 479 card shell as Video
 * engagement (details + 9 : 16 thumbnail with seeded preview
 * image + summary table) so anything that lands on the engagement
 * cards visually carries through here.
 *
 * What differs vs Video engagement:
 *
 *   • The summary table reports WATCH-time metrics
 *     (Watch time / Avg duration / Completion) instead of
 *     engagement counts (Views / Likes / Comments / Shares).
 *   • There are 3 metric rows rather than 4.
 *   • Each row is 32 px tall (8 px top/bottom padding) instead of
 *     24 px (4 px top/bottom padding) for a calmer visual rhythm
 *     against the same 96 px Summary frame.
 *
 * Sister `VideoEngagementModule` and the still-stubbed
 * `tiktok-video-sources` carry their own dedicated files per the
 * design's "similar but with differences" intent.  Keeping these
 * three modules in separate files (rather than extracting a
 * shared `VideoCard`) lets each evolve without dragging the
 * others — at the cost of some duplicated card-rendering JSX
 * that's easy enough to reconcile by hand.
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

const CARD_WIDTH = 244;
const CARD_HEIGHT = 320;
const CARD_INNER_PADDING = 6;
const CARD_GAP = 24;
const SCROLL_STEP = CARD_WIDTH + CARD_GAP;

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

      {/* Summary — 3-row watch-metric table (Avg. time watched / Total
          time watched / Full video watched rate).  `flex-1 min-h-0`
          distributes the rows across the remaining vertical space so
          the fixed 320-px card is fully filled with breathing rows
          per Figma 2704:56280. */}
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
                // intrinsic line box matches the label's — see
                // VideoSourcesModule for the geometry walk-through
                // on why this matters for the fixed-height card.
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

interface VideoWatchMetricsModuleProps {
  cards: VideoCardData[];
  contentHeight: number;
  contentWidth?: number;
  profiles?: MockProfile[];
}

export function VideoWatchMetricsModule({
  cards,
  contentHeight: _contentHeight,
  contentWidth = 0,
  profiles = [],
}: VideoWatchMetricsModuleProps) {
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
