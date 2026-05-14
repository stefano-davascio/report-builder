'use client';

import { Fragment, useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import {
  IconClose,
  IconCalendar,
  IconChevronDown,
  IconPlusCircle,
  IconWarning,
  IconDanger,
  IconHourglass,
  IconSearch,
  IconCheckbox,
} from '@/components/icons/SendiIcons';
import { cn } from '@/lib/utils';
import {
  MockProfile,
  ProfileGroup,
  ProfilePlatform,
  ProfileStatus,
  PROFILE_GROUPS,
  ALL_PROFILES,
} from '@/lib/profile-data';
import { maskProfileStatuses } from '@/lib/profile-status';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileAvatarSquare } from './ProfileAvatarSquare';
import { PlatformIcon } from './PlatformIcon';
import { ProfileChip } from './ProfileChip';

// ─── Checkbox ─────────────────────────────────────────────────────────────────
/**
 * Thin wrapper around the library `IconCheckbox` so existing call
 * sites keep their `<Checkbox state="..." />` API.  The icon component
 * owns all the visual contract (24×24 box, brand-purple fill, white
 * check / dash inner glyph) — this wrapper just preserves the
 * `flex-shrink-0` layout guarantee its callers expect.
 */
function Checkbox({ state }: { state: 'checked' | 'unchecked' | 'indeterminate' }) {
  return <IconCheckbox state={state} className="flex-shrink-0" />;
}

// ─── Status tooltips ──────────────────────────────────────────────────────────
/**
 * Per-status hover tooltip surfaces — Figma 1824:76452 (permission) /
 * 489:12798 (reconnect).  Two purposes:
 *   1. Tell the user WHY the chip / overflow-chip is errored.
 *   2. Hint the remediation ("Grant all permissions" / "Reconnect").
 *
 * Surfaces wherever a profile's `status` would otherwise read as a
 * standalone red triangle without context — the OverflowChip trigger,
 * its dropdown rows, and the per-profile chips on the bar.
 */
const STATUS_TOOLTIP_MESSAGE: Record<NonNullable<ProfileStatus>, string> = {
  reconnect:  "We've lost connection to this profile. Reconnect it to restore access.",
  permission: "We can't access this profile's data. Grant all permissions to fix this.",
  // Hourglass copy isn't in the Figma yet; fall back to a sensible
  // message until the design lands.
  syncing:    "We're syncing this profile's data. This usually takes a few minutes.",
};

/**
 * Hover-only tooltip wrapper using the Figma chrome from 1824:76452 /
 * 489:12798:
 *   • `bg-[rgba(32,30,36,0.7)]` translucent dark surface.
 *   • `rounded-[4px] px-[8px] py-[4px]`.
 *   • Label-Helper 12 typography (12 / 16 Regular #FFF, tracking 0.3).
 *   • `max-w-[224px]` wraps long messages without breaking layout.
 *
 * Built on the base-ui primitive directly (rather than the project's
 * shared `<TooltipContent>`) because the shared variant ships with
 * an opaque arrow + foreground bg + rounded-md / px-3 / py-1.5 chrome
 * — a different semantic from this status surface.  Keeping them
 * separate prevents either from drifting visually as the other
 * iterates.
 *
 * `render={<span />}` lets the trigger sit inside another button
 * (the OverflowChip body click target) without nesting `<button>`s.
 */
function WarningTooltip({
  children,
  message,
}: {
  children: ReactNode;
  message: string;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={<span className="inline-flex" />}>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side="top" sideOffset={6} className="isolate z-50">
          <TooltipPrimitive.Popup
            className={cn(
              // Figma 489:12798 — backdrop-blur softens whatever's
              // behind the tooltip so the dark-alpha surface reads
              // as glass rather than flat ink.
              'bg-[rgba(32,30,36,0.7)] backdrop-blur-[2px] rounded-[4px] px-[8px] py-[4px]',
              'max-w-[224px]',
              'text-[12px] leading-[16px] text-white',
              'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0',
              'data-open:animate-in data-open:fade-in-0',
              'data-closed:animate-out data-closed:fade-out-0',
            )}
            style={{
              fontFamily: 'IBM Plex Sans, sans-serif',
              letterSpacing: '0.3px',
            }}
          >
            {message}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
/**
 * Status pill — Figma 685:33309 (Reconnect) / 685:33310 (Permission) /
 * 685:33311 (Syncing).
 *
 * Hard geometry specs from the design:
 *   • container — `flex items-center justify-end gap-[4px] p-[4px]
 *                 rounded-[4px] h-[20px] overflow-clip`.  Hard 20-px
 *                 outer height — Figma's React export wraps the
 *                 label in a `leading-[0]` parent + `<p leading-[18]>`
 *                 to collapse the line box visually; we get the same
 *                 result by locking outer h to 20 and running the
 *                 text at `leading-[12px]` (cap-height-driven).
 *   • icon slot — 14-px glyph, native asset stroke-width = 1.  The
 *                 `overflow-clip` on the outer crops the 1-px
 *                 overhang on top + bottom (icon centers in the 12-px
 *                 inner content row).
 *   • label     — IBM Plex Sans 12 / 12, Regular.  No letter-spacing
 *                 (the Label-Helper 12 token's 0.3 px reads too loose
 *                 at the 20-px outer height).
 *
 * Variant tokens:
 *   • Reconnect  — bg #FCE7E9 fg #CE091C icon `danger`    label "Reconnect profile"
 *   • Permission — bg #FCE7E9 fg #CE091C icon `warning`   label "Permission needed"
 *   • Syncing    — bg #FFF3CD fg #806104 icon `hourglass` label "Syncing Data"
 */
function StatusBadge({ status }: { status: NonNullable<ProfileStatus> }) {
  const config = {
    reconnect:  { bg: '#FCE7E9', color: '#CE091C', Icon: IconDanger,    label: 'Reconnect profile' },
    permission: { bg: '#FCE7E9', color: '#CE091C', Icon: IconWarning,   label: 'Permission needed' },
    syncing:    { bg: '#FFF3CD', color: '#806104', Icon: IconHourglass, label: 'Syncing Data' },
  }[status];
  const Icon = config.Icon;

  return (
    <div
      className="flex items-center justify-end gap-[4px] p-[4px] rounded-[4px] h-[20px] overflow-clip flex-shrink-0"
      style={{ backgroundColor: config.bg }}
    >
      <span className="flex items-center justify-center flex-shrink-0 [&_path]:[stroke-width:1]">
        <Icon size={14} color={config.color} />
      </span>
      <span
        className="text-[12px] leading-[12px] whitespace-nowrap"
        style={{
          color: config.color,
          fontFamily: 'IBM Plex Sans, sans-serif',
        }}
      >
        {config.label}
      </span>
    </div>
  );
}

// ─── Overflow chip ────────────────────────────────────────────────────────────
/**
 * Overflow chip — Figma 1821:76054 (clean) / 1826:76612 (error) +
 * dropdown 1821:76046 (clean) / 1826:76604 (error).
 *
 * Visual contract:
 *   • Trigger chip — `h-[32px] py-[4px] rounded-[4px] border`. Padding
 *     varies by variant: clean uses `pl-[6px] pr-[4px]`, error uses
 *     `pl-[6px] pr-[2px]` (the 2-px reduction makes room for the
 *     warning icon button before the X).
 *       ─ Clean variant: `bg-[#F3F3F4] border-[#F3F3F4]`, +N + X.
 *       ─ Error variant: `bg-[rgba(229,10,31,0.05)] border-[#FACED2]`,
 *                        +N + 14-px warning triangle + X.
 *   • Dropdown popover — `bg-white border border-[#E8E8E9] p-[8px]
 *     gap-[10px] rounded-[4px]` + 2-stack drop shadow.  Each row is a
 *     mini profile chip with the same per-variant chrome as the
 *     trigger; the row is errored when the profile's `status` is
 *     `permission` or `reconnect`.
 *   • Trigger body click → toggles the dropdown.  The trailing X on
 *     the trigger fires `onClear` (clear all overflowed profiles)
 *     with `stopPropagation` so it doesn't double-fire as a body
 *     click.  Per-row X in the dropdown fires `onRemoveProfile`.
 *
 * Error gating: the trigger paints the danger variant whenever ANY
 * profile in the overflowed set has a degraded status — gives the
 * user a peripheral signal to "look inside" without having to open
 * the popover first.
 */
function OverflowChip({
  profiles,
  onRemoveProfile,
  onClear,
}: {
  profiles: MockProfile[];
  /** Per-profile remove — edit-mode only.  When omitted, the dropdown
   *  rows render in read-only mode (no per-row X). */
  onRemoveProfile?: (id: string) => void;
  /** Clear-all — edit-mode only.  Wired to the trigger's trailing X. */
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const count = profiles.length;
  const hasError = profiles.some(
    (p) => p.status === 'permission' || p.status === 'reconnect',
  );

  // Popover position — portaled to `document.body` because the
  // chip row has `overflow-hidden` (it clips chips that don't fit
  // the row), which would otherwise clip the dropdown too.  Fixed
  // positioning + `getBoundingClientRect` of the trigger keeps the
  // popover anchored under the chip across scroll + resize.
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setPopoverPos(null);
      return;
    }
    const anchor = ref.current;
    if (!anchor) return;
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      setPopoverPos({ top: rect.bottom + 4, left: rect.left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  // Outside-click + Escape close the popover.  "Inside" includes
  // both the trigger (`ref`) AND the portaled popover (`popoverRef`),
  // since the popover is no longer a DOM descendant of the trigger.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (count === 0) return null;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      {/* Trigger chip — body opens the popover; trailing X clears
          all overflowed profiles. */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${count} more profile${count === 1 ? '' : 's'}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className={cn(
          'flex items-center h-[32px] py-[4px] border rounded-[4px] cursor-pointer transition-colors',
          hasError
            ? 'bg-[rgba(229,10,31,0.05)] border-[#FACED2] pl-[6px] pr-[2px]'
            : 'bg-[#F3F3F4] border-[#F3F3F4] pl-[6px] pr-[4px]',
        )}
      >
        <span
          className="text-[12px] text-[#363439] whitespace-nowrap"
          style={{ lineHeight: '22px', fontFamily: 'IBM Plex Sans, sans-serif' }}
        >
          +{count}
        </span>
        {hasError && (() => {
          // Aggregate error: pick the first errored profile's status
          // and use its tooltip message.  When the overflow set
          // contains a mix (e.g. one permission + one reconnect), the
          // tooltip shows the message for whichever appears first in
          // `profiles`.  The dropdown rows expose the per-profile
          // tooltips for the full picture.
          const firstErrored = profiles.find(
            (p) => p.status === 'permission' || p.status === 'reconnect',
          );
          const message = firstErrored?.status
            ? STATUS_TOOLTIP_MESSAGE[firstErrored.status]
            : '';
          return (
            <WarningTooltip message={message}>
              <span
                className="flex items-center justify-center w-[24px] h-[24px] flex-shrink-0"
              >
                <IconWarning
                  size={14}
                  color="#CE091C"
                  // Native asset has no stroke-width attribute (defaults
                  // to 1).  Library default 1.5 reads heavy; 1 matches
                  // the Figma render exactly.
                  className="[&_path]:[stroke-width:1]"
                />
              </span>
            </WarningTooltip>
          );
        })()}
        {onClear && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            aria-label="Clear all overflowed profiles"
            className="flex items-center justify-center w-[24px] h-[24px] rounded-[4px] hover:bg-[rgba(32,30,36,0.05)] transition-colors cursor-pointer flex-shrink-0"
          >
            <IconClose
              size={16}
              color="#201E24"
              // Native chip-X stroke is 0.98 — the same override
              // used on the filter chips' X (Figma 1689:76876).
              className="[&_path]:[stroke-width:0.98]"
            />
          </button>
        )}
      </div>

      {open && popoverPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          className={cn(
            'z-50 flex flex-col gap-[10px]',
            'bg-white border border-[#E8E8E9] rounded-[4px] p-[8px]',
          )}
          style={{
            position: 'fixed',
            top: popoverPos.top,
            left: popoverPos.left,
            // Figma "Is Floating" effect — 2-stack drop shadow at
            // alpha 0.1 each.
            boxShadow:
              '0px 4px 8px 0px rgba(32,30,36,0.1), 0px 8px 16px 0px rgba(32,30,36,0.1)',
          }}
        >
          {profiles.map((profile) => {
            const rowError =
              profile.status === 'permission' || profile.status === 'reconnect';
            return (
              <div
                key={profile.id}
                className={cn(
                  'flex h-[32px] items-center py-[4px] border rounded-[4px]',
                  rowError
                    ? 'bg-[rgba(229,10,31,0.05)] border-[#FACED2] pl-[6px] pr-[2px]'
                    : 'bg-[#F3F3F4] border-[#F3F3F4] pl-[6px] pr-[4px]',
                )}
              >
                <div className="flex gap-[8px] items-center flex-shrink-0">
                  <ProfileAvatarSquare profile={profile} />
                  <span
                    className="text-[12px] text-[#363439] whitespace-nowrap"
                    style={{
                      lineHeight: '22px',
                      fontFamily: 'IBM Plex Sans, sans-serif',
                    }}
                  >
                    {profile.name}
                  </span>
                </div>
                {rowError && profile.status && (
                  <WarningTooltip message={STATUS_TOOLTIP_MESSAGE[profile.status]}>
                    <span
                      className="flex items-center justify-center w-[24px] h-[24px] flex-shrink-0"
                    >
                      <IconWarning
                        size={14}
                        color="#CE091C"
                        className="[&_path]:[stroke-width:1]"
                      />
                    </span>
                  </WarningTooltip>
                )}
                {onRemoveProfile && (
                  <button
                    type="button"
                    onClick={() => onRemoveProfile(profile.id)}
                    aria-label={`Remove ${profile.name}`}
                    className="flex items-center justify-center w-[24px] h-[24px] rounded-[4px] hover:bg-[rgba(32,30,36,0.05)] transition-colors cursor-pointer flex-shrink-0"
                  >
                    <IconClose
                      size={16}
                      color="#201E24"
                      className="[&_path]:[stroke-width:0.98]"
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────
function SelectProfilesDropdown({
  groups,
  selectedIds,
  onToggleProfile,
  onToggleGroup,
  onSelectAll,
  searchQuery,
  onSearchChange,
}: {
  groups: ProfileGroup[];
  selectedIds: Set<string>;
  onToggleProfile: (id: string) => void;
  onToggleGroup: (platform: ProfilePlatform) => void;
  onSelectAll: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const [searchFocused, setSearchFocused] = useState(false);
  const q = searchQuery.toLowerCase();
  const filtered = groups
    .map(g => ({ ...g, profiles: g.profiles.filter(p => p.name.toLowerCase().includes(q)) }))
    .filter(g => g.profiles.length > 0);

  return (
    <div
      className="absolute top-full left-0 mt-[4px] bg-white rounded-[4px] z-50 flex flex-col overflow-hidden"
      style={{
        width: 347,
        boxShadow: '0px 0px 0px 1px #d2d2d3, 0px 12px 8px -4px rgba(32,30,36,0.15), 0px 4px 4px -2px rgba(32,30,36,0.2)',
      }}
    >
      <div className="p-[8px] flex-shrink-0">
        <div
          className={cn(
            'flex items-center bg-[rgba(32,30,36,0.05)] rounded-[4px] h-[32px]',
            searchFocused && 'border border-[#4D36FF]',
          )}
        >
          <div className="flex items-center justify-center w-[32px] h-[32px] flex-shrink-0">
            {/* Inline `IconSearch` from the SendiIcons library —
                replaces an earlier `<img>` that pointed at the Figma
                MCP localhost asset server (`http://localhost:3845/...`),
                which only resolves while Figma desktop + MCP are
                running.  Shipped builds had a broken-image
                placeholder where the search glyph should be. */}
            <IconSearch size={16} color="#201E24" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search profiles"
            className="flex-1 bg-transparent outline-none pr-[8px] text-[#201E24] placeholder-[#78767C]"
            style={{
              fontSize: 14,
              lineHeight: '16px',
              letterSpacing: '-0.1px',
              fontFamily: 'IBM Plex Sans, sans-serif',
            }}
          />
        </div>
      </div>

      {/* List — Figma 685:32478 / 1750:36537.  Outer wrapper has
          `py-[8px]` (8 px air above + below the list).  Inner scroll
          container drives the height cap.  Groups are separated by a
          1-px `#F3F3F4` divider (Figma 685:32547 / Line8) that
          extends past the `px-[8px]` content gutter via `-mx-[8px]`,
          so the rule paints edge-to-edge inside the dropdown.  The
          surrounding `my-[8px]` gives 8 px breathing room above + below
          the line, summing to the 16-px gap Figma specs between
          groups. */}
      <div className="py-[8px] flex-shrink-0">
        <div
          className="overflow-y-auto flex flex-col items-center px-[8px] pb-[8px]"
          style={{ maxHeight: 368 }}
        >
          {filtered.map((group, idx) => {
            const allSel  = group.profiles.every(p => selectedIds.has(p.id));
            const someSel = group.profiles.some(p => selectedIds.has(p.id));
            const groupState: 'checked' | 'unchecked' | 'indeterminate' =
              allSel ? 'checked' : someSel ? 'indeterminate' : 'unchecked';

            return (
              <Fragment key={group.platform}>
                {idx > 0 && (
                  <div
                    aria-hidden
                    className="self-stretch h-px bg-[#F3F3F4] my-[8px] -mx-[8px] flex-shrink-0"
                  />
                )}
                <div className="flex flex-col items-start w-full">
                  {/* Group header — Figma 685:32479. Hover is
                      brand-purple `rgba(81,61,217,0.1)`
                      (PRIMARY/primary--alpha_05), NOT a neutral
                      grey — matches the same hover token the profile
                      rows use, so the dropdown reads as one cohesive
                      surface. Inner `gap-[6px]` between checkbox and
                      label cluster, with a `gap-[4px]` between the
                      network glyph and the label text per Figma. */}
                  <button
                    onClick={() => onToggleGroup(group.platform)}
                    className="flex items-center gap-[6px] w-full px-[8px] py-[10px] rounded-[4px] hover:bg-[rgba(81,61,217,0.1)] transition-colors text-left"
                  >
                    {/* `flex items-center` collapses the wrapper to
                        the checkbox's exact 24-px height — without
                        it the wrapper inherits the parent's
                        line-box descent space (~30 px in this
                        context) and the inline-flex checkbox
                        baseline-aligns to the top, pulling its
                        visible body ~3 px above the row midline. */}
                    <div className="flex items-center flex-shrink-0">
                      <Checkbox state={groupState} />
                    </div>
                    <div className="flex items-center gap-[4px] min-w-0">
                      <PlatformIcon platform={group.platform} size={16} />
                      <span
                        className="text-[#4C4B4F] font-medium"
                        style={{ fontSize: 14, lineHeight: '17.5px', fontFamily: 'IBM Plex Sans, sans-serif' }}
                      >
                        {group.label}
                      </span>
                    </div>
                  </button>

                  {group.profiles.map(profile => {
                    const isSelected = selectedIds.has(profile.id);
                    const profileCheckState: 'checked' | 'unchecked' | 'indeterminate' =
                      !isSelected ? 'unchecked' : allSel ? 'indeterminate' : 'checked';
                    return (
                      // Profile row — Figma 685:32486. Asymmetric
                      // padding `pl-[16px] pr-[8px]` tucks the rows
                      // under the group label by 16 px.  Avatar is
                      // 24 px wide per Figma 685:32489 (was 20.67
                      // via `size="S"` — too small).  Inner content
                      // gap-[6px] between checkbox and the avatar+name
                      // cluster.
                      <button
                        key={profile.id}
                        onClick={() => onToggleProfile(profile.id)}
                        className="flex items-center gap-[6px] w-full pl-[16px] pr-[8px] py-[10px] rounded-[4px] hover:bg-[rgba(81,61,217,0.1)] transition-colors text-left"
                      >
                        <div className="flex items-center flex-shrink-0">
                          <Checkbox state={profileCheckState} />
                        </div>
                        <ProfileAvatarSquare profile={profile} />
                        <span
                          className="flex-1 text-[#201E24] truncate"
                          style={{ fontSize: 14, lineHeight: '17.5px', fontFamily: 'IBM Plex Sans, sans-serif' }}
                        >
                          {profile.name}
                        </span>
                        {profile.status && <StatusBadge status={profile.status} />}
                      </button>
                    );
                  })}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-end pl-[24px] pr-[8px] py-[4px] bg-white border-t border-[#F3F3F4] flex-shrink-0">
        <button
          onClick={onSelectAll}
          className="flex items-center h-[24px] px-[8px] py-[6px] rounded-[60px] hover:bg-[rgba(81,61,217,0.1)] transition-colors"
          style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
        >
          <span className="text-[12px] font-medium text-[#513DD9]" style={{ lineHeight: '12px' }}>
            Select all
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
// Hard cap on visible chips — desktop design maxes out at 5 before the
// overflow `+N` takes over. Anything beyond is responsive: when the row
// doesn't have room for all 5 + clear-all, we shrink below the cap and
// bump more profiles into `+N` so no chip is clipped by `overflow-hidden`.
const MAX_VISIBLE_CHIPS = 5;
// Flex `gap-2` = 8 px between chips / chip-row siblings. Used by the
// measurement pass to compute cumulative row width.
const CHIP_ROW_GAP_PX = 8;

interface ProfileSelectionBarProps {
  isEditMode: boolean;
  /**
   * Controlled selection — lifted to `ReportBuilderPage` so that modules
   * (e.g. the Module Networks indicator in each chart's legend) can read
   * the same source of truth without reaching into this component.
   */
  selectedIds: Set<string>;
  onSelectedIdsChange: (next: Set<string>) => void;
  /**
   * Imperative open trigger — when the numeric value changes (parent
   * bumps it), this component force-opens the picker dropdown.  Used
   * by `GlobalDataWarningBanner`'s "Fix in Select profiles" link so
   * the user can act on the per-profile pills the moment the banner
   * is clicked.  Numeric instead of boolean so successive triggers
   * always fire even if the dropdown is already open / was closed
   * by the user.
   */
  openTrigger?: number;
  /** Master toggle for profile-driven warning surfaces (per the
   *  Scenario Switcher's "Show error states").  When `false`
   *  (default), every profile's `status` is masked to `null` so
   *  status pills, warning icons, and overflow-chip error chrome
   *  all render as healthy.  The underlying mock data is unchanged. */
  showErrorStates?: boolean;
}

export function ProfileSelectionBar({
  isEditMode,
  selectedIds,
  onSelectedIdsChange,
  openTrigger,
  showErrorStates = false,
}: ProfileSelectionBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // External open trigger — parent bumps `openTrigger` to imperatively
  // open the dropdown.  We skip the initial mount value (no auto-open
  // on page load) by stashing the first-seen value in a ref; only
  // subsequent changes flip the dropdown on.
  const lastOpenTriggerRef = useRef<number | undefined>(openTrigger);
  useEffect(() => {
    if (openTrigger === undefined) return;
    if (lastOpenTriggerRef.current === openTrigger) return;
    lastOpenTriggerRef.current = openTrigger;
    setDropdownOpen(true);
  }, [openTrigger]);
  const [searchQuery, setSearchQuery]   = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // If we exit edit mode while the dropdown is open (Save / Cancel from
  // the header), force it closed — the picker affordance is edit-only so
  // leaving it mounted would let the user modify selections with no way
  // to save them.
  useEffect(() => {
    if (!isEditMode && dropdownOpen) {
      setDropdownOpen(false);
      setSearchQuery('');
    }
  }, [isEditMode, dropdownOpen]);

  // Apply the master "Show error states" gate at the data layer — once
  // here, all the downstream reads (chip row, overflow chip, picker)
  // get healthy statuses without each having to know about the
  // scenario flag.  `useMemo` so the picker dropdown's `groups` prop
  // doesn't get a new reference every render when the flag is on.
  const allProfiles = useMemo(
    () => maskProfileStatuses(ALL_PROFILES, showErrorStates),
    [showErrorStates],
  );
  const profileGroups = useMemo<ProfileGroup[]>(
    () =>
      showErrorStates
        ? PROFILE_GROUPS
        : PROFILE_GROUPS.map((g) => ({
            ...g,
            profiles: maskProfileStatuses(g.profiles, false),
          })),
    [showErrorStates],
  );
  const selectedProfiles = allProfiles.filter(p => selectedIds.has(p.id));
  // Chips we *might* render before overflow — capped at MAX_VISIBLE_CHIPS.
  // The measurement pass below narrows this further if the row is too
  // narrow to hold them all alongside "Clear all".
  const chipCandidates = selectedProfiles.slice(0, MAX_VISIBLE_CHIPS);

  // Width-aware overflow: measure the full candidate chip row off-screen,
  // then decide how many actually fit in the real row. User-visible
  // effect: at narrow widths "5 + N" becomes e.g. "3 + (N+2)" rather than
  // the right-most chips getting clipped by `overflow-hidden`.
  const chipRowRef = useRef<HTMLDivElement>(null);
  const measureRowRef = useRef<HTMLDivElement>(null);
  const [chipRowWidth, setChipRowWidth] = useState(0);
  const [fittingCount, setFittingCount] = useState(chipCandidates.length);

  useEffect(() => {
    const el = chipRowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setChipRowWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-measure whenever the row width, the candidate set, or edit mode
  // flips. Edit mode matters because editable chips grow by ~28 px (the
  // remove button + 4 px gap), so the widths measured in view mode don't
  // apply when the picker is open.
  useLayoutEffect(() => {
    const row = measureRowRef.current;
    if (!row || chipRowWidth === 0) {
      setFittingCount(chipCandidates.length);
      return;
    }
    const chipEls = Array.from(row.querySelectorAll<HTMLElement>('[data-m="chip"]'));
    const overflowEl = row.querySelector<HTMLElement>('[data-m="overflow"]');
    const clearEl = row.querySelector<HTMLElement>('[data-m="clear"]');
    const overflowW = overflowEl ? overflowEl.offsetWidth + CHIP_ROW_GAP_PX : 0;
    const clearW = clearEl ? clearEl.offsetWidth + CHIP_ROW_GAP_PX : 0;
    const hasOverflow = selectedProfiles.length > chipCandidates.length;

    // First: try to fit every candidate. If all fit (and there are no
    // extras beyond the cap that would force a `+N`), we skip the
    // overflow chip entirely.
    if (!hasOverflow) {
      const total = chipEls.reduce(
        (s, el, i) => s + el.offsetWidth + (i > 0 ? CHIP_ROW_GAP_PX : 0),
        0,
      );
      if (total <= chipRowWidth - clearW) {
        setFittingCount(chipEls.length);
        return;
      }
    }
    // Otherwise reserve space for the `+N` chip and walk chips until
    // adding the next one would overflow.
    const budget = chipRowWidth - overflowW - clearW;
    let used = 0;
    let count = 0;
    for (let i = 0; i < chipEls.length; i++) {
      const w = chipEls[i].offsetWidth + (i > 0 ? CHIP_ROW_GAP_PX : 0);
      if (used + w > budget) break;
      used += w;
      count++;
    }
    setFittingCount(Math.max(0, count));
  }, [chipRowWidth, selectedProfiles, chipCandidates, isEditMode]);

  const visibleChips = chipCandidates.slice(0, fittingCount);
  const hiddenCount = selectedProfiles.length - visibleChips.length;

  const toggleProfile = useCallback((id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedIdsChange(next);
  }, [selectedIds, onSelectedIdsChange]);

  const toggleGroup = useCallback((platform: ProfilePlatform) => {
    const group = PROFILE_GROUPS.find(g => g.platform === platform);
    if (!group) return;
    const allSel = group.profiles.every(p => selectedIds.has(p.id));
    const next = new Set(selectedIds);
    group.profiles.forEach(p => { if (allSel) next.delete(p.id); else next.add(p.id); });
    onSelectedIdsChange(next);
  }, [selectedIds, onSelectedIdsChange]);

  const selectAll = useCallback(() => {
    onSelectedIdsChange(new Set(ALL_PROFILES.map(p => p.id)));
  }, [onSelectedIdsChange]);

  const clearAll = useCallback(() => {
    onSelectedIdsChange(new Set());
  }, [onSelectedIdsChange]);

  return (
    <div className="bg-white border-b border-[#E8E8E9] h-[52px] px-6 flex items-center gap-2 flex-shrink-0">

      {/* "Select profiles" button — edit-mode only per Figma
          1026:39255 (present) vs 1109:103247 (absent). In view mode the
          profile bar opens directly with the chip list; there is no
          picker affordance. */}
      {isEditMode && (
        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(prev => !prev)}
            className={cn(
              'flex items-center gap-[7px] h-[32px] px-[13px] py-[1px] border rounded-[4px] transition-colors',
              // Match the reports-landing Filter trigger open-state:
              // the border + label stay at rest, hover fill is
              // suppressed so the open trigger reads as neutral
              // (1670:42280) — competing with the dropdown panel
              // when an "active" purple fill paints underneath.
              'border-[rgba(32,30,36,0.2)] bg-transparent',
              !dropdownOpen && 'hover:bg-[#F3F3F4]',
            )}
          >
            <IconPlusCircle size={18} color="#201E24" className="flex-shrink-0" />
            <span
              className="text-[#201E24] font-medium"
              style={{ fontSize: 12, lineHeight: '21px', fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              Select profiles
            </span>
          </button>

          {dropdownOpen && (
            <SelectProfilesDropdown
              groups={profileGroups}
              selectedIds={selectedIds}
              onToggleProfile={toggleProfile}
              onToggleGroup={toggleGroup}
              onSelectAll={selectAll}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          )}
        </div>
      )}

      <div
        ref={chipRowRef}
        className="relative flex items-center gap-2 flex-1 overflow-hidden min-w-0"
      >
        {/* Chip × and overflow-chip × are gated on edit mode — view-mode
            chips are purely informational per the spec. */}
        {visibleChips.map(profile => (
          <ProfileChip
            key={profile.id}
            profile={profile}
            isEditing={isEditMode}
            onRemove={isEditMode ? () => toggleProfile(profile.id) : undefined}
          />
        ))}

        {hiddenCount > 0 && (
          <OverflowChip
            profiles={selectedProfiles.slice(visibleChips.length)}
            onRemoveProfile={isEditMode ? toggleProfile : undefined}
            onClear={isEditMode ? clearAll : undefined}
          />
        )}

        {/* "Clear all" — edit-mode only (Figma 1373:371095). Renders as a
            32-px pill (NOT a bare text link) so it sits flush with the
            adjacent chip row geometrically: h-32, min-w-32, px-12,
            rounded-4. Label color is BRAND/dark `#201E24` 12 Medium
            leading 21 — same weight family as "Select profiles" so the
            two chrome affordances book-end the chip group with matching
            visual weight. */}
        {isEditMode && selectedProfiles.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center justify-center h-[32px] min-w-[32px] px-[12px] rounded-[4px] hover:bg-[rgba(32,30,36,0.05)] transition-colors flex-shrink-0 whitespace-nowrap"
            style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
          >
            <span
              className="text-[12px] font-medium text-[#201E24]"
              style={{ lineHeight: '21px' }}
            >
              Clear all
            </span>
          </button>
        )}

        {/* Off-screen measurement row. Renders every candidate chip (plus
            the overflow + clear-all pieces) so the layout effect above
            can read real pixel widths and decide how many chips the
            visible row can afford. `aria-hidden` + `pointer-events-none`
            + `visibility: hidden` keep it out of AT and hit-testing;
            absolute positioning keeps it out of layout. */}
        <div
          ref={measureRowRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 flex items-center gap-2"
          style={{ visibility: 'hidden', whiteSpace: 'nowrap' }}
        >
          {chipCandidates.map(profile => (
            <div key={profile.id} data-m="chip">
              <ProfileChip
                profile={profile}
                isEditing={isEditMode}
                onRemove={isEditMode ? () => undefined : undefined}
              />
            </div>
          ))}
          {selectedProfiles.length > 0 && (
            <div data-m="overflow">
              {/* Measurement variant — passes the FULL selectedProfiles
                  set as a worst-case width budget (the chip width
                  varies with `+N` digit count and the presence of the
                  warning icon, both of which depend on which profiles
                  end up overflowed).  Reading width from the worst-case
                  shape guarantees the layout effect never picks a
                  fitting count that would actually clip the trigger. */}
              <OverflowChip
                profiles={selectedProfiles}
                onRemoveProfile={isEditMode ? () => undefined : undefined}
                onClear={isEditMode ? () => undefined : undefined}
              />
            </div>
          )}
          {isEditMode && selectedProfiles.length > 0 && (
            // Mirror the visible "Clear all" pill geometry exactly so the
            // measurement pass reserves the right width budget — the
            // visible variant is a 32-px pill, not a bare text node.
            <div
              data-m="clear"
              className="flex items-center justify-center h-[32px] min-w-[32px] px-[12px] rounded-[4px] flex-shrink-0 whitespace-nowrap"
              style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              <span
                className="text-[12px] font-medium text-[#201E24]"
                style={{ lineHeight: '21px' }}
              >
                Clear all
              </span>
            </div>
          )}
        </div>
      </div>

      <button
        className="flex items-center gap-[6px] h-[32px] px-[12px] bg-white border border-[#D2D2D3] rounded-[4px] hover:bg-[#F3F3F4] transition-colors flex-shrink-0 ml-auto"
      >
        <IconCalendar size={16} color="#4C4B4F" />
        <span
          className="text-[#201E24] whitespace-nowrap"
          style={{ fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif' }}
        >
          11 Mar, 2026 - 25 Mar, 2026
        </span>
        <IconChevronDown size={16} color="#4C4B4F" />
      </button>
    </div>
  );
}
