'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ReportModule } from '@/types';
import { OverflowDropdown } from './ModuleActions';
import { IconMoreVertical, IconDragHandle } from '@/components/icons/SendiIcons';
import { cn } from '@/lib/utils';

// ─── EmojiElement ────────────────────────────────────────────────────────────
//
// Standalone single-emoji canvas block — the renderer for
// `module.elementKind === 'emoji'`. Distinct from `TextElement`:
// no contenteditable, no rich text, no toolbar. The element holds one
// native Unicode character (`module.emoji`), scaled to fill the cell, and
// surfaces a picker popover when the user wants to choose / change it.
//
// Lifecycle:
//   • Freshly dropped from the Elements panel → `module.emoji === ''`,
//     so we auto-open the picker on first mount. The user picks one,
//     `onChange({ emoji })` stores it, picker closes.
//   • Existing element with an emoji → renders the character; clicking
//     it (in edit mode) re-opens the picker so the user can swap.
//   • Picker dismissal: clicking outside (custom mousedown listener
//     anchored to the picker root) closes it. If `module.emoji` is still
//     empty after dismissal we leave it empty — the user sees an empty
//     placeholder cell with the picker re-mountable on click.
//
// emoji-mart's `Picker` is a custom HTMLElement; we instantiate it once
// in a useEffect, append it to a portal-mounted host, and tear it down
// on close. The lib + data are dynamic-imported so the ~150 KB data
// file isn't in the main bundle and the customElements registration
// doesn't run during SSR.

interface EmojiElementProps {
  module: ReportModule;
  isEditMode: boolean;
  /** Persist the picked emoji back into the parent's modules state. */
  onChange: (patch: { emoji?: string }) => void;
  /** Duplicate this element (parent appends a copy below the original). */
  onDuplicate: () => void;
  /** Remove this element from the report. */
  onDelete: () => void;
}

export function EmojiElement({
  module,
  isEditMode,
  onChange,
  onDuplicate,
  onDelete,
}: EmojiElementProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const overflowBtnRef = useRef<HTMLButtonElement>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const emoji = module.emoji ?? '';
  const isEmpty = emoji === '';

  // Auto-open the picker on first mount when the module has no emoji
  // yet (i.e. just dropped from the Elements panel).  We DON'T re-open
  // on subsequent mounts of the same id — that would re-trigger after
  // every parent re-render that swaps the module reference.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!isEditMode) return;
    if (autoOpenedRef.current) return;
    if (isEmpty) {
      autoOpenedRef.current = true;
      // Defer one tick so the wrapper has measured before we anchor.
      requestAnimationFrame(() => {
        const el = wrapperRef.current;
        if (el) setAnchorRect(el.getBoundingClientRect());
        setPickerOpen(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.id]);

  // Re-anchor the picker on viewport changes while it's open so it
  // doesn't drift away from the element when the user scrolls or
  // resizes.
  useEffect(() => {
    if (!pickerOpen) return;
    const recompute = () => {
      const el = wrapperRef.current;
      if (el) setAnchorRect(el.getBoundingClientRect());
    };
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [pickerOpen]);

  const openPicker = useCallback(() => {
    const el = wrapperRef.current;
    if (el) setAnchorRect(el.getBoundingClientRect());
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const handleSelect = useCallback(
    (native: string) => {
      onChange({ emoji: native });
      setPickerOpen(false);
    },
    [onChange],
  );

  // Close overflow menu on outside clicks (clicks inside the portaled
  // dropdown surface carry `data-text-overflow-menu`, so let those
  // through).
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

  const showChrome = isEditMode && (isHovered || pickerOpen || overflowOpen);

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        // `text-element-wrapper` shares the CSS hooks ReportCanvas uses
        // (chrome paint while RGL drags, resize-grip alignment via the
        // `--text-chrome-h` variable).  Reusing the same class keeps
        // emoji elements visually consistent with text elements.
        'text-element-wrapper relative w-full h-full rounded-[6px] transition-colors duration-75',
        'border border-solid',
        showChrome
          ? 'bg-white border-[#4D36FF]'
          : 'bg-transparent border-transparent',
      )}
    >
      {/* Drag grip — same layout as TextElement (left-6 px, top-1/2-ish).
          Uses the design-system 20×20 IconDragHandle here vs. the inline
          dot cluster TextElement uses; an emoji element is a single
          atomic block so the regular external drag handle reads better
          than text's inline dots. */}
      {isEditMode && (
        <div
          className={cn(
            'drag-handle text-element-action absolute left-1 top-1',
            'flex items-center justify-center cursor-grab active:cursor-grabbing transition-opacity',
            showChrome ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
          aria-hidden="true"
        >
          <IconDragHandle size={16} color="#626165" />
        </div>
      )}

      {/* Overflow kebab — same chrome as TextElement so duplicate / delete
          are reachable here too. */}
      {showChrome && (
        <button
          ref={overflowBtnRef}
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setOverflowOpen((v) => !v)}
          title="More actions"
          className={cn(
            'text-element-action absolute right-1 top-1 z-10',
            'flex items-center justify-center w-7 h-7 p-[6px] rounded-[6px] transition-colors',
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

      {/* Emoji surface — clickable in edit mode to re-open the picker.
          Empty placeholder shows a faint Unicode "smiling face" outline
          glyph so the user has something to click after dismissing the
          picker without choosing.  Font-size scales with cell height
          via clamp() — small enough to stay inside the 1-cell default
          (140 × 140 visible) and large enough to read at 2× / 3× sizes
          without clipping. */}
      <button
        type="button"
        onClick={isEditMode ? openPicker : undefined}
        disabled={!isEditMode}
        className={cn(
          'flex items-center justify-center w-full h-full select-none',
          isEditMode ? 'cursor-pointer' : 'cursor-default',
        )}
        style={{
          fontSize: 'clamp(32px, 60%, 96px)',
          lineHeight: 1,
        }}
        aria-label={isEmpty ? 'Pick an emoji' : `Emoji ${emoji}`}
      >
        {isEmpty ? (
          <span style={{ color: '#BCBBBD', fontSize: 'clamp(28px, 50%, 80px)' }}>
            🙂
          </span>
        ) : (
          <span>{emoji}</span>
        )}
      </button>

      {pickerOpen && anchorRect && (
        <EmojiPickerOverlay
          anchorRect={anchorRect}
          onSelect={handleSelect}
          onClose={closePicker}
        />
      )}
    </div>
  );
}

// ─── Emoji picker overlay ────────────────────────────────────────────────────
//
// Portal-mounted picker positioned just below the emoji element's
// bounding rect.  Outside-click closes; clicking inside the picker
// chrome doesn't.  Mirrors the picker wiring used by the (removed)
// toolbar emoji button — emoji-mart's `Picker` is a custom element,
// instantiated once via dynamic import and torn down on unmount.

interface EmojiPickerOverlayProps {
  anchorRect: DOMRect;
  onSelect: (native: string) => void;
  onClose: () => void;
}

function EmojiPickerOverlay({
  anchorRect,
  onSelect,
  onClose,
}: EmojiPickerOverlayProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onCloseRef.current = onClose;
  }, [onSelect, onClose]);

  // Mount the emoji-mart Picker custom element into our host div.
  useEffect(() => {
    let disposed = false;
    let pickerNode: HTMLElement | null = null;
    (async () => {
      const [{ Picker, init }, dataMod] = await Promise.all([
        import('emoji-mart'),
        import('@emoji-mart/data'),
      ]);
      if (disposed) return;
      await init({ data: dataMod.default });
      if (disposed) return;
      pickerNode = new Picker({
        data: dataMod.default,
        theme: 'light',
        previewPosition: 'none',
        skinTonePosition: 'none',
        autoFocus: true,
        onEmojiSelect: (emoji: { native: string }) => {
          onSelectRef.current(emoji.native);
        },
        // Outside-click handled by our own listener below — emoji-mart's
        // built-in version closes too eagerly on the same mousedown that
        // opens the picker, which doesn't matter for the standalone
        // element today but keeping the wiring symmetrical with the
        // (now-removed) toolbar picker means future edits don't trip on
        // the same race.
      }) as unknown as HTMLElement;
      const host = hostRef.current;
      if (host && pickerNode) host.appendChild(pickerNode);
    })();
    return () => {
      disposed = true;
      if (pickerNode && pickerNode.parentNode) {
        pickerNode.parentNode.removeChild(pickerNode);
      }
    };
  }, []);

  // Custom outside-click — closes the picker for any mousedown that
  // doesn't land inside the picker chrome.  Attached on a 0 ms timeout
  // so the mousedown that originally opened the picker doesn't
  // immediately close it.
  useEffect(() => {
    let attached = false;
    const handler = (e: MouseEvent) => {
      const host = hostRef.current;
      if (!host) return;
      const target = e.target as Node;
      if (host.contains(target)) return;
      onCloseRef.current();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', handler);
      attached = true;
    }, 0);
    return () => {
      window.clearTimeout(timer);
      if (attached) document.removeEventListener('mousedown', handler);
    };
  }, []);

  // Pin top-left to (anchor.bottom + 4 px, anchor.left), clamped to the
  // viewport so the picker doesn't render off-screen near the right /
  // bottom edges. emoji-mart's default picker is ~352 × 435 px.
  const PICKER_W = 352;
  const PICKER_H = 435;
  const margin = 4;
  let top = anchorRect.bottom + margin + window.scrollY;
  let left = anchorRect.left + window.scrollX;
  if (typeof window !== 'undefined') {
    if (left + PICKER_W > window.scrollX + window.innerWidth) {
      left = window.scrollX + window.innerWidth - PICKER_W - margin;
    }
    if (top + PICKER_H > window.scrollY + window.innerHeight) {
      // Flip above the anchor when there's no room below.
      top = anchorRect.top - PICKER_H - margin + window.scrollY;
    }
    if (left < window.scrollX + margin) left = window.scrollX + margin;
    if (top < window.scrollY + margin) top = window.scrollY + margin;
  }

  return createPortal(
    <div
      className="fixed z-50 bg-white border border-[#e8e8e9] rounded-[6px] overflow-hidden"
      style={{
        top,
        left,
        boxShadow:
          '0px 4px 8px 0px rgba(32,30,36,0.1), 0px 8px 16px 0px rgba(32,30,36,0.1)',
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div ref={hostRef} />
    </div>,
    document.body,
  );
}
