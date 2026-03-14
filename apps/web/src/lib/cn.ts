import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS class names safely.
 *
 * Combines clsx (conditional classes, arrays, objects) with tailwind-merge
 * (conflict resolution — later classes win, e.g. `p-4 p-2` → `p-2`).
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-primary text-white', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
