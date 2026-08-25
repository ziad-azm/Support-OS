import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes, last-wins on conflicts. Every primitive uses this. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
