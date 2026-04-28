'use client';

import { Fragment, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  IconClose,
  IconCalendar,
  IconChevronDown,
  IconPlusCircle,
  IconWarning,
  IconDanger,
  IconHourglass,
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
import { ProfileAvatar } from './ProfileAvatar';
import { PlatformIcon } from './PlatformIcon';
import { ProfileChip } from './ProfileChip';

// ─── Figma asset URLs ─────────────────────────────────────────────────────────
const IMG_SELECT_PROFILES_ICON  = 'http://localhost:3845/assets/897588cb30948d74ad070363601bec6e29ae593b.svg';
const IMG_SEARCH_ICON           = 'http://localhost:3845/assets/97aebb7d65a8e6707ebce6ebab90e5f2a97b53aa.svg';
// Checkbox assets (from Figma frame 1093-85941)
const IMG_CHECKBOX_BG_ACTIVE    = 'http://localhost:3845/assets/271c6860ffbfe466d6906e4d591b0ba04ea6c6e2.svg';
const IMG_CHECKBOX_CHECK        = 'http://localhost:3845/assets/c99fa007b16cb45666681730a1b342cff2bf317d.svg';
const IMG_CHECKBOX_DASH         = 'http://localhost:3845/assets/36c01422bda49d4ec2b3a8e82e11e566a1400733.svg';
const IMG_CHECKBOX_BG_UNCHECKED = 'http://localhost:3845/assets/e173eb50022d1aabfddb92bcd9b55ad9e4ec0da8.svg';

// ─── Checkbox ─────────────────────────────────────────────────────────────────
function Checkbox({ state }: { state: 'checked' | 'unchecked' | 'indeterminate' }) {
  const bgSrc   = state === 'unchecked' ? IMG_CHECKBOX_BG_UNCHECKED : IMG_CHECKBOX_BG_ACTIVE;
  const iconSrc = state === 'checked' ? IMG_CHECKBOX_CHECK : state === 'indeterminate' ? IMG_CHECKBOX_DASH : null;
  return (
    <div className="relative size-[24px] flex-shrink-0">
      <div className="absolute inset-[12.5%]">
        <img alt="" className="absolute inset-0 block max-w-none w-full h-full" src={bgSrc} />
      </div>
      {iconSrc && (
        <div className="absolute inset-[25%]">
          <img alt="" className="absolute inset-0 block max-w-none w-full h-full" src={iconSrc} />
        </div>
      )}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
/**
 * Status pill — Figma node 1285:58914 (Tags).
 *
 * Hard geometry specs from the design:
 *   • container — `flex items-center justify-end`, `h-[20px]`, `p-[4px]`,
 *                 `gap-[4px]`, `rounded-[4px]`. The 20-px hard cap is
 *                 explicit on every variant; without it the 14-px icon
 *                 would push the badge to 22 px (14 + 4 + 4 chrome).
 *   • icon slot — `size-[14px]`, `overflow-clip` so the 14-px glyph is
 *                 centered inside the 12-px inner content row (20 − 4 − 4)
 *                 with the 1-px overshoot cropped top/bottom, matching
 *                 Figma's render exactly.
 *   • label     — IBM Plex Sans 12 / 18, regular weight.
 *
 * Variant tokens (from Figma "Tags" frame):
 *   • Reconnect  — bg #FCE7E9 (DANGER/danger--tint_90)   fg #CE091C (DANGER/danger--shade_10)   icon `danger`
 *   • Permission — bg #FCE7E9 (DANGER/danger--tint_90)   fg #CE091C (DANGER/danger--shade_10)   icon `warning`
 *   • Syncing    — bg #FFF3CD (WARNING/warning--tint_80) fg #806104 (WARNING/warning--shade_50) icon `hourglass`
 *
 * Icons come from `SendiIcons` (not raw asset-server SVGs) so stroke
 * weight, color, and tile alignment stay in lock-step with the rest of
 * the icon library.
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
      className="flex h-[20px] items-center justify-end gap-[4px] p-[4px] rounded-[4px] flex-shrink-0"
      style={{ backgroundColor: config.bg }}
    >
      <span className="flex items-center justify-center overflow-hidden flex-shrink-0">
        <Icon size={14} color={config.color} />
      </span>
      <span
        className="text-[12px] leading-[18px] whitespace-nowrap"
        style={{ color: config.color, fontFamily: 'IBM Plex Sans, sans-serif' }}
      >
        {config.label}
      </span>
    </div>
  );
}

// ─── Overflow chip ────────────────────────────────────────────────────────────
/**
 * Overflow chip per Figma 1109:103254 (view) / 1026:39263 (edit). Shape is
 * the same `h-[32px] bg-[#F3F3F4] rounded-[4px]` as a profile chip; only
 * the × button is gated. In view mode the chip reads as read-only "+N",
 * `text-[#363439]` (matches the surrounding chip text); in edit mode the
 * count shifts to `text-[#4C4B4F]` medium + a clear-all affordance.
 */
function OverflowChip({ count, onClear }: { count: number; onClear?: () => void }) {
  return (
    <div className="flex items-center gap-[8px] h-[32px] pl-[6px] pr-[2px] py-[4px] bg-[#F3F3F4] border border-[#F3F3F4] rounded-[4px] flex-shrink-0">
      {/* Count label — Figma 1373:371094 specs `text-[#363439]` 12 Regular
          leading 22 in BOTH modes; the edit-mode chrome is carried by the
          trailing × button, not by bumping the count to medium-weight. */}
      <span
        className="text-[12px] text-[#363439] whitespace-nowrap"
        style={{ lineHeight: '22px', fontFamily: 'IBM Plex Sans, sans-serif' }}
      >
        +{count}
      </span>
      {onClear && (
        <button
          onClick={onClear}
          className="flex items-center justify-center w-[24px] h-[24px] rounded-[4px] hover:bg-[#E8E8E9] transition-colors"
          aria-label="Clear all profiles"
        >
          <IconClose size={16} color="#79787B" />
        </button>
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
            <img
              src={IMG_SEARCH_ICON}
              alt=""
              style={{ width: 16, height: 16, display: 'block' }}
            />
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

      <div
        className="overflow-y-auto flex flex-col px-[8px] pb-[8px]"
        style={{ maxHeight: 368, gap: 12 }}
      >
        {filtered.map((group, idx) => {
          const allSel  = group.profiles.every(p => selectedIds.has(p.id));
          const someSel = group.profiles.some(p => selectedIds.has(p.id));
          const groupState: 'checked' | 'unchecked' | 'indeterminate' =
            allSel ? 'checked' : someSel ? 'indeterminate' : 'unchecked';

          return (
            <Fragment key={group.platform}>
              {idx > 0 && (
                // 1 px platform divider per Figma 1232:348891 (Line8).
                // The parent's `gap: 12` provides the 12 px breathing room
                // above and below the line — the divider is its own flex
                // sibling so the gap applies on both sides naturally.
                // `-mx-[8px]` lets the rule extend to the dropdown's inner
                // edge, past the `px-[8px]` content gutter.
                <div className="h-px bg-[#E8E8E9] -mx-[8px] flex-shrink-0" />
              )}
              <div className="flex flex-col">
              <button
                onClick={() => onToggleGroup(group.platform)}
                className="flex items-center gap-[6px] w-full px-[8px] py-[10px] rounded-[4px] hover:bg-[#F3F3F4] transition-colors text-left"
              >
                <div className="flex-shrink-0">
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
                  <button
                    key={profile.id}
                    onClick={() => onToggleProfile(profile.id)}
                    className="flex items-center gap-[6px] w-full pl-[32px] pr-[8px] py-[10px] rounded-[4px] hover:bg-[#F3F3F4] transition-colors text-left"
                  >
                    <div className="flex-shrink-0">
                      <Checkbox state={profileCheckState} />
                    </div>
                    <ProfileAvatar profile={profile} size="S" />
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
}

export function ProfileSelectionBar({
  isEditMode,
  selectedIds,
  onSelectedIdsChange,
}: ProfileSelectionBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
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

  const selectedProfiles = ALL_PROFILES.filter(p => selectedIds.has(p.id));
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
              dropdownOpen
                ? 'border-[#4D36FF] bg-[#F5F3FF]'
                : 'border-[rgba(32,30,36,0.2)] hover:bg-[#F3F3F4]',
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
              groups={PROFILE_GROUPS}
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
            count={hiddenCount}
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
              <OverflowChip
                count={Math.max(1, selectedProfiles.length - chipCandidates.length + 1)}
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
