'use client';

import { useEffect, useRef, useState } from 'react';
import { ReportModule } from '@/types';
import { OverflowDropdown } from './ModuleActions';
import { IconMoreVertical, IconDragHandle } from '@/components/icons/SendiIcons';
import { cn } from '@/lib/utils';

// ─── DividerElement ──────────────────────────────────────────────────────────
//
// Standalone horizontal-rule canvas block — the renderer for
// `module.elementKind === 'divider'`.  Pairs with `TextElement` and
// `EmojiElement` as the third "no data" element kind:
//
//   • No editable content — divider is purely visual.
//   • No bindings — `module` is read for layout only; the renderer
//     ignores `html`, `emoji`, `textStyle`, etc.
//   • Same edit-mode chrome as Text / Emoji elements (drag grip + the
//     more-options kebab) so all three feel consistent under the
//     hover state.
//
// Visual: a 1-px `#D2D2D3` rule that spans the cell's full width, vertically
// centered.  Padding 12 px top + bottom keeps the rule away from cell
// borders so adjacent elements don't visually butt against it.  Edit-mode
// hover paints the same brand-purple chrome ring used by Text / Emoji
// elements so the user knows they can manipulate it.

interface DividerElementProps {
  module: ReportModule;
  isEditMode: boolean;
  /** Duplicate this element (parent appends a copy below the original). */
  onDuplicate: () => void;
  /** Remove this element from the report. */
  onDelete: () => void;
}

// The divider's chrome is fixed: 12 px top padding + 1 px rule + 12 px
// bottom padding = 25 px.  We expose this on the parent grid-item via
// `--text-chrome-h` (the same CSS var TextElement uses) so the resize
// grip anchors to the rule's bottom edge instead of the cell's
// bottom — otherwise the grip floats in the empty space below.
const DIVIDER_CHROME_HEIGHT_PX = 25;

export function DividerElement({
  module: _module,
  isEditMode,
  onDuplicate,
  onDelete,
}: DividerElementProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const overflowBtnRef = useRef<HTMLButtonElement>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Outside-click closes the overflow menu.  Same pattern Text /
  // Emoji elements use — handler attaches only while open so we don't
  // burn cycles on every page click otherwise.
  useEffect(() => {
    if (!overflowOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (overflowBtnRef.current && overflowBtnRef.current.contains(target)) {
        return;
      }
      setOverflowOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overflowOpen]);

  // Write the chrome height to the parent grid-item so the
  // react-grid-layout resize grip can align to the rule's bottom
  // edge.  The CSS rule that consumes this var is in ReportCanvas
  // (it scopes the override via `:has(> .text-element-wrapper)`).
  // Constant value so no ResizeObserver needed — divider chrome
  // doesn't grow.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const parent = wrapper?.parentElement;
    if (!parent) return;
    parent.style.setProperty('--text-chrome-h', `${DIVIDER_CHROME_HEIGHT_PX}px`);
    return () => {
      parent.style.removeProperty('--text-chrome-h');
    };
  }, []);

  const showChrome = isEditMode && (isHovered || overflowOpen);

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ height: DIVIDER_CHROME_HEIGHT_PX }}
      className={cn(
        // Reuse `text-element-wrapper` so this element shares the same
        // CSS hooks as Text / Emoji (chrome paint while RGL drags,
        // resize-grip alignment via the `--text-chrome-h` variable).
        // Fixed `height` (instead of `h-full`) keeps the wrapper
        // hugging the rule's chrome — anything taller would put the
        // resize grip in dead space below the line.
        'text-element-wrapper relative w-full rounded-[6px] transition-colors duration-75',
        'border border-solid',
        showChrome
          ? 'bg-white border-[#4D36FF]'
          : 'bg-transparent border-transparent',
      )}
    >
      {/* Drag grip — vertically centered on the rule (`top-1/2
          -translate-y-1/2`) so it tracks the visible line, not the
          chrome's top edge.  Sized to match ModuleCard's drag-handle
          convention (24-tile glyph) — TextElement / EmojiElement use
          16 inline because their drag affordance lives next to text
          chrome; the divider has no inline content so the larger
          glyph lands cleaner. */}
      {isEditMode && (
        <div
          className={cn(
            'drag-handle text-element-action absolute left-[-2px] top-1/2 -translate-y-1/2',
            'flex items-center justify-center cursor-grab active:cursor-grabbing transition-opacity',
            showChrome ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
          aria-hidden="true"
        >
          <IconDragHandle size={24} color="#626165" />
        </div>
      )}

      {/* Overflow kebab — duplicate / delete affordances.  The
          divider's chrome is only 25 px tall so a vertically-centered
          28×28 button overflows the rule visually.  Anchor it
          ABOVE the chrome via `bottom-full`, then bleed back into
          the chrome by 12 px with `-mb-3` so the button sits "on the
          box" rather than floating above it.  Border + bg match the
          metric-card overflow button (Figma 1232:311142) so the
          chrome reads as one component family. */}
      {showChrome && (
        <button
          ref={overflowBtnRef}
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setOverflowOpen((v) => !v)}
          title="More actions"
          className={cn(
            'text-element-action absolute right-[8px] bottom-full -mb-3 z-10',
            'flex items-center justify-center w-7 h-7 p-[6px] rounded-[6px]',
            'border border-[#E8E8E9] transition-colors',
            overflowOpen ? 'bg-[#F3F3F4]' : 'bg-white hover:bg-[#F3F3F4]',
          )}
        >
          <IconMoreVertical size={16} color="#4C4B4F" />
        </button>
      )}
      {overflowOpen && (
        <OverflowDropdown
          anchorRef={overflowBtnRef}
          onDuplicate={() => {
            setOverflowOpen(false);
            onDuplicate();
          }}
          onDelete={() => {
            setOverflowOpen(false);
            onDelete();
          }}
        />
      )}

      {/* Rule — the divider itself.  1-px hairline `#D2D2D3` (DARK/
          dark--tint_80) full-width, vertically centered inside the
          12-px top/bottom padding.  A shade darker than the row
          borders so the rule reads cleanly as a content separator
          on the canvas surface. */}
      <div
        className="flex items-center w-full h-full px-[12px] py-[12px]"
        aria-label="Divider"
        role="separator"
      >
        <div className="w-full h-px bg-[#D2D2D3]" />
      </div>
    </div>
  );
}
