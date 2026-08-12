'use client';

/**
 * TextElement — non-data canvas element for free-form prose, headings, and
 * lists. Implements the eight Figma frames (1391:376822, 377936, 381377,
 * 382213, 378772, 383049, 379705, 380541) covering:
 *
 *   • Empty placeholder      → "Write about your data..." in DARK/dark--tint_70
 *   • Filled view-mode       → plain rendered prose, no chrome
 *   • Edit-mode hovered      → light-gray fill + purple border + drag dots
 *   • Edit-mode focused      → cursor visible, chrome stays
 *   • Edit-mode + toolbar    → floating B/I/U/Link bar above the element
 *   • Style-dropdown open    → Text / H1 / H2 / Bullet list / Numbered list
 *   • View-mode rendered     → no chrome, semantic markup
 *   • Multi-paragraph        → multiple lines render as the user typed them
 *
 * Implementation choices:
 *   • Content lives in a `contenteditable` div. We use the legacy
 *     `document.execCommand` for inline (bold/italic/underline/link) and
 *     block (formatBlock for h1/h2/p, insertUnorderedList /
 *     insertOrderedList for lists) commands. execCommand is officially
 *     deprecated but remains the only cross-browser primitive that doesn't
 *     require shipping a full editor framework.
 *   • The wrapper is always a `<div>` regardless of textStyle. We read the
 *     CURRENT block format via `queryCommandValue('formatBlock')` to drive
 *     the dropdown's checkmark — we don't try to maintain a separate
 *     React-side mirror. The DOM IS the model.
 *   • The toolbar mounts in a portal anchored above the chrome wrapper so
 *     it escapes the canvas's `overflow-hidden` clipping.
 *   • Drag handle uses the canvas's `.drag-handle` class so RGL grabs it
 *     for the move gesture. Visible only in edit mode while hovered or
 *     focused. Per Figma 1391:381539 the dot cluster sits *inside* the
 *     chrome at left=6 px (not outside the module like ModuleCard).
 *   • Auto-size: the chrome wrapper hugs intrinsic content height. A
 *     ResizeObserver translates that pixel height into grid rows
 *     (ceil((px + BOTTOM_GAP_PX) / ROW_HEIGHT_PX)) and pushes it back
 *     to the parent via `onChange({ layoutH })`. Effect: a fresh text
 *     drop renders at one-line height (~44 px / h=30) and grows
 *     row-by-row as the user types more lines — no extra space below
 *     until the user wants it.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ReportModule, TextStyle } from '@/types';
import {
  IconText,
  IconLink,
  IconCheck,
  IconChevronDown,
  IconMoreVertical,
} from '@/components/icons/SendiIcons';
import { OverflowDropdown } from './ModuleActions';
import { cn } from '@/lib/utils';

interface TextElementProps {
  module: ReportModule;
  isEditMode: boolean;
  /** Persist HTML / textStyle / intrinsic height changes back into the
   *  parent's modules state. `layoutH` is in grid rows. */
  onChange: (patch: { html?: string; textStyle?: TextStyle; layoutH?: number }) => void;
  /** Duplicate this element (parent appends a copy below the original). */
  onDuplicate: () => void;
  /** Remove this element from the report. */
  onDelete: () => void;
}

// Grid-math constants — kept in sync with ReportCanvas. ReportCanvas runs
// the grid with `rowHeight = 2`, `marginY = 0`, and a 16 px transparent
// padding-bottom on every grid item (so each item's painted area is
// `h × 2 − 16` px tall). We derive `h` (grid rows) from the chrome
// wrapper's intrinsic pixel height by inverting that formula:
//   visiblePx = h × ROW_HEIGHT_PX − BOTTOM_GAP_PX
//   ⇒ h = (visiblePx + BOTTOM_GAP_PX) / ROW_HEIGHT_PX
// Ceiling the result so the cell never truncates content.
const ROW_HEIGHT_PX = 2;
/** Transparent gap below the painted card, in px. Matches the
 *  padding-bottom rule in ReportCanvas. */
const BOTTOM_GAP_PX = 16;
/** Smallest h a text element will ever shrink to. 30 rows ⇒ 30 × 2 − 16
 *  = 44 px visible, the height of an empty single-line `<p>` chrome
 *  wrapper at 16 px font-size + 12 px top / 12 px bottom padding. */
const MIN_TEXT_ROWS = 30;

/**
 * Convert an intrinsic content height (in px) to the smallest number of
 * grid rows that fully contains it. The grid item's painted area is
 * `h × ROW_HEIGHT_PX − BOTTOM_GAP_PX`, so `h = (pxH + BOTTOM_GAP_PX) /
 * ROW_HEIGHT_PX` is the inverse; ceiling guarantees the wrapper fits
 * without clipping.
 */
function pxToRows(pxH: number): number {
  const h = Math.ceil((pxH + BOTTOM_GAP_PX) / ROW_HEIGHT_PX);
  return Math.max(MIN_TEXT_ROWS, h);
}

// ─── Style metadata ──────────────────────────────────────────────────────────
type StyleMeta = {
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  /** Visual preset class applied to the contenteditable. The block-level
   *  command rewrites tags inline; this class controls the "default" line
   *  styling so empty editors still preview the chosen style. */
  presetClass: string;
};

const STYLE_META: Record<TextStyle, StyleMeta> = {
  'text': {
    label: 'Text',
    Icon: IconText,
    presetClass: 'text-element--text',
  },
  'heading-1': {
    label: 'Heading 1',
    Icon: IconHeading1,
    presetClass: 'text-element--h1',
  },
  'heading-2': {
    label: 'Heading 2',
    Icon: IconHeading2,
    presetClass: 'text-element--h2',
  },
  'bullet-list': {
    label: 'Bullet list',
    Icon: IconBulletList,
    presetClass: 'text-element--ul',
  },
  'numbered-list': {
    label: 'Numbered list',
    Icon: IconNumberedList,
    presetClass: 'text-element--ol',
  },
};

const STYLE_ORDER: TextStyle[] = ['text', 'heading-1', 'heading-2', 'bullet-list', 'numbered-list'];

/**
 * Split an existing list around `targetLi`, replacing that single item
 * with `replacement` and preserving the OTHER `<li>` children as a new
 * list (or two lists, before + after).  Notion / Google-Docs / Slack
 * behavior — converting or removing one item out of a multi-item list
 * must NEVER drop the unselected items.
 *
 *   ul: [A, B, C], target=B, replacement=<h1>B</h1>
 *   →  ul: [A]       (before, only if non-empty)
 *      <h1>B</h1>     (replacement)
 *      ul: [C]       (after, only if non-empty)
 *
 * If the target's parent is NOT a list, this is a no-op (defensive — the
 * caller is responsible for confirming the LI lives inside a UL/OL).
 */
function splitListAroundLi(targetLi: HTMLElement, replacement: Node): void {
  const oldList = targetLi.parentElement;
  if (
    !oldList ||
    (oldList.tagName !== 'UL' && oldList.tagName !== 'OL') ||
    !oldList.parentNode
  ) {
    return;
  }
  const listTagName = oldList.tagName.toLowerCase();
  const items = Array.from(oldList.children);
  const idx = items.indexOf(targetLi);
  if (idx < 0) return;
  const beforeLis = items.slice(0, idx);
  const afterLis = items.slice(idx + 1);

  const frag = document.createDocumentFragment();
  if (beforeLis.length > 0) {
    const beforeList = document.createElement(listTagName);
    for (const li of beforeLis) beforeList.appendChild(li);
    frag.appendChild(beforeList);
  }
  frag.appendChild(replacement);
  if (afterLis.length > 0) {
    const afterList = document.createElement(listTagName);
    for (const li of afterLis) afterList.appendChild(li);
    frag.appendChild(afterList);
  }
  oldList.parentNode.replaceChild(frag, oldList);
}

/**
 * Walk up from `start` toward `stopAt` (exclusive) looking for the
 * nearest enclosing element whose tagName is in `tags`.  Returns null if
 * none is found before reaching the editor root.  Used by Enter/Backspace
 * key handlers to identify the list-item ancestor (if any) of the caret.
 */
function findAncestor(
  start: Node | null,
  stopAt: Node,
  tags: Set<string>,
): HTMLElement | null {
  let node: Node | null = start;
  while (node && node !== stopAt) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName;
      if (tags.has(tag)) return node as HTMLElement;
    }
    node = node.parentNode;
  }
  return null;
}

/**
 * True if a list item carries no user content — i.e. trimming whitespace
 * (and ignoring caret-placeholder `<br>` tags that browsers insert into
 * empty contenteditable nodes) leaves nothing.  Used by the Enter handler
 * to decide between "split LI in place" (default browser behavior, when
 * the LI has text) and "exit list, replace with paragraph" (when empty).
 */
function isLiEmpty(li: HTMLElement): boolean {
  // textContent strips tags but keeps text and zero-width chars; the
  // ZWSP guard handles editors that pad with U+200B for caret stability.
  const text = (li.textContent ?? '').replace(/\u200B/g, '').trim();
  if (text.length > 0) return false;
  // Reject LIs that contain real media even when they have no text.
  if (li.querySelector('img, video, iframe, audio, svg, picture')) return false;
  return true;
}

/**
 * Walk up from `node` looking for an enclosing `<a>`. Returns null if the
 * walk reaches `stopAt` (the editor root) without finding one. Used by
 * the link popover to detect "caret is inside an existing link", which
 * pre-fills the URL input and unlocks the Remove button.
 */
function findLinkAncestor(
  node: Node | null,
  stopAt: Node,
): HTMLAnchorElement | null {
  let n: Node | null = node;
  while (n && n !== stopAt) {
    if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === 'A') {
      return n as HTMLAnchorElement;
    }
    n = n.parentNode;
  }
  return null;
}

/**
 * Normalize a user-typed URL for `createLink`. Returns null for an empty
 * input so the caller can short-circuit (per spec: empty input → don't
 * apply). Adds `https://` when the input has no scheme so naked
 * `sendible.com` becomes a real link instead of a relative path. Existing
 * schemes (http, https, mailto:, tel:, ftp:, etc.) are preserved.
 */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // RFC 3986 scheme: ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ) ":"
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

// ─── Inline icons ────────────────────────────────────────────────────────────
// All toolbar icons follow Figma 1406:437703 (Phosphor-style 16×16, 1px
// stroke, round caps and joins, color via the `color` prop so callers can
// pass BRAND/dark `#201E24` directly).
function IconBold({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5 7.5H10C10.663 7.5 11.2989 7.76339 11.7678 8.23223C12.2366 8.70107 12.5 9.33696 12.5 10C12.5 10.663 12.2366 11.2989 11.7678 11.7678C11.2989 12.2366 10.663 12.5 10 12.5H5V3H9.25C9.84674 3 10.419 3.23705 10.841 3.65901C11.2629 4.08097 11.5 4.65326 11.5 5.25C11.5 5.84674 11.2629 6.41903 10.841 6.84099C10.419 7.26295 9.84674 7.5 9.25 7.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconItalic({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9.5 3.5L6.5 12.5" stroke={color} strokeWidth={1.33} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12.5H9" stroke={color} strokeWidth={1.33} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 3.5H12" stroke={color} strokeWidth={1.33} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUnderline({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 14H12" stroke={color} strokeWidth={1.33} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M11.5 3.5V8.5C11.5 9.42826 11.1313 10.3185 10.4749 10.9749C9.8185 11.6313 8.92826 12 8 12C7.07174 12 6.1815 11.6313 5.52513 10.9749C4.86875 10.3185 4.5 9.42826 4.5 8.5V3.5"
        stroke={color}
        strokeWidth={1.33}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconHeading1({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 3.5V11" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 7.25H2.5" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 3.5V11" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 13V7L12.5 8" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconHeading2({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 3.5V11" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 7.25H2.5" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 3.5V11" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M15 12.9996H12L14.6981 9.40209C14.8282 9.22931 14.9193 9.03045 14.9653 8.81915C15.0114 8.60784 15.0111 8.38909 14.9647 8.17788C14.9183 7.96667 14.8267 7.76799 14.6963 7.59548C14.5659 7.42297 14.3997 7.28069 14.2092 7.1784C14.0186 7.07611 13.8082 7.01623 13.5924 7.00287C13.3766 6.9895 13.1604 7.02296 12.9587 7.10096C12.757 7.17896 12.5745 7.29965 12.4238 7.45476C12.2731 7.60986 12.1578 7.79572 12.0856 7.99959"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBulletList({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  // Phosphor "ListDashes" — 3 horizontal lines paired with 3 short dashes.
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 4.5H13M6 8H13M6 11.5H13M3 4.5H4M3 8H4M3 11.5H4"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconNumberedList({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.5 4H13.5" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 8H13.5" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 12H13.5" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 6.5V2.5L2.5 3" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4.5 13.0004H2.5L4.2925 10.6023C4.37381 10.4981 4.4332 10.3785 4.46712 10.2507C4.50103 10.123 4.50876 9.98967 4.48985 9.85884C4.47093 9.72801 4.42576 9.60236 4.35705 9.48943C4.28834 9.3765 4.1975 9.27863 4.09 9.2017C3.87093 9.04178 3.59843 8.97294 3.32969 9.00965C3.06096 9.04636 2.8169 9.18576 2.64875 9.39857C2.5855 9.47988 2.53531 9.57055 2.5 9.66732"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Six-dot drag grip — Figma 1391:381539 "Dots Container". An 8 × 13 box
 * containing a 2-column × 3-row grid of dots in DARK/dark--tint_30
 * (#626165). Mirrors the column-drag pattern Notion uses inside its
 * blocks (vs. ModuleCard's external 20×20 IconDragHandle, which sits
 * outside data modules — text elements anchor the grip *inside* the
 * chrome, per the Figma design).
 */
function IconDragDots({ color = '#626165' }: { color?: string }) {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true">
      <circle cx="1.5" cy="1.5" r="1.5" fill={color} />
      <circle cx="6.5" cy="1.5" r="1.5" fill={color} />
      <circle cx="1.5" cy="6.5" r="1.5" fill={color} />
      <circle cx="6.5" cy="6.5" r="1.5" fill={color} />
      <circle cx="1.5" cy="11.5" r="1.5" fill={color} />
      <circle cx="6.5" cy="11.5" r="1.5" fill={color} />
    </svg>
  );
}

// ─── Floating toolbar ────────────────────────────────────────────────────────

interface LinkContext {
  /** Pre-fills the URL input — empty string for "create new link",
   *  existing href when editing an `<a>` the caret is parked inside. */
  initialUrl: string;
  /** Toggles visibility of the Remove affordance. Only meaningful when
   *  the saved range covers an existing `<a>`. */
  isEditing: boolean;
}

interface ToolbarProps {
  anchorRect: DOMRect | null;
  currentStyle: TextStyle;
  onStyleChange: (s: TextStyle) => void;
  onCommand: (cmd: 'bold' | 'italic' | 'underline') => void;
  /** Live "is this format applied at the caret?" flags. The matching
   *  buttons paint with the hover-tint background when their flag is
   *  true so the toolbar advertises the current formatting state. */
  activeInline: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    link: boolean;
  };
  /** Triggered when the user clicks the link button. Parent decides
   *  whether to open the popover (it captures the live range first). */
  onLink: () => void;
  /** Non-null when the parent has decided to show the link popover. */
  linkContext: LinkContext | null;
  /** Apply the link to the saved range. URL validation/normalization
   *  happens here so the popover stays declarative. */
  onApplyLink: (url: string) => void;
  /** Strip the existing link wrapper (execCommand 'unlink'). */
  onRemoveLink: () => void;
  /** User cancelled (Escape, X button, …). */
  onCloseLink: () => void;
  rootRef: React.RefObject<HTMLDivElement | null>;
}

function Toolbar({
  anchorRect,
  currentStyle,
  onStyleChange,
  onCommand,
  activeInline,
  onLink,
  linkContext,
  onApplyLink,
  onRemoveLink,
  onCloseLink,
  rootRef,
}: ToolbarProps) {
  const [styleOpen, setStyleOpen] = useState(false);
  const styleBtnRef = useRef<HTMLButtonElement>(null);

  if (!anchorRect) return null;

  // Figma 1406:437703 chrome geometry:
  //   • outer wrapper: border #E8E8E9, padding 4 px, gap 4 px, rounded 6 px,
  //     dual drop shadow `0 4 8 + 0 8 16 @ rgba(32,30,36,0.1)`.
  //   • Each cell:    padding 4 px, rounded 4 px (so a 16-px icon yields a
  //     24-px hit target).  Active/hover background uses the design token
  //     `--button/primary/text/text-background:hover` = rgba(81,61,217,0.1).
  //   • Style trigger: icon (16) + 4 px gap + chevron (12), all inside the
  //     same 4-px-padded cell → ~40-px-wide trigger, distinct from the
  //     square 24-px icon-only cells.
  // Negative gap intentional: the toolbar's bottom edge slips ~8 px
  // INSIDE the wrapper so it visually attaches to the chrome instead of
  // floating away from it. Matches the Notion / Linear pattern where the
  // floating toolbar overlaps the top of the active block.
  const GAP_ABOVE_ANCHOR = -8;
  // The toolbar width is intrinsic; we pin only the top/left and let the
  // flex layout determine width so future affordances (e.g. extra block
  // buttons) don't overflow a hardcoded TOOLBAR_W.
  const TOOLBAR_H_APPROX = 32; // 4+24+4 (padding + cell + padding)
  const top = anchorRect.top - TOOLBAR_H_APPROX - GAP_ABOVE_ANCHOR + window.scrollY;
  const left = anchorRect.left + window.scrollX;

  const stopFocusSteal = (e: React.MouseEvent) => e.preventDefault();

  return createPortal(
    <div
      ref={rootRef}
      // `position: fixed` already establishes a containing block for
      // absolutely-positioned descendants, so the LinkPopover's
      // `absolute left-0 top-[36px]` anchors directly to the toolbar's
      // bottom-left without needing a `relative` here. (Adding both
      // `fixed` and `relative` is a class collision — Tailwind emits
      // `relative` after `fixed`, which overrode the viewport pinning
      // and made the toolbar drift off-screen.)
      className="fixed z-50 flex items-center gap-1 bg-white border border-[#e8e8e9] rounded-[6px] p-1"
      style={{
        top,
        left,
        boxShadow:
          '0px 4px 8px 0px rgba(32,30,36,0.1), 0px 8px 16px 0px rgba(32,30,36,0.1)',
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}
      onMouseDown={stopFocusSteal}
    >
      <div className="relative">
        <button
          ref={styleBtnRef}
          type="button"
          // Toggle on mousedown (not click) for the same reason the
          // option buttons below do — keeps the editor's live
          // selection alive and avoids click-event drops in portaled
          // menus. preventDefault is essential: without it the button
          // would steal focus and the saved range would collapse
          // before the user could pick an option.
          onMouseDown={(e) => {
            e.preventDefault();
            setStyleOpen((v) => !v);
          }}
          className={cn(
            'flex items-center gap-1 p-1 rounded-[4px] hover:bg-[rgba(32,30,36,0.05)] transition-colors',
            styleOpen && 'bg-[rgba(81,61,217,0.1)]',
          )}
          aria-label="Text style"
        >
          <IconText
            size={16}
            color="#201E24"
          />
          <IconChevronDown size={12} color="#201E24" />
        </button>

        {styleOpen && (
          // Dropdown geometry per Figma 1406:437751 "Dropdown / Image":
          // min-w 192, max-w 240, py-8, rounded 4, shadow stack
          // `0 0 0 1px + 0 12 8 -4 + 0 4 4 -2`. Items are 40 px tall with
          // gap-16, px-16, py-8, IBM Plex 14/14 tracking 0.07.
          <div
            className="absolute left-0 top-[36px] min-w-[192px] max-w-[240px] w-[192px] bg-white rounded-[4px] py-2 overflow-clip"
            style={{
              boxShadow:
                '0px 0px 0px 1px rgba(32,30,36,0.1), 0px 12px 8px -4px rgba(32,30,36,0.15), 0px 4px 4px -2px rgba(32,30,36,0.2)',
            }}
            onMouseDown={stopFocusSteal}
          >
            <div className="flex flex-col items-start px-2 w-full">
              {STYLE_ORDER.map((styleId) => {
                const meta = STYLE_META[styleId];
                const Icon = meta.Icon;
                const selected = currentStyle === styleId;
                return (
                  <button
                    key={styleId}
                    type="button"
                    // Apply on MOUSEDOWN, not click. Two reasons:
                    //   1. preventDefault on mousedown keeps focus in
                    //      the editor — the live selection survives.
                    //   2. Some browsers + portaled menus don't always
                    //      dispatch a `click` after a button press
                    //      whose mousedown was preventDefaulted; by
                    //      doing the work in the mousedown handler we
                    //      bypass that whole class of failures.
                    // This is the same pattern Slate / Lexical /
                    // Notion use for their floating-toolbar dropdowns.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onStyleChange(styleId);
                      setStyleOpen(false);
                    }}
                    className={cn(
                      'w-full h-10 flex items-center gap-4 px-4 py-2 rounded-[4px] text-left text-[#201E24] transition-colors hover:bg-[rgba(32,30,36,0.05)]',
                      selected && 'bg-[rgba(81,61,217,0.1)]',
                    )}
                    style={{
                      fontFamily: 'IBM Plex Sans, sans-serif',
                      fontSize: 14,
                      lineHeight: '14px',
                      letterSpacing: '0.07px',
                    }}
                  >
                    <Icon size={16} color="#201E24" />
                    <span className="flex-1 truncate">{meta.label}</span>
                    {selected && <IconCheck size={16} color="#201E24" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ToolbarIconButton
        onClick={() => onCommand('bold')}
        aria-label="Bold"
        active={activeInline.bold}
      >
        <IconBold size={16} color="#201E24" />
      </ToolbarIconButton>
      <ToolbarIconButton
        onClick={() => onCommand('italic')}
        aria-label="Italic"
        active={activeInline.italic}
      >
        <IconItalic size={16} color="#201E24" />
      </ToolbarIconButton>
      <ToolbarIconButton
        onClick={() => onCommand('underline')}
        aria-label="Underline"
        active={activeInline.underline}
      >
        <IconUnderline size={16} color="#201E24" />
      </ToolbarIconButton>
      <ToolbarIconButton
        onClick={onLink}
        aria-label="Link"
        active={activeInline.link || linkContext !== null}
      >
        <IconLink
          size={16}
          color="#201E24"
        />
      </ToolbarIconButton>
      {linkContext && (
        <LinkPopover
          initialUrl={linkContext.initialUrl}
          isEditing={linkContext.isEditing}
          onApply={onApplyLink}
          onRemove={onRemoveLink}
          onClose={onCloseLink}
        />
      )}
    </div>,
    document.body,
  );
}

// ─── Link popover ────────────────────────────────────────────────────────────
// Replaces the old `window.prompt('Enter URL')` (which throws "prompt() is
// not supported" inside the Next.js dev iframe). The popover is a regular
// React component anchored under the toolbar; it captures keyboard input,
// validates the URL on submit, and asks the parent to apply / remove via
// execCommand so the action remains undoable. The editor's saved range
// lives in `linkRangeRef` on the parent — this component is purely visual.
interface LinkPopoverProps {
  initialUrl: string;
  isEditing: boolean;
  onApply: (url: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

function LinkPopover({
  initialUrl,
  isEditing,
  onApply,
  onRemove,
  onClose,
}: LinkPopoverProps) {
  const [value, setValue] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus + select the input on mount so the user can either start typing
  // a fresh URL (replacing the placeholder) or refine the pre-filled
  // existing href without having to click into the field.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  const submit = () => onApply(value);

  return (
    <div
      // Sits 4 px below the toolbar (36 = toolbar height 32 + 4 gap).
      className="absolute left-0 top-[36px] flex items-center gap-1 bg-white border border-[#e8e8e9] rounded-[6px] p-1"
      style={{
        boxShadow:
          '0px 4px 8px 0px rgba(32,30,36,0.1), 0px 8px 16px 0px rgba(32,30,36,0.1)',
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}
      // Don't preventDefault on mousedown for the popover root — the
      // input MUST be allowed to receive focus when clicked. The parent
      // toolbar's outer mousedown DOES preventDefault, so we stop
      // propagation here to keep the popover interactive.
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="url"
        placeholder="https://example.com"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        className="w-[240px] h-8 px-2 rounded-[4px] border border-[#e8e8e9] text-[14px] text-[#201E24] outline-none focus:border-[#4D36FF]"
        style={{
          fontFamily: 'IBM Plex Sans, sans-serif',
          letterSpacing: '0.07px',
        }}
      />
      <button
        type="button"
        // Same focus-preserving pattern the toolbar buttons use:
        // preventDefault on mousedown so the input doesn't lose focus
        // before we commit.
        onMouseDown={(e) => e.preventDefault()}
        onClick={submit}
        className="h-8 px-3 rounded-[4px] bg-[#4D36FF] text-white text-[14px] hover:bg-[#3D2BCC] transition-colors"
        style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
      >
        {isEditing ? 'Save' : 'Apply'}
      </button>
      {isEditing && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onRemove}
          className="h-8 px-3 rounded-[4px] text-[#201E24] text-[14px] hover:bg-[rgba(32,30,36,0.05)] transition-colors"
          style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
        >
          Remove
        </button>
      )}
    </div>
  );
}

function ToolbarIconButton({
  onClick,
  children,
  active = false,
  'aria-label': ariaLabel,
}: {
  onClick: () => void;
  children: React.ReactNode;
  /** When true, paint the button with the same `rgba(81,61,217,0.1)`
   *  tint it shows on hover — the design-system token
   *  `--button/primary/text/text-background:hover`. Used to advertise
   *  that the format (bold / italic / underline / link) is currently
   *  applied at the caret position. */
  active?: boolean;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center p-1 rounded-[4px] transition-colors hover:bg-[rgba(32,30,36,0.05)]',
        active && 'bg-[rgba(81,61,217,0.1)]',
      )}
    >
      {children}
    </button>
  );
}

// ":" suggestion dropdown — shows up to 8 matches as the user types
// `:query`.  Pure-presentational: parent owns the query string, the
// match list, the highlighted index, and the accept/cancel callbacks.
// Anchored at a screen-space rect (the live caret's bounding rect) and
// rendered as a portal so it can escape any overflow:hidden ancestor on
// the editor's grid item.

interface EmojiSuggestion {
  id: string;
  native: string;
  name: string;
}

interface EmojiSuggestionDropdownProps {
  /** Caret position in viewport coordinates — top/left of the rect we
   *  paint the dropdown immediately below. */
  anchorRect: DOMRect;
  matches: EmojiSuggestion[];
  highlightedIndex: number;
  onPick: (index: number) => void;
  onHover: (index: number) => void;
}

function EmojiSuggestionDropdown({
  anchorRect,
  matches,
  highlightedIndex,
  onPick,
  onHover,
}: EmojiSuggestionDropdownProps) {
  if (matches.length === 0) return null;
  const top = anchorRect.bottom + 4 + window.scrollY;
  const left = anchorRect.left + window.scrollX;
  return createPortal(
    <div
      // Same chrome as LinkPopover for visual consistency.
      className="fixed z-50 bg-white border border-[#e8e8e9] rounded-[6px] py-1 min-w-[220px] max-w-[260px]"
      style={{
        top,
        left,
        boxShadow:
          '0px 4px 8px 0px rgba(32,30,36,0.1), 0px 8px 16px 0px rgba(32,30,36,0.1)',
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}
      // Don't steal focus from the editor — the suggestion is driven by
      // the editor's keydown stream.
      onMouseDown={(e) => e.preventDefault()}
    >
      {matches.map((m, i) => (
        <button
          key={m.id}
          type="button"
          onMouseEnter={() => onHover(i)}
          onClick={() => onPick(i)}
          className={cn(
            'w-full flex items-center gap-2 px-3 h-8 text-left text-[14px] text-[#201E24] transition-colors',
            i === highlightedIndex
              ? 'bg-[rgba(81,61,217,0.1)]'
              : 'hover:bg-[rgba(32,30,36,0.05)]',
          )}
          style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
        >
          <span className="text-[18px] leading-none">{m.native}</span>
          <span className="text-[13px] text-[#626165]">:{m.id}:</span>
          <span className="ml-auto text-[12px] text-[#9C9B9D] truncate">
            {m.name}
          </span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

// ─── TextElement ─────────────────────────────────────────────────────────────

export function TextElement({
  module,
  isEditMode,
  onChange,
  onDuplicate,
  onDelete,
}: TextElementProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  // True only while the user has an actual *non-collapsed* selection
  // inside this editor — the formatting toolbar (B/I/U/Link/style) is
  // gated on this flag rather than on `isFocused` so it surfaces only
  // when the user has highlighted text to format. That matches the
  // Notion/Google-Docs/Medium pattern where the floating toolbar
  // appears on selection, not on caret-only focus. Tracked separately
  // from `isFocused` because the caret can be inside the editor with
  // an empty (collapsed) range, which should NOT show the toolbar.
  const [hasSelection, setHasSelection] = useState(false);
  // The text-style label that should appear "checked" in the dropdown —
  // resolved from the *block ancestor* of the live selection, not the
  // module's default style. Without this the check mark always points
  // at `module.textStyle` (e.g. "Text") even if the user has selected
  // an <h1> inside the editor, making the dropdown lie about the active
  // type. Recomputed in the same selectionchange handler that drives
  // hasSelection so the indicator stays in sync without a second pass.
  //
  // Initial value: seed from `module.textStyle` so an H1 / H2 / list
  // module's dropdown shows the correct active item the first time the
  // toolbar appears — before any `selectionchange` has fired to resolve
  // the block ancestor. Without this seed the dropdown defaulted to
  // 'text' for every module regardless of its drag-time type, which is
  // exactly the bug we're fixing here.
  const [activeBlockStyle, setActiveBlockStyle] = useState<TextStyle>(
    module.textStyle ?? 'text',
  );
  // Inline-format active state for the toolbar's B/I/U/Link buttons.
  // When the caret/selection is inside text that already carries the
  // format, the corresponding button paints with the same purple-tint
  // background it shows on hover (per Figma `--button/primary/text/
  // text-background:hover` token). Reads `queryCommandState` for B/I/U
  // (the de-facto contenteditable state API) and walks up the DOM for
  // <a> ancestors since there's no built-in queryCommand for "linked".
  const [activeInline, setActiveInline] = useState({
    bold: false,
    italic: false,
    underline: false,
    link: false,
  });

  // Snapshot the current bold/italic/underline/link state at `from`
  // (defaults to the live selection's anchor) and push it into the
  // toolbar's `activeInline` state so the matching button paints with
  // the hover-tint background. Called both on `selectionchange` AND
  // synchronously after `execCommand` so we don't depend on the browser
  // dispatching a selectionchange event in response to the command —
  // some Chromium versions skip it for inline-format toggles, leaving
  // the toolbar visually stale until the next caret move.
  const refreshActiveInline = useCallback((from?: Node) => {
    const editor = editorRef.current;
    if (!editor) return;
    let anchor: Node | null = from ?? null;
    if (!anchor) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        anchor = sel.getRangeAt(0).startContainer;
      }
    }
    if (!anchor || !editor.contains(anchor)) return;
    setActiveInline({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      link: findLinkAncestor(anchor, editor) !== null,
    });
  }, []);
  // The most recent non-collapsed selection range inside this editor.
  // We snapshot it on every `selectionchange` and restore it right
  // before issuing an execCommand so the formatting/style change
  // ALWAYS targets the user's highlighted range — never the whole
  // editor. Without this, a stray focus/blur cycle (e.g. clicking the
  // style dropdown's surface) can collapse the selection between the
  // user clicking the toolbar and our handler firing, and execCommand
  // would then act on an empty caret position which formatBlock
  // expands to "the entire current block".
  const savedRangeRef = useRef<Range | null>(null);
  const overflowBtnRef = useRef<HTMLButtonElement>(null);

  // ── Undo / redo stack ───────────────────────────────────────────────
  // Block-style conversions in `applyTextStyle` mutate the DOM directly
  // (because `execCommand('formatBlock')` is unreliable for H1↔H2 in
  // Chromium and can't model list-split semantics around a single LI).
  // Direct DOM mutations bypass the browser's native undo stack, so
  // pressing Ctrl/Cmd+Z after "convert paragraph to H1" would otherwise
  // step over the conversion entirely and undo whatever typing came
  // before it.
  //
  // We solve this by maintaining our own snapshot stack and intercepting
  // the standard undo/redo shortcuts. To keep behavior consistent across
  // the editor we route ALL user-visible changes through this stack —
  // block conversions, inline B/I/U toggles, link apply/remove, and
  // typing bursts — rather than mixing native browser undo for some ops
  // with our stack for others (which would surface as Ctrl+Z alternating
  // confusingly between two different histories).
  //
  // Typing isn't snapshotted per keystroke; that would explode the stack
  // and force the user to step through one character at a time. Instead
  // we snapshot at the START of a typing burst via `beforeinput`, gated
  // by a quiet-window timer so a continuous run of keystrokes shares
  // ONE undo entry — the same chunking Notion / Google Docs use.
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  // Wall-clock timestamp of the most recent input snapshot. We only
  // push a fresh snapshot for typing if more than INPUT_SNAPSHOT_QUIET_MS
  // have elapsed since the previous typing snapshot, OR if a non-input
  // operation (block convert / inline toggle / link) reset the timer to
  // 0 so the next keystroke is treated as the start of a new burst.
  const lastInputSnapshotRef = useRef<number>(0);
  // 750 ms quiet window — long enough that a sustained typing run stays
  // in one undo group, short enough that pausing to think and resuming
  // creates a sensible undo boundary.
  const INPUT_SNAPSHOT_QUIET_MS = 750;
  // Hard cap so a marathon editing session can't pin unbounded HTML
  // strings in memory. 200 entries × ~few KB each is well under any
  // real-world budget while supporting deep undo histories.
  const UNDO_STACK_LIMIT = 200;

  // Push the current editor HTML onto the undo stack and clear redo.
  // No-op when the top entry already equals the current HTML — keeps
  // double-clicks on toolbar buttons from creating duplicate entries
  // the user has to step through twice.
  const pushUndoSnapshot = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const snapshot = el.innerHTML;
    const stack = undoStackRef.current;
    if (stack.length > 0 && stack[stack.length - 1] === snapshot) return;
    stack.push(snapshot);
    if (stack.length > UNDO_STACK_LIMIT) stack.shift();
    redoStackRef.current = [];
  }, []);

  // Restore a snapshot to the editor and notify the parent. Caret is
  // parked at the end of the restored content — the original positions
  // are gone with the old DOM nodes, and "end of content" is the most
  // predictable resting place (matches Notion behavior post-undo). The
  // saved range is cleared because its node references no longer point
  // anywhere in the live DOM.
  const applyUndoSnapshot = useCallback(
    (snapshot: string) => {
      const el = editorRef.current;
      if (!el) return;
      el.innerHTML = snapshot;
      savedRangeRef.current = null;
      const sel = window.getSelection();
      if (sel && document.activeElement === el) {
        sel.removeAllRanges();
        const r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(false);
        sel.addRange(r);
      }
      onChange({ html: snapshot });
      // Force the next typing event to start a fresh burst so post-undo
      // typing doesn't roll into the chunk we just popped.
      lastInputSnapshotRef.current = 0;
    },
    [onChange],
  );

  const performUndo = useCallback(() => {
    const el = editorRef.current;
    if (!el) return false;
    const stack = undoStackRef.current;
    if (stack.length === 0) return false;
    const current = el.innerHTML;
    const prev = stack.pop()!;
    redoStackRef.current.push(current);
    if (redoStackRef.current.length > UNDO_STACK_LIMIT) {
      redoStackRef.current.shift();
    }
    applyUndoSnapshot(prev);
    return true;
  }, [applyUndoSnapshot]);

  const performRedo = useCallback(() => {
    const el = editorRef.current;
    if (!el) return false;
    const stack = redoStackRef.current;
    if (stack.length === 0) return false;
    const current = el.innerHTML;
    const next = stack.pop()!;
    undoStackRef.current.push(current);
    if (undoStackRef.current.length > UNDO_STACK_LIMIT) {
      undoStackRef.current.shift();
    }
    applyUndoSnapshot(next);
    return true;
  }, [applyUndoSnapshot]);

  const textStyle: TextStyle = module.textStyle ?? 'text';
  const html = module.html ?? '';
  const currentH = module.layout.h;

  // The CSS `:empty` pseudo-class can't be relied on for placeholder
  // visibility: contenteditable browsers (Chrome / Safari) auto-inject
  // a `<br>` into an "empty" editor as soon as it's focused so the
  // caret has somewhere to live, and that breaks `:empty`. We track
  // emptiness explicitly.  We strip ALL tags (not just `<p>` / `<br>`)
  // because the editor's seed for an H1 / H2 / list module carries
  // those wrappers from mount — without the broader strip the
  // placeholder would never show on a freshly-dropped heading or list
  // module. After tag-stripping we treat &nbsp; as whitespace so a
  // browser-injected non-breaking space (some IMEs emit one for an
  // "empty" line) doesn't suppress the placeholder either.
  const isEditorEmpty =
    html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim() === '';

  // Map the module's textStyle onto the seed HTML the editor should
  // start with when `module.html` is empty.  Without a matching block
  // tag in the live DOM the `selectionchange` block-ancestor walk
  // resolves to 'text' for ANY freshly-dropped module — that's how
  // the dropdown ends up showing "Text" even on a Heading 1 module.
  // Seeding `<h1><br></h1>` (etc.) on mount makes the DOM agree with
  // `module.textStyle`, so the very first click into the editor
  // resolves to the correct active block style. The trailing `<br>`
  // gives the empty block visible height and a caret-friendly anchor;
  // browsers strip it as soon as the user types.
  const seedFromTextStyle = (style: TextStyle): string => {
    switch (style) {
      case 'heading-1':
        return '<h1><br></h1>';
      case 'heading-2':
        return '<h2><br></h2>';
      case 'bullet-list':
        return '<ul><li><br></li></ul>';
      case 'numbered-list':
        return '<ol><li><br></li></ol>';
      case 'text':
      default:
        // 'text' modules can stay empty — the browser's default block
        // for a fresh keystroke inside an empty contenteditable is a
        // <div> or text node which the per-tag CSS already styles
        // identically to <p>, and seeding `<p><br></p>` would just
        // create an extra block tag the user can't see.
        return '';
    }
  };

  // Sync external HTML → editor only when the entry's id changes (initial
  // mount / duplicate). We do NOT mirror every keystroke back into the
  // editor's innerHTML — that would clobber the cursor.
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    // Seed an empty editor with the block tag implied by `module.textStyle`
    // so a Heading 1 / Heading 2 / bullet / numbered module starts with
    // its actual block in the DOM. Skipped when `html` already has
    // content (duplicate / restore from saved state).
    const seed = html.trim() === '' ? seedFromTextStyle(textStyle) : html;
    if (el.innerHTML !== seed) {
      el.innerHTML = seed;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.id]);

  // Re-anchor the toolbar to the chrome wrapper.
  const recomputeAnchor = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    setAnchorRect(el.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    recomputeAnchor();
    window.addEventListener('resize', recomputeAnchor);
    window.addEventListener('scroll', recomputeAnchor, true);
    return () => {
      window.removeEventListener('resize', recomputeAnchor);
      window.removeEventListener('scroll', recomputeAnchor, true);
    };
  }, [isFocused, recomputeAnchor]);

  // Track non-collapsed text selections inside this editor. `selectionchange`
  // is the only DOM event that fires reliably for both mouse-drag and
  // keyboard (shift-arrow) selections, so we listen on the document and
  // filter to ranges anchored within `editorRef`. Clicks on the floating
  // toolbar itself are ignored — the toolbar's buttons stop focus-steal on
  // mousedown, but `selectionchange` still fires when the browser
  // reasserts the selection on the editor side; we keep the toolbar up as
  // long as the underlying range is non-collapsed.
  useEffect(() => {
    if (!isEditMode) return;
    const handler = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setHasSelection(false);
        return;
      }
      const range = sel.getRangeAt(0);
      // Selection must be anchored inside this editor — `selectionchange`
      // fires globally, so without this guard a selection in a sibling
      // text element would surface this element's toolbar too.
      const anchored =
        editor.contains(range.startContainer) &&
        editor.contains(range.endContainer);
      const live = anchored && !range.collapsed;

      // Inline-format active state: refresh whenever the selection is
      // anchored inside this editor (collapsed OR not). queryCommandState
      // reflects the format at the caret position even when there's no
      // selection, so a click into already-bold text correctly highlights
      // the Bold button. We bail when the selection lives in a different
      // editor so this instance doesn't mirror a sibling's state.
      if (anchored) {
        refreshActiveInline(range.startContainer);
      }

      if (live) {
        // Snapshot a clone — the live range moves as the user types
        // or the DOM mutates; we want the exact span the user had
        // highlighted at the moment they reached for the toolbar.
        savedRangeRef.current = range.cloneRange();

        // Resolve the BLOCK ancestor of the selection so the dropdown's
        // check indicator points at the active type (H1 / H2 / list /
        // plain text), not at the module-level default. Walk up from
        // the range's start container, stopping at the editor root.
        // The first matching tag wins — list-item wins over its
        // surrounding <ul>/<ol> because <li> is the more specific
        // ancestor, but we still want to report 'bullet-list' /
        // 'numbered-list' for those, so we look at the <li>'s parent.
        let node: Node | null = range.startContainer;
        let resolved: TextStyle = 'text';
        while (node && node !== editor) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = (node as Element).tagName;
            if (tag === 'H1') {
              resolved = 'heading-1';
              break;
            }
            if (tag === 'H2') {
              resolved = 'heading-2';
              break;
            }
            if (tag === 'LI') {
              const list = (node as Element).parentElement;
              if (list?.tagName === 'OL') {
                resolved = 'numbered-list';
              } else {
                resolved = 'bullet-list';
              }
              break;
            }
            if (tag === 'UL') {
              resolved = 'bullet-list';
              break;
            }
            if (tag === 'OL') {
              resolved = 'numbered-list';
              break;
            }
            if (tag === 'P') {
              resolved = 'text';
              break;
            }
          }
          node = node.parentNode;
        }
        setActiveBlockStyle(resolved);
      }
      setHasSelection(live);
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [isEditMode]);

  // ── Auto-size: push intrinsic content height back into the grid layout.
  // The chrome wrapper hugs content (no h-full) so the chrome only paints
  // around the actual typed content — matches the design's tight
  // empty-state box (Figma 1391:381539, 42 px chrome) without dead space
  // beneath when the cell is taller than the text.
  //
  // Two outputs from the observer:
  //   1. `layoutH` — translate the wrapper's pixel height into grid rows
  //      and emit a patch only when the row count changes (per-pixel
  //      ticks would thrash the grid).
  //   2. `--text-chrome-h` — write the wrapper's measured pixel height
  //      onto the parent grid-item as a CSS variable. ReportCanvas's
  //      stylesheet uses it to anchor RGL's resize grip to the chrome's
  //      bottom-right corner (Figma 1393:411104) instead of the grid
  //      cell's bottom-right (which would float 20 px below the chrome
  //      whenever the cell is taller than the wrapper).
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const px = el.offsetHeight;
      const desired = pxToRows(px);
      if (desired !== currentH) {
        onChange({ layoutH: desired });
      }
      const parent = el.parentElement;
      if (parent) {
        parent.style.setProperty('--text-chrome-h', px + 'px');
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [currentH, onChange]);

  // ── ":" suggestion state ────────────────────────────────────────────
  // While typing `:query` the dropdown shows up to 8 matches keyed off
  // emoji-mart's SearchIndex.  `triggerRange` snapshots the position of
  // the leading `:` so we can later select the entire `:query` substring
  // on accept and replace it with the chosen emoji in one undoable step.
  // `anchorRect` is the live caret rect, refreshed on every input so the
  // dropdown follows the caret as the user types.
  const [emojiSuggestion, setEmojiSuggestion] = useState<{
    triggerRange: Range;
    query: string;
    matches: EmojiSuggestion[];
    highlightedIndex: number;
    anchorRect: DOMRect;
  } | null>(null);

  // emoji-mart `init({ data })` populates the SearchIndex used by both
  // the picker AND `searchEmojis` below.  Pulled lazily on the first
  // suggestion query so the data file (~150 KB gzipped) doesn't ship
  // with the main bundle.  Cached via a per-component promise so repeated
  // queries don't kick off a fresh dynamic import.
  const emojiSearchReadyRef = useRef<Promise<void> | null>(null);
  const ensureEmojiSearchReady = useCallback(async () => {
    if (!emojiSearchReadyRef.current) {
      emojiSearchReadyRef.current = (async () => {
        const [{ init }, dataMod] = await Promise.all([
          import('emoji-mart'),
          import('@emoji-mart/data'),
        ]);
        await init({ data: dataMod.default });
      })();
    }
    return emojiSearchReadyRef.current;
  }, []);

  // Resolve up to 8 emoji matches for `query` via emoji-mart's
  // SearchIndex.  The SearchIndex returns native characters + ids; we
  // shape them into the suggestion-row format the dropdown expects.
  const searchEmojis = useCallback(
    async (query: string): Promise<EmojiSuggestion[]> => {
      await ensureEmojiSearchReady();
      const { SearchIndex } = await import('emoji-mart');
      // SearchIndex.search has a loose `any`-typed signature; cast to a
      // narrow shape so the result mapping below is type-safe.
      const search = SearchIndex.search as unknown as (
        q: string,
        opts?: { maxResults?: number },
      ) => Promise<
        Array<{ id: string; name: string; skins: Array<{ native: string }> }>
      >;
      const results = await search(query, { maxResults: 8 });
      if (!results) return [];
      return results.map((e) => ({
        id: e.id,
        native: e.skins?.[0]?.native ?? '',
        name: e.name,
      }));
    },
    [ensureEmojiSearchReady],
  );

  // Insert a literal emoji string at the editor's current selection.
  // Single source of truth for ALL emoji insertions (toolbar pick,
  // suggestion accept) so undo and selection-replacement semantics stay
  // identical across paths.
  //
  //   1. Re-install the saved selection (if the picker / suggestion
  //      collapsed it).
  //   2. Snapshot the editor for our snapshot-based undo stack.
  //   3. `execCommand('insertText', false, native)` — replaces the
  //      selection with the emoji as plain text and lands the action
  //      on the browser's native undo stack too.
  //   4. Fire onChange so the parent state catches up.
  //   5. Refresh the toolbar's active-inline flags (in case the
  //      insertion landed inside an existing <a> / bold span etc.).
  const insertEmojiAtSelection = useCallback(
    (native: string, replacementRange?: Range) => {
      const el = editorRef.current;
      if (!el) return;
      pushUndoSnapshot();
      lastInputSnapshotRef.current = 0;
      el.focus({ preventScroll: true });
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        if (replacementRange) {
          sel.addRange(replacementRange);
        } else if (savedRangeRef.current) {
          sel.addRange(savedRangeRef.current);
        }
      }
      document.execCommand('insertText', false, native);
      onChange({ html: el.innerHTML });
      refreshActiveInline();
    },
    [onChange, pushUndoSnapshot, refreshActiveInline],
  );

  // Replace the `:query` substring with the chosen emoji.  Build a Range
  // from the trigger `:` start to the current caret end; that becomes the
  // selection that `execCommand('insertText')` will overwrite.
  const acceptEmojiSuggestion = useCallback(
    (index: number) => {
      setEmojiSuggestion((prev) => {
        if (!prev) return null;
        const m = prev.matches[index];
        if (!m || !m.native) return prev;
        const editor = editorRef.current;
        if (!editor) return prev;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return prev;
        const live = sel.getRangeAt(0);
        if (
          !editor.contains(prev.triggerRange.startContainer) ||
          !editor.contains(live.endContainer)
        ) {
          return null;
        }
        const replacement = document.createRange();
        replacement.setStart(
          prev.triggerRange.startContainer,
          prev.triggerRange.startOffset,
        );
        replacement.setEnd(live.endContainer, live.endOffset);
        insertEmojiAtSelection(m.native, replacement);
        return null;
      });
    },
    [insertEmojiAtSelection],
  );

  // ":" suggestion — driven from input events.  Re-evaluated on every
  // keystroke so the dropdown's query, match list, and anchor rect stay
  // synced with the caret.  Three branches:
  //
  //   1. Selection is non-collapsed → not in suggestion mode; close
  //      any open suggestion.
  //
  //   2. Suggestion is currently open → recompute the query as the text
  //      between the trigger `:` and the caret.  Close on whitespace,
  //      newline, length > 32, or if the trigger range got orphaned by
  //      a DOM mutation.  Otherwise refresh matches and anchor.
  //
  //   3. Suggestion is closed → open it ONLY when the character
  //      immediately before the caret is `:` AND the char before that
  //      is start-of-block, whitespace, or punctuation.  This keeps
  //      `https://`, `12:30`, ratios, etc. from triggering.
  //
  // searchEmojis is async (lazy import of the data file); we keep the
  // current query under prev?.query so a stale async result from a
  // previous keystroke doesn't overwrite the latest matches.
  const evaluateEmojiSuggestion = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.startContainer)) return;
    if (!range.collapsed) {
      setEmojiSuggestion((prev) => (prev ? null : prev));
      return;
    }

    if (emojiSuggestion) {
      const trigger = emojiSuggestion.triggerRange;
      if (!editor.contains(trigger.startContainer)) {
        setEmojiSuggestion(null);
        return;
      }
      let queryText: string;
      try {
        const r = document.createRange();
        r.setStart(trigger.startContainer, trigger.startOffset + 1);
        r.setEnd(range.endContainer, range.endOffset);
        queryText = r.toString();
      } catch {
        setEmojiSuggestion(null);
        return;
      }
      if (/[\s]/.test(queryText) || queryText.length > 32) {
        setEmojiSuggestion(null);
        return;
      }
      const caretRect = range.getBoundingClientRect();
      const nextRect =
        caretRect.width > 0 || caretRect.height > 0
          ? caretRect
          : emojiSuggestion.anchorRect;
      setEmojiSuggestion({
        ...emojiSuggestion,
        query: queryText,
        anchorRect: nextRect,
      });
      searchEmojis(queryText).then((matches) => {
        setEmojiSuggestion((prev) => {
          if (!prev || prev.query !== queryText) return prev;
          return { ...prev, matches, highlightedIndex: 0 };
        });
      });
      return;
    }

    // Detect a new trigger.
    const startContainer = range.startContainer;
    if (startContainer.nodeType !== Node.TEXT_NODE) return;
    const text = startContainer.textContent ?? '';
    const offset = range.startOffset;
    if (offset === 0 || text.charAt(offset - 1) !== ':') return;
    if (offset >= 2 && !/[\s\p{P}]/u.test(text.charAt(offset - 2))) return;

    const triggerRange = document.createRange();
    triggerRange.setStart(startContainer, offset - 1);
    triggerRange.setEnd(startContainer, offset);
    const caretRect = range.getBoundingClientRect();
    const triggerRect = triggerRange.getBoundingClientRect();
    const anchorRect =
      caretRect.width > 0 || caretRect.height > 0 ? caretRect : triggerRect;

    setEmojiSuggestion({
      triggerRange,
      query: '',
      matches: [],
      highlightedIndex: 0,
      anchorRect,
    });
    searchEmojis('').then((matches) => {
      setEmojiSuggestion((prev) => {
        if (!prev || prev.query !== '') return prev;
        return { ...prev, matches, highlightedIndex: 0 };
      });
    });
  }, [emojiSuggestion, searchEmojis]);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    onChange({ html: el.innerHTML });
    evaluateEmojiSuggestion();
  }, [onChange, evaluateEmojiSuggestion]);

  // Snapshot the editor state at the START of a typing burst so Ctrl+Z
  // pops the user back to "before they started typing this run", not
  // character-by-character. We rely on `beforeinput` (which fires
  // BEFORE the DOM mutates) so the captured HTML is the pre-keystroke
  // state. A 750 ms quiet window gates the snapshot — sustained typing
  // shares one undo entry; pausing and resuming creates a fresh boundary.
  // Intercepted toolbar operations reset `lastInputSnapshotRef` to 0
  // (see pushUndoSnapshot callers) so post-conversion typing always
  // starts a new burst rather than rolling into the conversion's group.
  const handleBeforeInput = useCallback(() => {
    const now = Date.now();
    if (now - lastInputSnapshotRef.current > INPUT_SNAPSHOT_QUIET_MS) {
      pushUndoSnapshot();
    }
    lastInputSnapshotRef.current = now;
  }, [pushUndoSnapshot]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && toolbarRef.current && toolbarRef.current.contains(next)) {
      return;
    }
    setIsFocused(false);
  }, []);

  // Enter-key handler — implements Google-Docs / Slack / Notion list
  // behavior:
  //
  //   • Enter inside a non-empty <li>     → fall through to the browser
  //     default, which splits the LI at the caret. This handles both
  //     "Enter at end" (new bullet below) and "Enter mid-text" (split
  //     into two list items) — exactly what we want, and the browser
  //     gets the caret placement / number renumbering correct for free.
  //
  //   • Enter inside an EMPTY <li>        → exit the list. We drop the
  //     empty item, splice a fresh <p> in its place, and move the caret
  //     into it. Without this, the browser's default keeps inserting
  //     additional empty <li>s on every Enter, producing the infinite
  //     empty-bullet trap that Docs/Slack/Notion explicitly avoid.
  //
  //   • Shift+Enter                       → always falls through (soft
  //     line break with <br>, regardless of context).
  //
  // We deliberately avoid catching Enter outside lists — the browser
  // already paragraph-splits correctly inside <p>/<h1>/<h2> blocks.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // ── ":" suggestion navigation ───────────────────────────────
      // When the suggestion dropdown is visible, hijack the cursor /
      // accept / cancel keys.  All other keys (letters, digits,
      // backspace, etc.) fall through to the editor so the user can
      // continue typing the query.  Caret-moving keys (ArrowLeft /
      // ArrowRight / Home / End) close the suggestion — moving the
      // caret out of `:query` invalidates the trigger position.
      if (emojiSuggestion) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setEmojiSuggestion((prev) => {
            if (!prev || prev.matches.length === 0) return prev;
            return {
              ...prev,
              highlightedIndex: (prev.highlightedIndex + 1) % prev.matches.length,
            };
          });
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setEmojiSuggestion((prev) => {
            if (!prev || prev.matches.length === 0) return prev;
            return {
              ...prev,
              highlightedIndex:
                (prev.highlightedIndex - 1 + prev.matches.length) %
                prev.matches.length,
            };
          });
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          if (emojiSuggestion.matches.length > 0) {
            e.preventDefault();
            acceptEmojiSuggestion(emojiSuggestion.highlightedIndex);
            return;
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setEmojiSuggestion(null);
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
          setEmojiSuggestion(null);
          // Don't preventDefault — let the caret actually move.
        }
      }

      // ── Undo / redo shortcuts ────────────────────────────────────
      // We own the entire undo stack for this editor (see
      // `pushUndoSnapshot` block above), so we intercept the standard
      // shortcuts and route them to our snapshot stack rather than
      // letting the browser walk its native history — the native stack
      // misses our manual DOM mutations and would otherwise undo past
      // them silently.
      //   • Ctrl/Cmd + Z          → undo
      //   • Ctrl/Cmd + Shift + Z  → redo (Mac convention)
      //   • Ctrl + Y              → redo (Windows convention)
      // Alt is excluded so OS-level shortcuts like Cmd+Alt+Z don't get
      // swallowed.
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault();
          performUndo();
          return;
        }
        if ((k === 'z' && e.shiftKey) || k === 'y') {
          e.preventDefault();
          performRedo();
          return;
        }
      }

      if (e.key !== 'Enter' || e.shiftKey) return;
      const editor = editorRef.current;
      if (!editor) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.startContainer)) return;
      // Only handle collapsed carets — Enter on a non-collapsed
      // selection (range covers text) means "replace the selection
      // with a newline", which is the browser default's responsibility
      // and crosses LI boundaries we shouldn't try to mend.
      if (!range.collapsed) return;

      const li = findAncestor(range.startContainer, editor, new Set(['LI']));
      if (!li) return;
      if (!isLiEmpty(li)) return;

      // Empty LI + plain Enter → exit the list.
      e.preventDefault();

      // Manual DOM mutation — record an undo snapshot first and reset
      // the typing-burst timer so the next keystroke after the exit
      // starts a fresh group.
      pushUndoSnapshot();
      lastInputSnapshotRef.current = 0;

      const p = document.createElement('p');
      // Empty <p> needs a placeholder <br> so the caret has somewhere
      // to render and the block has visible height. Browsers strip
      // trailing <br>s automatically once the user types.
      p.appendChild(document.createElement('br'));
      splitListAroundLi(li, p);

      const r = document.createRange();
      r.setStart(p, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      savedRangeRef.current = r.cloneRange();

      onChange({ html: editor.innerHTML });
    },
    [onChange, performUndo, performRedo, pushUndoSnapshot, emojiSuggestion, acceptEmojiSuggestion],
  );

  // Re-install the snapshot range from `savedRangeRef` as the live
  // selection. Called right before any execCommand the toolbar issues
  // so block-level commands (formatBlock) and inline commands (bold,
  // italic, …) always act on exactly the span the user highlighted —
  // never on a collapsed caret position which formatBlock would
  // expand to the entire current block.
  const restoreSavedSelection = useCallback((): boolean => {
    const range = savedRangeRef.current;
    const editor = editorRef.current;
    if (!range || !editor) return false;
    // Re-validate: the range may have been invalidated by an earlier
    // DOM mutation (e.g. typing). If its endpoints aren't in the
    // editor anymore, fall back to whatever the browser thinks the
    // selection is.
    if (
      !editor.contains(range.startContainer) ||
      !editor.contains(range.endContainer)
    ) {
      return false;
    }
    const sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  }, []);

  // Block-tag set used to detect the *block ancestor* of the selection.
  // Only these tags own a "block style" the dropdown can switch between;
  // anything else (span, b, i, em, …) is inline and we keep walking up.
  const BLOCK_TAGS = new Set(['H1', 'H2', 'P', 'LI', 'UL', 'OL', 'DIV']);

  const applyTextStyle = useCallback(
    (next: TextStyle) => {
      const el = editorRef.current;
      if (!el) return;

      // Snapshot BEFORE the manual DOM mutation so Ctrl+Z restores
      // the pre-conversion editor state. Direct innerHTML mutations
      // bypass the browser's native undo stack, so without this
      // snapshot pressing Ctrl+Z after "convert paragraph to H1"
      // would skip the conversion and undo whatever change preceded
      // it. Reset the typing-burst timer so any keystroke right
      // after the conversion starts a fresh undo group.
      pushUndoSnapshot();
      lastInputSnapshotRef.current = 0;

      // Re-install the saved range first so the editor is in the same
      // state it was when the user reached for the toolbar — focus
      // afterwards if needed (focus() can collapse a pending selection
      // in some browsers, but a no-op when the editor is already
      // focused). execCommand('formatBlock') is unreliable for
      // converting between block types (notably H1 → H2 in Chromium),
      // so we do the DOM swap manually below — but we still want the
      // selection live in case the user chains another command later.
      restoreSavedSelection();
      if (document.activeElement !== el) {
        el.focus({ preventScroll: true });
        restoreSavedSelection();
      }

      // If we don't have a saved range, fall back to whatever the
      // browser thinks the live selection is — that covers the
      // "place caret, click style" path where there was never a
      // non-collapsed selection to snapshot. We further fall back to
      // selecting the nearest block ancestor of the caret so the
      // command still has something to act on (Notion behavior:
      // clicking H1 with the cursor in a paragraph converts the
      // paragraph). Final fallback: select the entire editor.
      let range = savedRangeRef.current;
      if (!range || !el.contains(range.startContainer) || !el.contains(range.endContainer)) {
        const live = window.getSelection();
        if (live && live.rangeCount > 0) {
          const r = live.getRangeAt(0);
          if (el.contains(r.startContainer) && el.contains(r.endContainer)) {
            range = r;
          }
        }
      }
      if (!range) {
        // No selection at all — operate on the entire editor contents.
        range = document.createRange();
        range.selectNodeContents(el);
      }

      // Walk up from the range's start container to the editor root,
      // looking for the nearest block ancestor we can replace. If the
      // user's selection lives in bare text directly under the editor,
      // there is no block ancestor and we wrap the range instead.
      let blockAncestor: HTMLElement | null = null;
      let node: Node | null = range.startContainer;
      while (node && node !== el) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = (node as Element).tagName;
          if (BLOCK_TAGS.has(tag)) {
            blockAncestor = node as HTMLElement;
            break;
          }
        }
        node = node.parentNode;
      }

      // ── PRE-COMPUTE selected blocks (used both by the multi-block
      // detector and as a fallback for the block-ancestor walk).
      // Collect every "leaf block" the range touches.  A leaf block is
      // either an editor-level child (P/H1/H2/DIV) or a list item (LI),
      // because formatting-wise an LI is its own line just like a P.
      // For each editor-level UL/OL, we DESCEND and push the LIs the
      // range actually intersects — that lets a drag-selection across
      // 2+ LIs in a single <ul> trigger the multi-block path even when
      // the wrapping <ul> is the editor's only direct child.  Without
      // this descent, `selectedBlocks` would be `[ul]` (length 1), the
      // multi-block path wouldn't fire, and only the LI containing
      // `range.startContainer` would be reformatted — which is exactly
      // the user-reported bug.
      //
      // Caret-only selections (range fully inside one LI) still produce
      // `selectedBlocks = [oneLi]` → single-block path → CASE 1 (LI
      // ancestor) handles it correctly with `splitListAroundLi`.
      //
      // STRICT OVERLAP CHECK: `range.intersectsNode(node)` returns true
      // even when the range only TOUCHES the node at a boundary point —
      // notably when the user selects all of block A and the browser
      // sets the range's end at `(editor, indexOf(B))`, which is the
      // same DOM position as B's start.  Treating B as selected then
      // pulls it into the multi-block path and reformats it too — the
      // exact "selecting top block also converts the block below it"
      // bug.  We post-filter with `compareBoundaryPoints` to require
      // that the range strictly INTERIOR-overlaps the node (i.e. the
      // range neither ends at the node's start nor starts at the
      // node's end).  When the range only touches a boundary, the
      // matching `compareBoundaryPoints` call returns 0.
      const overlapsStrictly = (r: Range, node: Node): boolean => {
        if (!r.intersectsNode(node)) return false;
        const nr = document.createRange();
        nr.selectNodeContents(node);
        // r.end == nr.start  →  range ends exactly at node's start (no
        // interior overlap — only the boundary point coincides).
        if (r.compareBoundaryPoints(Range.START_TO_END, nr) === 0) {
          return false;
        }
        // r.start == nr.end  →  range starts exactly at node's end.
        if (r.compareBoundaryPoints(Range.END_TO_START, nr) === 0) {
          return false;
        }
        return true;
      };

      const selectedBlocks: HTMLElement[] = [];
      for (const child of Array.from(el.children)) {
        if (!overlapsStrictly(range, child)) continue;
        const tag = child.tagName;
        if (tag === 'UL' || tag === 'OL') {
          const lis = Array.from(child.children).filter((li) =>
            overlapsStrictly(range, li),
          );
          if (lis.length > 0) {
            for (const li of lis) selectedBlocks.push(li as HTMLElement);
            continue;
          }
        }
        selectedBlocks.push(child as HTMLElement);
      }
      const isMultiBlock = selectedBlocks.length > 1;

      // Fallback: when the range's start container IS the editor (the
      // walk above immediately exits without finding a block), but we
      // have exactly ONE selected block, treat it as the ancestor so
      // the single-block path takes the correct CASE 1/2/3 branch
      // instead of CASE 4 (which wraps `range.extractContents()` and
      // produces a double-nested `<h1><p>…</p></h1>` for "select all
      // on a single-paragraph editor").
      if (!blockAncestor && selectedBlocks.length === 1) {
        blockAncestor = selectedBlocks[0];
      }

      // Map the requested style to the target tag. Lists are handled
      // separately because they need a wrapping <ul>/<ol> and an inner
      // <li>, while H1/H2/P swap the block element directly.
      const isList = next === 'bullet-list' || next === 'numbered-list';
      const listTag: 'ul' | 'ol' | null =
        next === 'bullet-list' ? 'ul' : next === 'numbered-list' ? 'ol' : null;
      const blockTag: 'h1' | 'h2' | 'p' | null =
        next === 'heading-1'
          ? 'h1'
          : next === 'heading-2'
            ? 'h2'
            : next === 'text'
              ? 'p'
              : null;

      const sel = window.getSelection();

      // Helper: re-install a fresh selection over `target`'s contents
      // and snapshot it as the saved range so subsequent formatting
      // commands act on the new block.
      const reselect = (target: Element) => {
        if (!sel) return;
        sel.removeAllRanges();
        const r = document.createRange();
        r.selectNodeContents(target);
        sel.addRange(r);
        savedRangeRef.current = r.cloneRange();
      };

      // Helper: place `replacement` (one node or a fragment of nodes)
      // at the document position of the FIRST selected block, removing
      // the rest of the selected blocks in document order.  When the
      // selected blocks are LIs that share a parent <ul>/<ol>, we
      // SPLIT the list around the contiguous run of selected LIs —
      // before-LIs stay in the original wrapper, the replacement goes
      // between, and after-LIs get re-parented into a new same-kind
      // wrapper inserted right after.  This is the structural rule
      // that lets a "select last 2 of 3 LIs → Numbered list" produce
      // `<ul>[A]</ul><ol>[B,C]</ol>` rather than the wrong-order
      // `<ol>[B,C]</ol><ul>[A]</ul>` that a naive insert-before would
      // give.
      //
      //   replaceBlocks([P], NEW)                  → NEW  (P removed)
      //   replaceBlocks([P1, P2, P3], NEW)         → NEW  (all P's gone)
      //   replaceBlocks([li2, li3], NEW)           in `<ul>[1,2,3]</ul>`
      //                                             → `<ul>[1]</ul> NEW`
      //   replaceBlocks([li1, li2], NEW)           in `<ul>[1,2,3]</ul>`
      //                                             → `NEW <ul>[3]</ul>`
      //   replaceBlocks([li2], NEW)                in `<ul>[1,2,3]</ul>`
      //                                             → `<ul>[1]</ul> NEW <ul>[3]</ul>`
      const replaceBlocks = (blocks: HTMLElement[], replacement: Node) => {
        if (blocks.length === 0) return;

        // Group selected LIs by their parent list so we can split
        // each affected list once.  Non-LI blocks aren't bucketed —
        // they get removed at the end.
        const liByParent = new Map<HTMLElement, HTMLElement[]>();
        for (const b of blocks) {
          if (b.tagName === 'LI' && b.parentElement) {
            const list = b.parentElement;
            const arr = liByParent.get(list);
            if (arr) arr.push(b);
            else liByParent.set(list, [b]);
          }
        }

        // ─── Phase 1: SNAPSHOT insertion targets ─────────────────
        // Read every parent/sibling reference we'll need BEFORE
        // touching the DOM.  After we start detaching LIs the
        // `.parentElement` / `.nextSibling` of the first selected
        // block can both go null, leaving the replacement unanchored
        // — that's exactly the bug we're fixing here.
        const first = blocks[0];
        let insertParent: Node | null;
        let insertRef: Node | null;
        if (first.tagName === 'LI' && first.parentElement) {
          const list = first.parentElement;
          insertParent = list.parentNode;
          const selectedInList = liByParent.get(list) ?? [];
          const allLisSelected =
            selectedInList.length === list.children.length;
          // All LIs of the parent list got selected → the wrapper
          // will end up empty and we'll drop it; the replacement
          // takes its place.  Otherwise the wrapper keeps its
          // before-LIs and the replacement slots in right after it.
          insertRef = allLisSelected ? list : list.nextSibling;
        } else {
          insertParent = first.parentNode;
          insertRef = first;
        }

        // ─── Phase 2: build after-lists for each affected list ───
        // The LIs after the last selected one in each list become a
        // fresh same-kind wrapper.  Build them now (which detaches
        // those LIs from the original) but DON'T insert into the
        // DOM until phase 3 — we want strict ordering control.
        const afterLists: HTMLElement[] = [];
        for (const [list, lis] of liByParent.entries()) {
          const allChildren = Array.from(list.children);
          const lastIdx = allChildren.indexOf(lis[lis.length - 1]);
          const afterLis = allChildren.slice(lastIdx + 1);
          if (afterLis.length > 0) {
            const afterList = document.createElement(
              list.tagName.toLowerCase(),
            );
            for (const li of afterLis) afterList.appendChild(li);
            afterLists.push(afterList);
          }
        }

        // ─── Phase 3: insert in document order ───────────────────
        // Replacement first, then each after-list immediately after
        // (chained so they stay in the order their source lists
        // appeared).  Using the snapshotted insertParent/insertRef
        // means we don't depend on still-attached state of `first`.
        //
        // Subtlety: when `replacement` is a DocumentFragment it loses
        // all its children to the DOM the moment we insert it, so
        // `replacement.nextSibling` would be `null`.  Capture the
        // fragment's pre-insertion lastChild so we can chain after-
        // lists to the correct anchor in the live DOM.
        if (insertParent) {
          const isFrag =
            replacement.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
          const fragTail = isFrag ? replacement.lastChild : null;
          insertParent.insertBefore(replacement, insertRef);
          let prev: Node | null = isFrag ? fragTail : replacement;
          for (const al of afterLists) {
            const p = prev?.parentNode ?? insertParent;
            const ref = prev ? prev.nextSibling : insertRef;
            p.insertBefore(al, ref);
            prev = al;
          }
        }

        // ─── Phase 4: detach the selected LIs ────────────────────
        for (const [, lis] of liByParent.entries()) {
          for (const li of lis) li.remove();
        }
        // Non-LI selected blocks (P/H1/H2 at editor level) get
        // removed here too; we couldn't do it in phase 1 because
        // `first` may have been one of them and we needed it to
        // resolve insertRef.
        for (const b of blocks) {
          if (b.tagName !== 'LI' && b.parentNode) {
            b.remove();
          }
        }

        // ─── Phase 5: sweep empty list shells ────────────────────
        for (const list of liByParent.keys()) {
          if (list.children.length === 0) list.remove();
        }
      };

      try {
        // ── List target ────────────────────────────────────────────
        if (isList && listTag) {
          // ── MULTI-BLOCK PATH ────────────────────────────────────
          // Selection spans 2+ top-level blocks of the editor.  Build
          // ONE new list and append a new <li> for every line of
          // content the user selected — paragraphs become single LIs,
          // existing list items get re-parented (lists flatten into
          // the new list so a UL-then-paragraph selection normalizes
          // into one consistent UL/OL).  This is the Google-Docs /
          // Slack / Notion behavior: every selected line becomes its
          // own list item, never just the first one.
          if (isMultiBlock) {
            // Toggle-off: every selected block is already in a list of
            // the SAME kind we're applying.  Treat the click as
            // "unwrap everything" — each <li> becomes a <p> in place
            // of the original lists.  Without this branch, clicking
            // "Bullet list" again on an already-bulleted multi-line
            // selection would no-op visually but rebuild the DOM.
            //
            // For a flattened list (selectedBlocks contains LIs), the
            // "kind" is the LI's parent.  For non-flattened lists,
            // the block itself is the wrapper.
            const allSameKindLists = selectedBlocks.every((b) => {
              if (b.tagName === 'LI') {
                return b.parentElement?.tagName.toLowerCase() === listTag;
              }
              if (b.tagName === 'UL' || b.tagName === 'OL') {
                return b.tagName.toLowerCase() === listTag;
              }
              return false;
            });
            if (allSameKindLists) {
              const frag = document.createDocumentFragment();
              for (const block of selectedBlocks) {
                if (block.tagName === 'LI') {
                  const p = document.createElement('p');
                  while (block.firstChild) p.appendChild(block.firstChild);
                  if (!p.firstChild) p.appendChild(document.createElement('br'));
                  frag.appendChild(p);
                } else {
                  // UL/OL wrapper — flatten its LIs to <p>s.
                  for (const li of Array.from(block.children)) {
                    const p = document.createElement('p');
                    while (li.firstChild) p.appendChild(li.firstChild);
                    if (!p.firstChild) p.appendChild(document.createElement('br'));
                    frag.appendChild(p);
                  }
                }
              }
              const firstP = frag.firstChild as Element | null;
              replaceBlocks(selectedBlocks, frag);
              if (firstP && sel) {
                sel.removeAllRanges();
                const r = document.createRange();
                r.setStart(firstP, 0);
                r.collapse(true);
                sel.addRange(r);
                savedRangeRef.current = r.cloneRange();
              }
            } else {
              // Normalize path: build a single new list and append one
              // <li> per line of selected content.  Existing lists in
              // the selection are FLATTENED — their LIs are moved into
              // the new list (even if they were the OTHER list type),
              // so a mixed UL+paragraph+OL selection collapses into
              // one clean list of the requested type.
              const newList = document.createElement(listTag);
              for (const block of selectedBlocks) {
                if (block.tagName === 'UL' || block.tagName === 'OL') {
                  for (const oldLi of Array.from(block.children)) {
                    const newLi = document.createElement('li');
                    while (oldLi.firstChild) newLi.appendChild(oldLi.firstChild);
                    newList.appendChild(newLi);
                  }
                } else if (block.tagName === 'LI') {
                  const newLi = document.createElement('li');
                  while (block.firstChild) newLi.appendChild(block.firstChild);
                  newList.appendChild(newLi);
                } else {
                  const newLi = document.createElement('li');
                  while (block.firstChild) newLi.appendChild(block.firstChild);
                  // Preserve empty paragraphs as empty <li> — keeps
                  // line-count parity with what the user selected.
                  newList.appendChild(newLi);
                }
              }
              replaceBlocks(selectedBlocks, newList);
              // Reselect the entire new list so the user can chain
              // another command (e.g. immediately re-toggle, or apply
              // bold to all the new items).
              if (sel) {
                sel.removeAllRanges();
                const r = document.createRange();
                r.selectNodeContents(newList);
                sel.addRange(r);
                savedRangeRef.current = r.cloneRange();
              }
            }
          }
          // ── SINGLE-BLOCK PATH (original logic) ──────────────────
          // CASE 1: selection is inside a single <li>. Convert ONLY
          // that item, splitting the surrounding list so unselected
          // siblings stay put. Do NOT redirect blockAncestor up to
          // the parent list — that's what was deleting the other
          // items.
          else if (blockAncestor && blockAncestor.tagName === 'LI') {
            const li = blockAncestor;
            const parentList = li.parentElement;
            const sameKind =
              parentList && parentList.tagName.toLowerCase() === listTag;

            if (sameKind) {
              // Toggling the same list type — unwrap just this item
              // to a paragraph. Other items remain in the original
              // list (split around the target).
              const p = document.createElement('p');
              while (li.firstChild) p.appendChild(li.firstChild);
              splitListAroundLi(li, p);
              reselect(p);
            } else {
              // Switching list type for this single item only.
              // Build a 1-item list of the new kind and splice it in.
              const newList = document.createElement(listTag);
              const newLi = document.createElement('li');
              while (li.firstChild) newLi.appendChild(li.firstChild);
              newList.appendChild(newLi);
              splitListAroundLi(li, newList);
              reselect(newLi);
            }
          }
          // CASE 2: blockAncestor IS the list itself (selection
          // straddles multiple items, or wraps the whole list).
          // Whole-list semantics are appropriate here.
          else if (
            blockAncestor &&
            (blockAncestor.tagName === 'UL' || blockAncestor.tagName === 'OL')
          ) {
            if (blockAncestor.tagName.toLowerCase() === listTag) {
              // Unwrap the entire list back to paragraphs.
              const frag = document.createDocumentFragment();
              for (const li of Array.from(blockAncestor.children)) {
                const p = document.createElement('p');
                while (li.firstChild) p.appendChild(li.firstChild);
                frag.appendChild(p);
              }
              const firstP = frag.firstChild as Element | null;
              blockAncestor.parentNode?.replaceChild(frag, blockAncestor);
              if (firstP) reselect(firstP);
            } else {
              const newList = document.createElement(listTag);
              while (blockAncestor.firstChild) {
                newList.appendChild(blockAncestor.firstChild);
              }
              blockAncestor.parentNode?.replaceChild(newList, blockAncestor);
              const firstLi = newList.querySelector('li');
              if (firstLi) reselect(firstLi);
            }
          }
          // CASE 3: a non-list block (H1/H2/P/DIV) → 1-item list.
          else if (blockAncestor) {
            const list = document.createElement(listTag);
            const li = document.createElement('li');
            while (blockAncestor.firstChild) li.appendChild(blockAncestor.firstChild);
            list.appendChild(li);
            blockAncestor.parentNode?.replaceChild(list, blockAncestor);
            reselect(li);
          }
          // CASE 4: no block ancestor — wrap the live range.
          else {
            const list = document.createElement(listTag);
            const li = document.createElement('li');
            li.appendChild(range.extractContents());
            list.appendChild(li);
            range.insertNode(list);
            reselect(li);
          }
        }

        // ── Block-tag target (H1 / H2 / P) ─────────────────────────
        else if (blockTag) {
          // ── MULTI-BLOCK PATH ────────────────────────────────────
          // Same symmetry as the list branch: every selected line
          // becomes its own block of the target tag.  Lists in the
          // selection flatten — each <li> becomes a separate H1/H2/P
          // block.  Without this, clicking H1 with three paragraphs
          // selected would only convert the first one.
          if (isMultiBlock) {
            const frag = document.createDocumentFragment();
            for (const block of selectedBlocks) {
              if (block.tagName === 'UL' || block.tagName === 'OL') {
                for (const li of Array.from(block.children)) {
                  const newEl = document.createElement(blockTag);
                  while (li.firstChild) newEl.appendChild(li.firstChild);
                  if (!newEl.firstChild) newEl.appendChild(document.createElement('br'));
                  frag.appendChild(newEl);
                }
              } else if (block.tagName === 'LI') {
                const newEl = document.createElement(blockTag);
                while (block.firstChild) newEl.appendChild(block.firstChild);
                if (!newEl.firstChild) newEl.appendChild(document.createElement('br'));
                frag.appendChild(newEl);
              } else {
                const newEl = document.createElement(blockTag);
                while (block.firstChild) newEl.appendChild(block.firstChild);
                if (!newEl.firstChild) newEl.appendChild(document.createElement('br'));
                frag.appendChild(newEl);
              }
            }
            const firstNew = frag.firstChild as Element | null;
            const lastNew = frag.lastChild as Element | null;
            replaceBlocks(selectedBlocks, frag);
            if (firstNew && lastNew && sel) {
              sel.removeAllRanges();
              const r = document.createRange();
              r.setStart(firstNew, 0);
              r.setEnd(lastNew, lastNew.childNodes.length);
              sel.addRange(r);
              savedRangeRef.current = r.cloneRange();
            }
          }
          // ── SINGLE-BLOCK PATH (original logic) ──────────────────
          // CASE 1: selection inside a single <li> — convert ONLY
          // that item to the new block tag, splitting the list
          // around it so the other items stay intact. Critical bug
          // fix: we used to redirect the target to the surrounding
          // <ul>/<ol> and then take only the FIRST <li>'s contents,
          // dropping every other item.
          else if (blockAncestor && blockAncestor.tagName === 'LI') {
            const li = blockAncestor;
            const newEl = document.createElement(blockTag);
            while (li.firstChild) newEl.appendChild(li.firstChild);
            splitListAroundLi(li, newEl);
            reselect(newEl);
          }
          // CASE 2: blockAncestor is the list itself — replace the
          // whole list with a single block of the requested tag.
          else if (
            blockAncestor &&
            (blockAncestor.tagName === 'UL' || blockAncestor.tagName === 'OL')
          ) {
            const newEl = document.createElement(blockTag);
            const firstLi = blockAncestor.querySelector('li');
            if (firstLi) {
              while (firstLi.firstChild) newEl.appendChild(firstLi.firstChild);
            }
            blockAncestor.parentNode?.replaceChild(newEl, blockAncestor);
            reselect(newEl);
          }
          // CASE 3: regular block (H1/H2/P/DIV) — swap its tag.
          else if (blockAncestor) {
            const newEl = document.createElement(blockTag);
            while (blockAncestor.firstChild) newEl.appendChild(blockAncestor.firstChild);
            blockAncestor.parentNode?.replaceChild(newEl, blockAncestor);
            reselect(newEl);
          }
          // CASE 4: no block ancestor — wrap the live range.
          else {
            const wrapper = document.createElement(blockTag);
            wrapper.appendChild(range.extractContents());
            range.insertNode(wrapper);
            reselect(wrapper);
          }
        }
      } catch {
        /* DOM swap failed — leave the editor untouched, user can retry */
      }

      onChange({ html: el.innerHTML });
    },
    [onChange, restoreSavedSelection, pushUndoSnapshot],
  );

  const applyInline = useCallback(
    (cmd: 'bold' | 'italic' | 'underline') => {
      const el = editorRef.current;
      if (!el) return;
      // Snapshot BEFORE applying the inline command so Ctrl+Z routes
      // through our stack and stays consistent with block-style undo.
      // execCommand DOES record on the browser's native stack, but
      // mixing the two histories surfaces as Ctrl+Z alternating between
      // them — owning the entire stack here keeps behavior coherent.
      pushUndoSnapshot();
      lastInputSnapshotRef.current = 0;
      el.focus();
      restoreSavedSelection();
      document.execCommand(cmd);
      onChange({ html: el.innerHTML });
      // Synchronously refresh the toolbar's active flags — see comment
      // on `refreshActiveInline`. Without this, the Bold button stays
      // un-tinted until the next caret movement on Chromium because
      // execCommand doesn't always fire selectionchange.
      refreshActiveInline();
    },
    [onChange, restoreSavedSelection, refreshActiveInline, pushUndoSnapshot],
  );

  // ── Link popover state ──────────────────────────────────────────────
  // Non-null while the inline link popover is open. The Toolbar gates
  // its render on this object, and `showToolbar` below also keeps the
  // toolbar mounted while the popover is open (otherwise focusing the
  // URL input would collapse the editor's selection, drop hasSelection,
  // and instantly close the toolbar — and the popover with it).
  const [linkContext, setLinkContext] = useState<LinkContext | null>(null);
  // Stable snapshot of the range the link should apply to. We can't
  // reuse `savedRangeRef` directly because the user typing in the URL
  // input fires `selectionchange` events that would clobber the
  // editor's saved range with the input's collapsed selection.
  const linkRangeRef = useRef<Range | null>(null);

  // Open the link popover. Captures the selection once so subsequent
  // focus-loss events don't lose it; if the caret is parked inside an
  // existing <a>, expands the range to wrap the whole anchor and
  // pre-fills the input with the current href.
  const openLinkPopover = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Prefer the snapshot of the user's most recent non-collapsed
    // selection (which is what the toolbar's visibility was gated on);
    // fall back to the live selection so we still work in the
    // "caret inside link" case where there's no highlighted text.
    let range: Range | null = null;
    const saved = savedRangeRef.current;
    if (
      saved &&
      editor.contains(saved.startContainer) &&
      editor.contains(saved.endContainer)
    ) {
      range = saved.cloneRange();
    } else {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        if (
          editor.contains(r.startContainer) &&
          editor.contains(r.endContainer)
        ) {
          range = r.cloneRange();
        }
      }
    }
    if (!range) return;

    // If both endpoints sit inside the SAME anchor, treat this as
    // "edit existing link": expand the range to cover the whole <a>
    // (so createLink rewrites the href cleanly and unlink targets the
    // entire anchor), and pre-fill the input with the current href.
    const startA = findLinkAncestor(range.startContainer, editor);
    const endA = findLinkAncestor(range.endContainer, editor);
    let initialUrl = '';
    let isEditing = false;
    if (startA && startA === endA) {
      range.selectNodeContents(startA);
      initialUrl = startA.getAttribute('href') ?? '';
      isEditing = true;
    } else if (range.collapsed) {
      // Collapsed caret outside any link — there's nothing for the
      // link command to wrap. Bail per spec ("when user selects text").
      return;
    }

    linkRangeRef.current = range;
    setLinkContext({ initialUrl, isEditing });
  }, []);

  // Apply the link to the saved range using execCommand so the action
  // sits on the browser's undo stack. URL validation happens here:
  //   • empty input → close popover, do not apply (per spec)
  //   • no scheme   → prepend `https://` (so `sendible.com` works)
  const applyLinkPopover = useCallback(
    (rawUrl: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const url = normalizeUrl(rawUrl);
      const range = linkRangeRef.current;
      if (!url || !range) {
        // Empty URL or no captured range — close without mutating.
        linkRangeRef.current = null;
        setLinkContext(null);
        return;
      }
      // Re-validate the range — DOM mutations between popover open and
      // submit (extremely unlikely here but possible if React re-renders
      // touch the editor) could orphan the endpoints. Bail if so.
      if (
        !editor.contains(range.startContainer) ||
        !editor.contains(range.endContainer)
      ) {
        linkRangeRef.current = null;
        setLinkContext(null);
        return;
      }
      // Snapshot before mutating so Ctrl+Z routes through our stack
      // (and stays in step with block-style and inline undo entries).
      pushUndoSnapshot();
      lastInputSnapshotRef.current = 0;
      editor.focus({ preventScroll: true });
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      document.execCommand('createLink', false, url);
      // execCommand('createLink') doesn't set rel/target. Sweep the
      // editor and apply secure-default attributes to any newly-created
      // anchors so external links don't leak window.opener references.
      editor.querySelectorAll('a[href]').forEach((a) => {
        if (!a.getAttribute('rel')) {
          a.setAttribute('rel', 'noopener noreferrer');
        }
        if (!a.getAttribute('target')) {
          a.setAttribute('target', '_blank');
        }
      });
      onChange({ html: editor.innerHTML });
      linkRangeRef.current = null;
      setLinkContext(null);
      refreshActiveInline();
    },
    [onChange, refreshActiveInline, pushUndoSnapshot],
  );

  // Strip the link wrapper from the saved range. Uses execCommand so
  // it remains undoable; `unlink` operates on whatever <a> ancestors
  // the selection touches, which is exactly what we expanded to in
  // `openLinkPopover` for the "edit existing" path.
  const removeLinkPopover = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const range = linkRangeRef.current;
    if (!range) {
      setLinkContext(null);
      return;
    }
    // Snapshot before unlinking so Ctrl+Z restores the link.
    pushUndoSnapshot();
    lastInputSnapshotRef.current = 0;
    editor.focus({ preventScroll: true });
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    document.execCommand('unlink');
    onChange({ html: editor.innerHTML });
    linkRangeRef.current = null;
    setLinkContext(null);
    refreshActiveInline();
  }, [onChange, refreshActiveInline, pushUndoSnapshot]);

  const closeLinkPopover = useCallback(() => {
    const editor = editorRef.current;
    if (editor) editor.focus({ preventScroll: true });
    linkRangeRef.current = null;
    setLinkContext(null);
  }, []);

  // Show selection chrome (white fill + purple border + drag dots +
  // kebab) only in edit mode while the user is actively engaged with
  // this element. Per Figma 1391:381377 / 1391:382213 the chrome is
  // visible on hover AND focus; in default state (1391:376822) the
  // element is naked text. Keep chrome up while the overflow menu is
  // open even if the cursor leaves — otherwise the menu instantly
  // detaches when the user moves toward it.
  const showChrome = isEditMode && (isHovered || isFocused || overflowOpen);

  // Close the overflow menu on outside clicks (clicks inside the
  // portaled menu surface carry the `data-text-overflow-menu` flag, so
  // we let those through).
  useEffect(() => {
    if (!overflowOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        target instanceof Element &&
        target.closest('[data-text-overflow-menu]')
      ) {
        return;
      }
      if (overflowBtnRef.current && overflowBtnRef.current.contains(target)) {
        return;
      }
      setOverflowOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overflowOpen]);

  // Toolbar surfaces only when the user has highlighted (non-collapsed)
  // text inside this editor — matches the Notion / Google Docs / Medium
  // pattern where the floating formatting toolbar appears on selection,
  // not on caret-only focus. Tracking the selection lets the toolbar
  // hide as soon as the user clicks into a different word (collapsing
  // the range) and re-appear the next time text is highlighted, without
  // requiring the editor to lose focus first.
  // Keep the toolbar mounted while the link popover is open — focusing
  // the URL input collapses the editor's selection (so `hasSelection`
  // drops to false), and without this guard the toolbar would unmount
  // mid-edit and take the popover with it.
  // Keep the toolbar mounted while the link popover is open —
  // focusing the popover input collapses the editor's selection (so
  // `hasSelection` drops to false), and without this guard the toolbar
  // would unmount mid-edit and take the popover with it.
  const showToolbar =
    isEditMode && (hasSelection || linkContext !== null);

  const presetClass = STYLE_META[textStyle].presetClass;
  const placeholder = 'Write about your data...';

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        // `text-element-wrapper` is the CSS hook ReportCanvas uses to
        // (a) force chrome + action visibility while RGL is dragging
        // this element (Figma 1391:377936 — the floating drag preview
        // keeps its purple border + kebab + dots), and (b) reposition
        // RGL's SE resize grip to the chrome's bottom-right corner via
        // a CSS variable populated from this component's
        // ResizeObserver. Wrapper hugs content (no h-full) so the
        // chrome height never exceeds the typed text — preventing the
        // "tall empty box" feel under min-row clamping.
        'text-element-wrapper relative w-full rounded-[6px] transition-colors duration-75',
        // Always-on border keeps offsetHeight stable across hover/focus
        // — only the *color* swaps to purple when chrome is on, so the
        // ResizeObserver doesn't see a phantom 2 px height jump.
        'border border-solid',
        // Padding from Figma 1391:381539 — px=20, py=12.
        'px-[20px] py-[12px]',
        showChrome
          ? 'bg-white border-[#4D36FF]'
          : 'bg-transparent border-transparent',
      )}
    >
      {/* More-options kebab. Sized to match the data-module overflow
          button in ModuleActions (w-7 h-7 with a 16 × 16
          IconMoreVertical in #4C4B4F) so all overflow surfaces in the
          report carry the same visual weight — the text element
          previously used a larger 32 × 32 / 20 px variant which read
          as oversized next to chart-card kebabs. Border is omitted
          because the chrome wrapper already paints a purple outline,
          so an extra button border would double up.
          `text-element-action` lets ReportCanvas force this button
          visible during RGL drag (chrome paints, action stays).
          `top-[7px]` keeps the smaller button vertically aligned with
          the first text line in the 42 px chrome — using top-1/2
          would drift downward when the cell is taller than the typed
          content. */}
      {showChrome && (
        <button
          ref={overflowBtnRef}
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setOverflowOpen((v) => !v)}
          title="More actions"
          className={cn(
            'text-element-action absolute right-[8px] top-[7px] z-10',
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

      {/* Drag grip — Figma 1391:381539 "Dots Container". Lives INSIDE the
          chrome at left=6 px (vs. ModuleCard's external grip), 8 × 13 dot
          cluster aligned with the first text line. Picks up `.drag-handle`
          so RGL hooks the move gesture, and `text-element-action` so it
          stays visible during the drag preview. `top-[14.5px]` matches
          the dot cluster's vertical anchor in the 42 px chrome (Figma
          1391:381539) — using top-1/2 would drift downward when the cell
          is taller than the typed content. */}
      {isEditMode && (
        <div
          className={cn(
            'drag-handle text-element-action absolute left-[6px] top-[14.5px]',
            'flex items-center justify-center cursor-grab active:cursor-grabbing transition-opacity',
            showChrome ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
          aria-hidden="true"
        >
          <IconDragDots color="#626165" />
        </div>
      )}

      {/* Editor + placeholder overlay. The placeholder is rendered as
          a real DOM node (not a `:empty::before` pseudo) for two
          reasons: (1) contenteditable browsers inject a caret-anchor
          `<br>` on focus, which breaks `:empty`, and (2) some browsers
          ignore `attr()`-driven `content` when the host element is a
          contenteditable. A plain absolute-positioned div behind the
          editor avoids both pitfalls and renders identically in
          Chrome / Safari / Firefox. `pointer-events-none` keeps it
          click-through so caret placement still hits the editor.
          The overlay inherits the same preset class as the editor so
          its typography matches the active textStyle (Text vs H1 vs
          H2). The wrapper's px-[20] py-[12] padding positions it on
          top of the editor's first character — no extra inset needed
          on the overlay itself since it shares the wrapper's padding
          context (left:0 / top:0 of the padded box). */}
      <div className="relative w-full">
        {isEditorEmpty && (
          // The `text-element` class is concatenated OUTSIDE `cn()` —
          // tailwind-merge (used by `cn`) treats `text-element` and
          // `text-element--h1`/`--h2`/... as conflicting `text-*`
          // utilities (it cannot tell our custom names apart from
          // Tailwind's `text-xs`, `text-base`, etc.) and silently
          // strips the bare `text-element` class. Without it the
          // per-tag overrides (`.text-element h1`, `.text-element
          // h2`, `.text-element li`) never match, so swapping a
          // block's tag has no visible effect. Keeping the ancestor
          // class out of `cn` is the minimal fix.
          <div
            className={`text-element ${cn(
              'absolute left-0 top-0 pointer-events-none select-none',
              presetClass,
            )}`}
            style={{ color: '#BCBBBD' }}
            aria-hidden="true"
          >
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          className={`text-element ${cn(
            'relative w-full outline-none',
            presetClass,
            isEditMode ? 'cursor-text' : 'cursor-default',
          )}`}
          contentEditable={isEditMode}
          suppressContentEditableWarning
          spellCheck={isEditMode}
          onBeforeInput={handleBeforeInput}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>

      {/* Local style block — preset typography only (placeholder is now
          a real DOM node above, not a `::before` pseudo). Body type
          per Figma 1391:381539 (placeholder) / 1391:382395 (typed):
          IBM Plex Sans 400 14/18 with 0.07 letter-spacing — distinct
          from the 14/21 used elsewhere in the app. */}
      <style>{`
        /* The --text / --h1 / --h2 / --ul / --ol classes set the
           editor DEFAULT (i.e. unstyled / empty-block) typography.
           They drive how an empty editor and its placeholder overlay
           paint, plus the typography of any text not yet wrapped in a
           block tag. min-height matches the active line-height so an
           empty editor still occupies one line of vertical space —
           keeps the click target tall enough to land the caret
           reliably and gives the placeholder overlay something to
           align against. */
        .text-element--text {
          font: 400 14px/18px 'IBM Plex Sans', sans-serif;
          letter-spacing: 0.07px;
          color: #201E24;
          min-height: 18px;
        }
        .text-element--h1 {
          font: 500 24px/32px 'IBM Plex Sans', sans-serif;
          color: #201E24;
          min-height: 32px;
        }
        .text-element--h2 {
          font: 500 18px/26px 'IBM Plex Sans', sans-serif;
          color: #201E24;
          min-height: 26px;
        }
        .text-element--ul,
        .text-element--ol {
          font: 400 14px/18px 'IBM Plex Sans', sans-serif;
          letter-spacing: 0.07px;
          color: #201E24;
          padding-left: 20px;
        }
        /* Per-tag overrides — these win over the parent's
           --text/--h1/--h2 class (specificity 0,2,0 vs 0,1,0) so each
           block inside the editor renders per ITS OWN tag, not per the
           module's default style. Without these, formatBlock-ing one
           paragraph as h1 inside a --text editor would still render it
           at body size (it would inherit the parent font), and worse,
           swapping the module's default to --h1 would re-style every
           existing paragraph at h1 size. With these rules a mixed
           paragraph + heading + paragraph editor renders exactly like
           the user expects: the formatted block changes, the rest
           stays. */
        .text-element p {
          font: 400 14px/18px 'IBM Plex Sans', sans-serif;
          letter-spacing: 0.07px;
          color: #201E24;
          margin: 0;
        }
        .text-element h1 {
          font: 500 24px/32px 'IBM Plex Sans', sans-serif;
          color: #201E24;
          margin: 0;
        }
        .text-element h2 {
          font: 500 18px/26px 'IBM Plex Sans', sans-serif;
          color: #201E24;
          margin: 0;
        }
        .text-element li {
          font: 400 14px/18px 'IBM Plex Sans', sans-serif;
          letter-spacing: 0.07px;
          color: #201E24;
        }
        /* List markers — apply to ANY ul/ol inside the editor, not
           just when the editor's preset class is --ul/--ol. The user
           can convert a single block to a list inside an otherwise
           heading-default editor (e.g. drop a Heading 1 element, then
           change to Bullet list); the inner <ul> needs disc markers
           regardless of the surrounding preset. We keep the
           --ul/--ol preset rules below for the EMPTY-editor case
           where there's no <ul>/<ol> tag yet but the placeholder
           should still render in list typography. */
        .text-element ul {
          list-style: disc outside;
          padding-left: 20px;
          margin: 0;
        }
        .text-element ol {
          list-style: decimal outside;
          padding-left: 20px;
          margin: 0;
        }
        .text-element a {
          color: #4D36FF;
          text-decoration: underline;
          cursor: pointer;
        }
        .text-element a:hover {
          color: #3D2BCC;
        }
      `}</style>

      {showToolbar && (
        <Toolbar
          anchorRect={anchorRect}
          currentStyle={activeBlockStyle}
          onStyleChange={applyTextStyle}
          onCommand={applyInline}
          activeInline={activeInline}
          onLink={openLinkPopover}
          linkContext={linkContext}
          onApplyLink={applyLinkPopover}
          onRemoveLink={removeLinkPopover}
          onCloseLink={closeLinkPopover}
          rootRef={toolbarRef}
        />
      )}
      {emojiSuggestion && emojiSuggestion.matches.length > 0 && (
        <EmojiSuggestionDropdown
          anchorRect={emojiSuggestion.anchorRect}
          matches={emojiSuggestion.matches}
          highlightedIndex={emojiSuggestion.highlightedIndex}
          onPick={acceptEmojiSuggestion}
          onHover={(i) =>
            setEmojiSuggestion((prev) =>
              prev ? { ...prev, highlightedIndex: i } : prev,
            )
          }
        />
      )}
    </div>
  );
}
