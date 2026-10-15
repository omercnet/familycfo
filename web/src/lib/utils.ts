import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// font sizes added in index.css; without this `text-kpi` reads as a color and cn() drops it next
// to `text-positive` (2xs and md already parse as sizes)
const twMerge = extendTailwindMerge({ extend: { theme: { text: ['kpi'] } } });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
