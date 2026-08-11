'use client';

/**
 * VideoPostBox — the grey top section shared by every video-carousel
 * card (Video sources 2704:55955, Video watch metrics 2704:56140,
 * Video engagement 2704:56280).
 *
 * Extracted into its own component because the three Figma frames
 * all render an identical post-box on top; only the summary rows
 * below differ.  Duplicating the layout in each module drifted the
 * three renderings apart historically — this shared component locks
 * them together so a token change in one place updates all three.
 *
 * Structure per Figma I2704:55973:
 *   • Row 1 — date/time (LEFT) · external-link icon (RIGHT)
 *   • Row 2 — 24-px avatar w/ TikTok network badge · name/@handle
 *   • Row 3 — caption (2 lines, ellipsized) · 48 × 48 inline preview
 *     tile (right-corners rounded only, dark bottom-fade gradient
 *     over the source image, `IconPlay` glyph centered)
 *
 * Post-box height is fixed so all three modules' cards line up when
 * placed side-by-side in the report canvas — the calling module
 * sets the surrounding card height and lets the summary table below
 * fill the remaining vertical space.
 */

import { IconArrowUpRight, IconPlay, IconTikTokBadge } from '@/components/icons/SendiIcons';

export interface VideoPostBoxProps {
  date: string;
  profile: {
    monogram: string;
    name: string;
    handle: string;
  };
  caption: string;
  /** Thumbnail source URL — used as the 48 × 48 preview image. */
  image: string;
}

/** 48-px thumbnail per Figma I2704:55973;2704:54359. */
const INLINE_THUMB_SIZE = 48;

/**
 * TikTok badge — 20 × 20 self-contained avatar chip anchored to
 * the avatar's bottom-right corner (Figma I2704:54415;1775:52218).
 * Uses `IconTikTokBadge` from the shared icon library — the icon
 * bakes the white circle + multi-color TikTok mark into a single
 * 20 × 20 SVG so the mark's proportions stay pixel-perfect at
 * small render sizes.
 *
 * The absolute-positioned wrapper only supplies the 2-px white
 * ring that visually detaches the chip from the avatar fill;
 * everything else lives inside the icon.
 */
function TikTokBadge() {
  return (
    <div
      aria-hidden
      className="absolute rounded-full"
      style={{
        // Anchor the badge so its center sits on the avatar's
        // bottom-right corner (24 − 4 = 20; 20 − 10 = 10 offset
        // to place the 20 × 20 badge with a 4-px overlap into
        // the avatar).  The 2-px white ring around the chip
        // matches Figma's shadow-[0px_0px_0px_2px_white].
        top: 10,
        left: 10,
        width: 20,
        height: 20,
        boxShadow: '0 0 0 2px #fff',
      }}
    >
      <IconTikTokBadge size={20} />
    </div>
  );
}

export function VideoPostBox({ date, profile, caption, image }: VideoPostBoxProps) {
  return (
    <div
      className="flex flex-col items-start w-full flex-shrink-0"
      style={{
        background: '#F3F3F4',
        borderRadius: 8,
        padding: '8px 12px 12px 12px',
        gap: 6,
      }}
    >
      {/* Row 1 — date/time on the left, external-link on the right. */}
      <div className="flex items-start justify-between w-full">
        <p
          style={{
            fontFamily: 'IBM Plex Sans, sans-serif',
            fontSize: 12,
            lineHeight: '16px',
            letterSpacing: 0.3,
            color: '#626165',
            whiteSpace: 'nowrap',
          }}
        >
          {date}
        </p>
        <span
          aria-hidden
          className="flex-shrink-0 flex items-center justify-center"
        >
          <IconArrowUpRight size={16} color="#201E24" />
        </span>
      </div>

      {/* Row 2 — 24-px avatar with TikTok badge + name/@handle. */}
      <div className="flex items-start gap-2 w-full">
        <div
          className="relative flex items-center justify-center flex-shrink-0"
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            // Design's fixed sample avatar chip.  In real data
            // this would key off `card.profile.color`; the mock
            // caches a single tone so the demo cards match Figma.
            background: '#87D6E4',
            border: '0.75px solid #73BECC',
          }}
        >
          <span
            style={{
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
              fontWeight: 800,
              fontSize: 15,
              lineHeight: '13.2px',
              color: '#34809B',
            }}
          >
            {profile.monogram}
          </span>
          <TikTokBadge />
        </div>
        <div
          className="flex flex-col justify-center min-w-0"
          style={{ paddingLeft: 4 }}
        >
          <p
            className="truncate"
            style={{
              fontFamily: 'IBM Plex Sans, sans-serif',
              fontWeight: 500,
              fontSize: 12,
              lineHeight: '12px',
              color: '#201E24',
            }}
          >
            {profile.name}
          </p>
          <p
            className="truncate"
            style={{
              fontFamily: 'IBM Plex Sans, sans-serif',
              fontSize: 12,
              lineHeight: '16px',
              letterSpacing: 0.3,
              color: '#626165',
            }}
          >
            {profile.handle}
          </p>
        </div>
      </div>

      {/* Row 3 — 2-line ellipsized caption (flex 1) + inline 48 × 48
          preview tile.  Thumb's right-side corners are rounded to
          match the card edge; a dark bottom-fade gradient sits on
          top of the source image so the play glyph stays legible on
          light thumbnails. */}
      <div className="flex items-start gap-2 w-full">
        <p
          className="flex-1 min-w-0"
          style={{
            fontFamily: 'IBM Plex Sans, sans-serif',
            fontSize: 12,
            lineHeight: '18px',
            color: '#201E24',
            display: '-webkit-box',
            // 2 lines per Figma I2704:54358 — the caption clamps to
            // exactly 2 lines and ellipsizes.  Locking this here
            // means the post-box height stays constant across all
            // three video carousels regardless of caption length.
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {caption}
        </p>
        <div
          aria-hidden
          className="relative flex-shrink-0 overflow-hidden flex items-end justify-end"
          style={{
            width: INLINE_THUMB_SIZE,
            height: INLINE_THUMB_SIZE,
            // 4-px radius on ALL 4 corners.  Was TR + BR only —
            // that assumed the thumb should sit flush against the
            // caption on its left edge; the actual design rounds
            // all four so the tile reads as its own chip inside
            // the post-box.
            borderRadius: 4,
            background: `#1A1A1F url(${image}) center/cover no-repeat`,
            // Play glyph pins to bottom-right with an 8 px inset
            // (Figma I2704:55973;2704:54360 — `items-end
            // justify-end p-[8px]`).  Centering the glyph read as
            // "watch-metrics badge" rather than a play affordance.
            padding: 8,
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to bottom, rgba(32,30,36,0) 0%, rgba(32,30,36,0.7) 100%)',
              borderRadius: 4,
            }}
          />
          {/* `relative` promotes the play glyph into the positioned
              layer so it paints AFTER the absolutely-positioned
              gradient above.  Without it, the static <span> stays in
              flow-layer paint order — the gradient (positioned)
              paints on top and the 70 % black at the bottom of the
              gradient washes the white stroke out to grey. */}
          <span className="relative">
            <IconPlay size={16} color="#FFFFFF" />
          </span>
        </div>
      </div>
    </div>
  );
}
