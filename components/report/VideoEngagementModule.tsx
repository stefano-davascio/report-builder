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

import { useRef } from 'react';
import { VideoCardData } from '@/types';
import { MockProfile } from '@/lib/profile-data';
import { ModuleNetworks } from './ModuleNetworks';
import { COMPACT_NETWORKS_THRESHOLD_PX } from './AudienceGrowthModule';
import { IconArrowRight } from '@/components/icons/SendiIcons';

const CARD_WIDTH = 240;
/** Total card height per Figma 2222:40922 — sum of the three vertical
 *  sections (details 118 + attachment 249 + summary 112).  Pinned
 *  explicitly so the card doesn't stretch to fill the strip's available
 *  vertical space (the carousel container can be taller than a single
 *  card when the user resizes the module). */
const CARD_HEIGHT = 479;
const CARD_GAP = 24;
/** One-click advance = exactly one card + one gap, so the next card
 *  lines up flush with the strip's left edge. */
const SCROLL_STEP = CARD_WIDTH + CARD_GAP;

// ── Inline SVG helpers ────────────────────────────────────────────────────
// Two inline icons that don't have full-size equivalents in
// `SendiIcons.tsx` because they only appear here:
//   • TikTokBadge — 14 × 14 black circle with a 2 px white ring,
//                   sitting bottom-right on the avatar.  The white
//                   silhouette is a hand-simplified version of the
//                   black-layer path from `IconNetworkTikTok`
//                   (NetworkIcons.tsx) — the full multi-color glyph
//                   would be illegible at 10 px.
//   • PlayIcon   — 48 × 48 white triangle, no background fill, with a
//                   drop-shadow so it reads cleanly on any gradient
//                   thumbnail tint.

function TikTokBadge() {
  return (
    <div
      aria-hidden
      className="absolute bg-black rounded-full"
      style={{
        // Visual is exactly 14 × 14 with a 2 px white border eaten
        // INTO the 14 (box-sizing: border-box) so the black core is
        // 10 × 10. Previously used `boxShadow: 0 0 0 2px #fff` which
        // painted the 2 px ring OUTSIDE the 14 — total visual was
        // 18 × 18 and read as oversized vs Figma 2222:40948.
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
        // Position absolute is relative to the padding edge (= inner
        // 10 × 10 black area). (1, 1) centers an 8 × 8 glyph inside
        // that 10 × 10, leaving 1 px of black breathing room on every
        // side so the "d" silhouette doesn't kiss the white ring.
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
    <svg
      viewBox="0 0 48 48"
      width={48}
      height={48}
      fill="none"
      aria-hidden
    >
      {/* Hollow 28 × 36 triangle, stroked at 3 px with rounded
          line caps + joins — matches the Figma play icon the user
          supplied directly.  Stroke colour is `#D2D2D3`
          (DARK/dark--tint_80) so the outline reads as a soft
          decorative play affordance on any gradient thumbnail
          rather than competing with the content. */}
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

// ── Carousel "next" button ────────────────────────────────────────────────
// Floating 48 × 48 circle pinned to the strip's right edge.  The
// shadow stack matches Figma's "Elevation 3" effect (3 stacked drop
// shadows — 1/9, 6/5, 3/2.5 px).  Hover treatment kept minimal — the
// button is the only affordance on the carousel so the user
// shouldn't have to hunt for it.

function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Show next videos"
      className="absolute top-1/2 -translate-y-1/2 right-[19px] flex items-center justify-center bg-[#FAFAFA] border border-[rgba(88,87,100,0.2)] rounded-full transition-colors hover:bg-[#F3F3F4]"
      style={{
        width: 48,
        height: 48,
        boxShadow:
          '0 1px 18px rgba(27, 27, 32, 0.12), 0 6px 10px rgba(27, 27, 32, 0.14), 0 3px 5px -1px rgba(27, 27, 32, 0.2)',
      }}
    >
      <IconArrowRight size={24} color="#201E24" />
    </button>
  );
}

// ── Single card ───────────────────────────────────────────────────────────

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
      {/* Details — date row + profile chip + caption */}
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
            // Left-aligned per the rendered Figma 2222:40944, even
            // though the auto-extracted code carries `text-right` —
            // in the live design the date sits at the top-LEFT of
            // the card, flush with the avatar / caption stack
            // beneath it.
            textAlign: 'left',
            letterSpacing: 0.3,
            whiteSpace: 'nowrap',
          }}
        >
          {card.date}
        </p>
        <div className="flex items-start gap-[8px] w-full">
          {/* Avatar — 32 × 32 purple square with monogram + TikTok badge */}
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
          {/* Profile name + handle */}
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
        {/* Caption — 2-line ellipsis truncation, fixed 36 px box so the
            details section's height stays constant card-to-card
            regardless of caption length. */}
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
      {/* Attachment — gradient thumbnail + centered play triangle */}
      <div
        className="relative flex items-center justify-center flex-shrink-0"
        style={{
          width: CARD_WIDTH,
          height: 249,
          background: card.thumbnail,
        }}
      >
        <PlayIcon />
      </div>
      {/* Summary — 4-row metric table.  Each row has a bottom border
          except the last, matching the Figma's `border-b` on rows 1–3
          and no border on the final Shares row. */}
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
              padding: '4px 0',
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

  const handleNext = () => {
    stripRef.current?.scrollBy({
      left: SCROLL_STEP,
      behavior: 'smooth',
    });
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
        <NextButton onClick={handleNext} />
      </div>
      {/* Footer — networks indicator only, right-aligned.  Sits
          directly below the strip with the standard 16 px
          paddingTop.  Any slack between the card+footer footprint
          and the module's actual content height (e.g. if the user
          resizes the module taller than its default) shows as
          quiet white space at the bottom — same as every other
          fixed-content module on the canvas. */}
      <div
        className="flex flex-wrap items-center justify-end w-full flex-shrink-0"
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
