import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Collision-proof unique id.
 *
 * Rationale: our module ids were previously built as
 * `mod-${def.id}-${Date.now()}`, which collides when two adds/drops land in
 * the same millisecond — e.g. a `draggable` button that fires both `click`
 * and the grid's `onDrop` at drag-end, or Turbopack HMR re-mounting a tree
 * inside a single tick. Colliding ids produced React's "two children with
 * the same key" warning and duplicate renders of the same ModuleCard.
 *
 * `crypto.randomUUID()` is native in all modern browsers and Node ≥ 16.17.
 * Guarded for older runtimes (and SSR environments where `crypto` is
 * missing) with a Date+Math.random fallback.
 */
export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
