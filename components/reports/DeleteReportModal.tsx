'use client';

/**
 * Delete-report confirmation dialog — Figma 1366:346431.
 *
 * Visual contract from the Figma `Modal / Footerless` node:
 *   • Surface: bg #FFFFFF, rounded-4, Shadow-1
 *     (`0 1 2 + 0 2 4 #31313126`). NO border.
 *   • Header strip — pl-24 / pr-16 / pt-6, gap-16 between title and the
 *     close affordance. Title "Delete report" in Sans-Medium/16 #363439.
 *     Close = 40 × 40 round button, IconClose 20 #201E24, hovers to
 *     `rgba(32,30,36,0.05)` to match the cancel-button surface tint.
 *   • Body — px-24, Sans/14 #79787B, 21-px line-height. Copy interpolates
 *     the report name verbatim ("Are you sure you want to delete
 *     {name}? This action cannot be undone.").
 *   • Footer — px-24 py-16, gap-8, justify-end:
 *       Cancel → bg `rgba(32,30,36,0.05)`, h-32, px-12, py-8, rounded-40,
 *                Sans-Medium/14 #626165.
 *       Yes, delete → bg #CE091C (DANGER/danger--shade_10), h-32, px-12,
 *                     py-8, rounded-40, Sans-Medium/14 #FFFFFF.
 *
 * Behaviour:
 *   • Rendered through a `createPortal` to <body> so it sits above any
 *     stacking context the row's `relative` containers create.
 *   • Backdrop fades in over the whole viewport at 30 % black; clicking
 *     it cancels (treat as the same affordance as Cancel + close).
 *   • Escape cancels. Enter on the focused confirm button confirms.
 *   • The confirm button gets focus on open — it is the destination of
 *     the user's intent ("Yes, delete"), so a keyboard user lands ready
 *     to commit. We do NOT auto-confirm; they still have to press Enter.
 *   • The host scrollbar is suppressed while the dialog is open so the
 *     page doesn't scroll behind a focus-trapped modal.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from '@/components/icons/SendiIcons';
import { cn } from '@/lib/utils';

interface DeleteReportModalProps {
  open: boolean;
  /** Name of the report being deleted — interpolated into the body copy. */
  reportName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteReportModal({
  open,
  reportName,
  onCancel,
  onConfirm,
}: DeleteReportModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Escape closes; focus the destructive button so keyboard users land
  // on the action they invoked (Enter still required to commit).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => confirmRef.current?.focus());
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  // Suppress page scroll while the dialog is open. Restore the prior
  // overflow value rather than blanket-clearing it so we don't trample
  // any other component that may also have set it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Render nothing until mounted on the client — `createPortal` needs
  // `document.body`, which doesn't exist during SSR.
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
      role="presentation"
      onClick={onCancel}
    >
      {/* Backdrop — 30 % black wash. Sits behind the dialog within the
          same flex container so a stray click anywhere outside the
          surface cancels. */}
      <div className="absolute inset-0 bg-[rgba(0,0,0,0.3)]" aria-hidden="true" />

      {/* Surface — stop event propagation so clicks INSIDE the dialog
          don't trigger the backdrop's cancel handler. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-report-title"
        aria-describedby="delete-report-desc"
        onClick={(e) => e.stopPropagation()}
        className="relative w-[400px] max-w-[calc(100vw-32px)] bg-white rounded-[4px] flex flex-col overflow-hidden"
        style={{
          boxShadow:
            '0 1px 2px rgba(49,49,49,0.15), 0 2px 4px rgba(49,49,49,0.15)',
        }}
      >
        {/* Header — title + close. The header is NOT a separate visual
            band (no divider, no fill) — it's just the layout for the
            top edge of the surface. */}
        <div className="flex items-center gap-[16px] pl-[24px] pr-[16px] pt-[6px]">
          <h2
            id="delete-report-title"
            className="flex-1 min-w-0 text-[16px] leading-[24px] font-medium text-[#363439]"
          >
            Delete report
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className={cn(
              'w-[40px] h-[40px] rounded-full flex items-center justify-center',
              'hover:bg-[rgba(32,30,36,0.05)] transition-colors cursor-pointer',
            )}
          >
            <IconClose size={20} color="#201E24" />
          </button>
        </div>

        {/* Body copy. The Figma puts NO top padding above the paragraph
            — it sits right under the header strip's pt-6 + close-button
            footprint, and the footer's py-16 carries the bottom rhythm. */}
        <div className="px-[24px]">
          <p
            id="delete-report-desc"
            className="text-[14px] leading-[21px] text-[#79787B]"
          >
            {/* Report name is emphasised in Medium — it's the noun the
                user is being asked to commit on, so it carries weight
                even though the surrounding copy stays Regular. */}
            Are you sure you want to delete{' '}
            <span className="font-medium">{reportName}</span>? This action
            cannot be undone.
          </p>
        </div>

        {/* Footer actions — right-aligned, gap-8. */}
        <div className="flex items-center justify-end gap-[8px] px-[24px] py-[16px]">
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              'h-[32px] px-[12px] rounded-[40px]',
              'bg-[rgba(32,30,36,0.05)] hover:bg-[rgba(32,30,36,0.1)] transition-colors',
              'text-[14px] leading-[14px] font-medium text-[#626165]',
              'cursor-pointer',
            )}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={cn(
              'h-[32px] px-[12px] rounded-[40px]',
              'bg-[#CE091C] hover:bg-[#B30819] transition-colors',
              'text-[14px] leading-[14px] font-medium text-white',
              'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#CE091C] focus-visible:ring-offset-2',
            )}
          >
            Yes, delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
