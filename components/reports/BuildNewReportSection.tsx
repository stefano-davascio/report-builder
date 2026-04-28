'use client';

/**
 * "Build a new report" — Figma 1295:124074 (Main frame 1295:124077).
 *
 * Visual contract — all numbers come straight from the Figma frame
 * metadata, not rounded or eyeballed:
 *
 *   Section container (1295:124077, 1114×221, overflow-clip):
 *     bg #F3F3F4, rounded-12, px-24 py-20, gap-8 vertical.
 *
 *   Title row (1295:124079):
 *     "Build a new report" — IBM Plex Sans Medium 16/24, #201E24.
 *     gap-10 between the title row and the cards row (Frame 148).
 *
 *   Cards row (1295:124082, 1066 wide):
 *     flex gap-16. Cards are 254×147 with p-24 and rounded-8. The
 *     parent's overflow-clip clips anything beyond the visible 4-wide
 *     strip; the chevron button advances the carousel.
 *
 *   Card layout (inside p-24, 99 px tall content):
 *     flex-col justify-between — 24-px brand icon at top, info block
 *     at bottom. Info block is gap-2: title (Components / Heading 14
 *     = Medium 14/18 #201E24 letter-spacing 0.07px) + description
 *     (Sans/12 = Regular 12/18 #4C4B4F).
 *
 *   "Start from scratch" card (1295:124083):
 *     bg rgba(255,255,255,0.4), 1-px DASHED #E8E8E9 border. The icon
 *     is the Figma Plus glyph (24×24, #201E24 — not the purple
 *     plus_circle).
 *
 *   Template cards (1295:124091, 1295:124099, etc.):
 *     bg #FFFFFF, 1-px SOLID #E8E8E9 border. Icon is the network's
 *     brand-color glyph from `NetworkIcons` (Facebook blue, Instagram
 *     rainbow, TikTok cyan/magenta/black, etc.).
 *
 *   Chevron button (1295:124151, 48×48):
 *     Anchored absolutely at right:14, top: 50% + 17 px (the +17 lands
 *     it on the cards strip, not the section's geometric centre, since
 *     the title pushes the cards down). bg #FAFAFA, 1.75-px border
 *     rgba(88,87,100,0.2), Is-Floating shadow (0 8 16 + 0 4 8 of
 *     #201E241A). Icon: `IconArrowRight` straight-line + V-head, NOT
 *     a chevron — rendered at size 24 (Figma `icon-l` is a 24-tile;
 *     the arrow vector inside it is 14×14 at inset 20.83%) in
 *     #201E24 (Figma's neutral icon stroke).
 *
 * Two of those buttons exist: a forward button on the right edge and
 * a mirrored back button on the left edge. This is a *paginated*
 * carousel — every click advances / rewinds by a full page (the
 * strip's `clientWidth`, ≈ 4 cards at the 1066-px design width), not
 * by a single card. Each button hides at the matching edge of the
 * scroll range — forward hides at the right edge, back hides at the
 * left, both hide entirely when the strip doesn't overflow — so the
 * affordance is always honest about what direction is possible.
 */

import { useEffect, useRef, useState } from 'react';
import { ReportTemplate } from '@/lib/reports-data';
import { Platform } from '@/types';
import {
  IconPlus,
  IconArrowLeft,
  IconArrowRight,
} from '@/components/icons/SendiIcons';
import {
  IconNetworkAll,
  IconNetworkFacebook,
  IconNetworkInstagram,
  IconNetworkTikTok,
  IconNetworkGA,
  IconNetworkLinkedIn,
  IconNetworkYouTube,
} from '@/components/icons/NetworkIcons';
import { cn } from '@/lib/utils';

interface BuildNewReportSectionProps {
  templates: ReportTemplate[];
  onSelect: (template: ReportTemplate) => void;
}

// Each template gets the brand icon for its primary network. Cross-
// platform uses the "all networks" grid glyph (1295:124086 in Figma).
function templateIcon(id: string, networks: Platform[]) {
  if (id === 'tpl-cross') {
    return <IconNetworkAll size={24} color="#201E24" />;
  }
  const primary = networks[0];
  switch (primary) {
    case 'facebook':         return <IconNetworkFacebook size={24} />;
    case 'instagram':        return <IconNetworkInstagram size={24} />;
    case 'tiktok':           return <IconNetworkTikTok size={24} />;
    case 'youtube':          return <IconNetworkYouTube size={24} />;
    case 'linkedin':         return <IconNetworkLinkedIn size={24} />;
    case 'google-analytics': return <IconNetworkGA size={24} />;
    default:                 return <IconNetworkAll size={24} color="#201E24" />;
  }
}

export function BuildNewReportSection({ templates, onSelect }: BuildNewReportSectionProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Two flags so the back / forward chevrons can hide independently:
  // forward hides at the right edge, back hides at the left edge. Both
  // hide entirely when the strip doesn't overflow.
  const [showNext, setShowNext] = useState(false);
  const [showPrev, setShowPrev] = useState(false);

  // Reveal each carousel chevron only when scrolling in that direction
  // is actually possible — listen on resize + scroll so the buttons
  // toggle as the user pages through the strip.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      const overflowing = el.scrollWidth > el.clientWidth + 4;
      const atStart = el.scrollLeft <= 4;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      setShowNext(overflowing && !atEnd);
      setShowPrev(overflowing && !atStart);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [templates.length]);

  // Paginated carousel — each click advances / rewinds by the strip's
  // visible width (a "page"), not a single card. At the design's
  // 1066-px viewport that's exactly 4 cards (4 × 254 + 3 × 16 gap =
  // 1064), and the math stays right at any responsive width because
  // we read `clientWidth` at click time instead of hard-coding a step.
  const handleNext = () => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth, behavior: 'smooth' });
  };
  const handlePrev = () => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: -el.clientWidth, behavior: 'smooth' });
  };

  return (
    <section
      className="bg-[#F3F3F4] rounded-[12px] px-[24px] py-[20px] flex flex-col gap-[8px] overflow-hidden relative"
      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
    >
      {/* Title + cards stack — gap-10 inside Frame 148 (1295:124078). */}
      <div className="flex flex-col gap-[10px]">
        <h2 className="text-[16px] leading-[24px] font-medium text-[#201E24]">
          Build a new report
        </h2>

        {/* Cards row — flex-row gap-16, hidden scrollbar. The section's
            overflow-hidden clips anything beyond the visible strip. */}
        <div
          ref={scrollerRef}
          className="flex gap-[16px] overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {templates.map((tpl) => {
            if (tpl.kind === 'scratch') {
              return (
                <button
                  key="scratch"
                  type="button"
                  onClick={() => onSelect(tpl)}
                  className={cn(
                    'flex-shrink-0 w-[254px] h-[147px] p-[24px] rounded-[8px]',
                    'border border-dashed border-[#E8E8E9] bg-[rgba(255,255,255,0.4)]',
                    'flex flex-col justify-between items-start text-left transition-all',
                    // Tailwind v4 strips the UA `cursor: pointer` from
                    // `<button>` so we re-add it explicitly — without
                    // this the cards read as static blocks even though
                    // they're clickable.
                    'cursor-pointer',
                    'hover:border-[#4D36FF] hover:bg-[rgba(77,54,255,0.04)]',
                  )}
                >
                  <IconPlus size={24} color="#201E24" />
                  <div className="flex flex-col gap-[2px] w-[175px]">
                    <span className="text-[14px] leading-[18px] font-medium text-[#201E24] tracking-[0.07px]">
                      {tpl.title}
                    </span>
                    <span className="text-[12px] leading-[18px] text-[#4C4B4F]">
                      {tpl.description}
                    </span>
                  </div>
                </button>
              );
            }
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onSelect(tpl)}
                className={cn(
                  'flex-shrink-0 w-[254px] h-[147px] p-[24px] rounded-[8px]',
                  'border border-solid border-[#E8E8E9] bg-white',
                  'flex flex-col justify-between items-start text-left transition-all',
                  // See the scratch-card cn() above for why this is here.
                  'cursor-pointer',
                  // Brand purple on hover — same accent the scratch
                  // card uses, so every card in the strip lights up
                  // with the same affordance.
                  'hover:border-[#4D36FF] hover:shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
                )}
              >
                {templateIcon(tpl.id, tpl.networks)}
                <div className="flex flex-col gap-[2px] w-full">
                  <span className="text-[14px] leading-[18px] font-medium text-[#201E24] tracking-[0.07px]">
                    {tpl.title}
                  </span>
                  <span className="text-[12px] leading-[18px] text-[#4C4B4F]">
                    {tpl.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Carousel back / forward buttons — 48×48 floating circles
          anchored to the strip edges. Top = 50% + 17 px lands the
          button on the strip mid-line (the title row pushes the strip
          downward, so geometric centre would float a few px high). The
          back button uses `IconArrowLeft` (the catalog's mirror of
          `arrow_right`) so both directions read from the icon
          component, not a rotated re-render. */}
      {showPrev && (
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Show previous templates"
          className={cn(
            'absolute left-[14px]',
            'w-[48px] h-[48px] rounded-full bg-[#FAFAFA]',
            'flex items-center justify-center transition-colors cursor-pointer',
            'hover:bg-white',
          )}
          style={{
            top: 'calc(50% + 17px)',
            transform: 'translateY(-50%)',
            border: '1.75px solid rgba(88,87,100,0.2)',
            boxShadow:
              '0 8px 16px rgba(32,30,36,0.1), 0 4px 8px rgba(32,30,36,0.1)',
          }}
        >
          <IconArrowLeft size={24} color="#201E24" />
        </button>
      )}
      {showNext && (
        <button
          type="button"
          onClick={handleNext}
          aria-label="Show more templates"
          className={cn(
            'absolute right-[14px]',
            'w-[48px] h-[48px] rounded-full bg-[#FAFAFA]',
            'flex items-center justify-center transition-colors cursor-pointer',
            'hover:bg-white',
          )}
          style={{
            top: 'calc(50% + 17px)',
            transform: 'translateY(-50%)',
            border: '1.75px solid rgba(88,87,100,0.2)',
            boxShadow:
              '0 8px 16px rgba(32,30,36,0.1), 0 4px 8px rgba(32,30,36,0.1)',
          }}
        >
          <IconArrowRight size={24} color="#201E24" />
        </button>
      )}
    </section>
  );
}
