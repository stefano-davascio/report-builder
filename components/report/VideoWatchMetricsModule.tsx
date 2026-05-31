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

const CARD_WIDTH = 240;
const CARD_HEIGHT = 479;
const THUMB_HEIGHT = 249;
const CARD_GAP = 24;
const SCROLL_STEP = CARD_WIDTH + CARD_GAP;

// ── Inline SVG helpers — duplicated from VideoEngagementModule so
// each carousel file is self-contained per the user's "do them
// separately" guidance.  If the badge / play styling ever needs to
// change across both, both files have to be touched.

function TikTokBadge() {
  return (
    <div
      aria-hidden
      className="absolute bg-black rounded-full"
      style={{
        bottom: -3,
        left: 19,
        width: 14,
        height: 14,
        border: '2px solid #fff',
        boxSizing: 'border-box',
      }}
    >
      <svg
        viewBox="0 0 17 20"
        width={8}
        height={8}
        style={{ position: 'absolute', left: 1, top: 1 }}
      >
        <path
          d="M12.30 13.49V6.12C13.77 7.18 15.54 7.75 17.35 7.75V4.93C16.28 4.70 15.32 4.13 14.61 3.31C14.03 2.93 13.54 2.45 13.16 1.88C12.78 1.31 12.52 0.67 12.39 0H9.74V14.54C9.70 15.17 9.47 15.77 9.09 16.26C8.70 16.75 8.17 17.12 7.57 17.30C6.97 17.48 6.33 17.47 5.73 17.27C5.13 17.08 4.61 16.71 4.23 16.21C3.65 15.88 3.18 15.37 2.91 14.75C2.64 14.14 2.58 13.45 2.74 12.80C2.90 12.14 3.27 11.56 3.80 11.14C4.32 10.72 4.97 10.48 5.64 10.46C5.95 10.45 6.25 10.49 6.54 10.56V7.75C5.25 7.77 3.99 8.17 2.92 8.89C1.85 9.62 1.02 10.64 0.52 11.83C0.02 13.02 -0.12 14.33 0.11 15.60C0.34 16.87 0.94 18.05 1.82 18.98C2.82 19.68 3.99 20.10 5.21 20.17C6.43 20.25 7.64 19.99 8.72 19.43C9.80 18.87 10.71 18.02 11.34 16.98C11.97 15.93 12.30 14.74 12.30 13.52V13.49Z"
          fill="#fff"
        />
      </svg>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 48 48" width={48} height={48} fill="none" aria-hidden>
      <path
        d="M14 6L42 24L14 42V6Z"
        stroke="#D2D2D3"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
        <IconArrowLeft size={24} color="#201E24" />
      ) : (
        <IconArrowRight size={24} color="#201E24" />
      )}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────

function VideoCard({ card }: { card: VideoCardData }) {
  return (
    <div
      className="bg-white border border-[#D2D2D3] rounded-[4px] overflow-clip flex flex-col flex-shrink-0"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        scrollSnapAlign: 'start',
      }}
    >
      {/* Details — date + profile chip + 2-line caption */}
      <div
        className="flex flex-col items-start w-full"
        style={{ padding: '8px 16px', gap: 8 }}
      >
        <p
          className="w-full"
          style={{
            fontFamily: 'IBM Plex Sans, sans-serif',
            fontSize: 12,
            lineHeight: '16px',
            color: '#626165',
            textAlign: 'left',
            letterSpacing: 0.3,
            whiteSpace: 'nowrap',
          }}
        >
          {card.date}
        </p>
        <div className="flex items-start gap-[8px] w-full">
          <div
            className="relative flex items-center justify-center flex-shrink-0"
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              background: '#9486FF',
              border: '1px solid rgba(32,30,36,0.2)',
            }}
          >
            <span
              style={{
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontWeight: 500,
                fontSize: 14,
                lineHeight: '18px',
                color: 'rgba(32,30,36,0.8)',
                letterSpacing: 0.07,
              }}
            >
              {card.profile.monogram}
            </span>
            <TikTokBadge />
          </div>
          <div
            className="flex flex-col justify-center min-w-0"
            style={{ paddingLeft: 4, height: 32 }}
          >
            <p
              className="truncate"
              style={{
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontWeight: 500,
                fontSize: 12,
                lineHeight: '18px',
                color: '#201E24',
              }}
            >
              {card.profile.name}
            </p>
            <p
              className="truncate"
              style={{
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontSize: 12,
                lineHeight: '16px',
                color: '#626165',
                letterSpacing: 0.3,
              }}
            >
              {card.profile.handle}
            </p>
          </div>
        </div>
        <p
          style={{
            fontFamily: 'IBM Plex Sans, sans-serif',
            fontSize: 12,
            lineHeight: '18px',
            color: '#201E24',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: '100%',
            height: 36,
          }}
        >
          {card.caption}
        </p>
      </div>
      {/* Attachment — same 9 : 16 letterbox treatment as the
          engagement carousel.  Gradient backdrop + centered 140 × 249
          dark inner preview with seeded picsum image. */}
      <div
        className="relative flex items-center justify-center flex-shrink-0"
        style={{
          width: CARD_WIDTH,
          height: THUMB_HEIGHT,
          background: card.thumbnail,
        }}
      >
        <div
          className="relative flex items-center justify-center"
          style={{
            width: 140,
            height: THUMB_HEIGHT,
            background: `#1A1A1F url(${card.image}) center/cover no-repeat`,
          }}
        >
          <PlayIcon />
        </div>
      </div>
      {/* Summary — 3-row metric table, each row 32 px tall (8 px
          top/bottom padding) per Figma 2224:50523.  Dividers between
          rows, no divider after the final row.  Rows breathe more
          than the engagement carousel's 24-px rows to balance the
          shorter list (3 rows × 32 = 96, identical to the
          engagement's 4 × 24 = 96 — same Summary frame, different
          rhythm). */}
      <div
        className="flex flex-col flex-shrink-0 w-full"
        style={{ padding: '8px 16px' }}
      >
        {card.metrics.map((row, i) => (
          <div
            key={row.label}
            className="flex items-start w-full"
            style={{
              gap: 4,
              padding: '8px 0',
              borderBottom:
                i < card.metrics.length - 1 ? '1px solid #E8E8E9' : 'none',
            }}
          >
            <p
              style={{
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontSize: 12,
                lineHeight: '16px',
                color: '#201E24',
                letterSpacing: 0.3,
                flex: '1 0 0',
                minWidth: 1,
              }}
            >
              {row.label}
            </p>
            <p
              className="tabular-nums"
              style={{
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontSize: 12,
                lineHeight: '16px',
                color: '#626165',
                letterSpacing: 0.3,
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
