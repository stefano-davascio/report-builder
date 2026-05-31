'use client';

import type { ComponentType } from 'react';
import { MockProfile } from '@/lib/profile-data';
import { ModuleNetworks } from './ModuleNetworks';
import {
  FlagAU,
  FlagBR,
  FlagCA,
  FlagDE,
  FlagFR,
  FlagGB,
  FlagIN,
  FlagIT,
  FlagJP,
  FlagUS,
} from '@/components/icons/FlagIcons';

// Flag column typing — the imported `Flag*` components accept a `large`
// prop (rendered larger for rows 1-3).  Using a real `ComponentType`
// type instead of `() => JSX.Element` does two things at once:
//   1. matches the actual call signature `<Flag large={isTopThree} />`,
//   2. avoids referencing the deprecated global `JSX` namespace, which
//      no longer resolves under React 19's typings (production build
//      was failing here with "Cannot find namespace 'JSX'").
interface CountryRow {
  rank: number;
  Flag: ComponentType<{ large?: boolean; title?: string }>;
  country: string;
  percentage: number;
}

const COUNTRY_DATA: CountryRow[] = [
  { rank: 1,  Flag: FlagUS, country: 'United States',   percentage: 25 },
  { rank: 2,  Flag: FlagGB, country: 'United Kingdom',  percentage: 20 },
  { rank: 3,  Flag: FlagIN, country: 'India',           percentage: 15 },
  { rank: 4,  Flag: FlagBR, country: 'Brazil',          percentage: 10 },
  { rank: 5,  Flag: FlagDE, country: 'Germany',         percentage: 8  },
  { rank: 6,  Flag: FlagIT, country: 'Italy',           percentage: 7  },
  { rank: 7,  Flag: FlagFR, country: 'France',          percentage: 5  },
  { rank: 8,  Flag: FlagCA, country: 'Canada',          percentage: 4  },
  { rank: 9,  Flag: FlagJP, country: 'Japan',           percentage: 2.9 },
  { rank: 10, Flag: FlagAU, country: 'Australia',       percentage: 0.1 },
];

interface AudienceByCountryModuleProps {
  profiles?: MockProfile[];
}

// Row layout — grid with fixed tracks so every cell aligns on the same
// column lines across all 10 rows:
//   • rank:       24 px column, right-aligned
//   • flag:       36 px column, flags render at 24×18 base or 36×27
//                 (`large`) for rows 1–3; the 36 px rail keeps the
//                 country column's left edge stable across all rows
//   • country:    1fr, left-aligned, truncates
//   • percent:    auto, right-aligned, tabular-nums for stable digit widths
const ROW_GRID = 'grid-cols-[24px_36px_1fr_auto]';

export function AudienceByCountryModule({ profiles = [] }: AudienceByCountryModuleProps) {
  return (
    <div className="flex flex-col w-full h-full">
      {/* Rows — Figma 1233:350519. Rows flex-grow to distribute the
          card's vertical space evenly so the list ends flush with the
          footer (no large empty gap below). Top 3 rows render a larger
          36×27 flag; row 1 (United States) bumps text to 16/24 per
          Figma. Last row omits the divider so the list doesn't read as
          "unfinished". */}
      <div className="flex flex-col flex-1 min-h-0">
        {COUNTRY_DATA.map((row, idx) => {
          const isFirst = row.rank === 1;
          const isTopThree = row.rank <= 3;
          const isLast = idx === COUNTRY_DATA.length - 1;
          const { Flag } = row;
          const textSize = isFirst ? 'text-[16px] leading-[24px]' : 'text-[14px] leading-[22px]';
          return (
            <div
              key={row.rank}
              className={[
                'grid items-center gap-[12px] flex-1 min-h-0',
                ROW_GRID,
                isLast ? '' : 'border-b border-[#E8E8E9]',
              ].join(' ')}
            >
              <span
                className={[
                  'text-[14px] text-[#201E24] leading-[22px] text-right tabular-nums',
                  isFirst ? 'font-medium' : 'font-normal',
                ].join(' ')}
              >
                {row.rank}.
              </span>
              <span className="inline-flex items-center justify-center">
                <Flag large={isTopThree} />
              </span>
              <span
                className={[
                  'text-[#201E24] truncate min-w-0',
                  textSize,
                  isFirst ? 'font-medium' : 'font-normal',
                ].join(' ')}
              >
                {row.country}
              </span>
              <span
                className={[
                  'text-[#201E24] text-right tabular-nums',
                  textSize,
                  isFirst ? 'font-medium' : 'font-normal',
                ].join(' ')}
              >
                {row.percentage < 1 ? row.percentage.toFixed(1) : row.percentage}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer — Figma 1233:350747: footnote on the left, Module
          Networks cluster on the right.  `mt-[16px]` matches the
          standard footer rhythm every other chart/carousel module
          uses, giving the footnote breathing room from the list's
          last row instead of crowding it. */}
      <div className="flex items-center justify-between gap-4 mt-[16px]">
        <p
          className="text-[#79787B]"
          style={{
            fontFamily: 'IBM Plex Sans, sans-serif',
            fontSize: 12,
            lineHeight: '16px',
            letterSpacing: '0.3px',
          }}
        >
          * Lifetime view across all published videos within the selected period.
        </p>
        <ModuleNetworks profiles={profiles} />
      </div>
    </div>
  );
}
