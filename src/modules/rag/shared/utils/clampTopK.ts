/**
 * This function restricts a numeric value to a safe,
 * predefined boundary and defined at the top of this file.
 * Prevents the value from becoming too high or too low
 * Staying within a range
 */

export const MIN_TOP_K = 1;
export const MAX_TOP_K = 20;
export const DEFAULT_TOP_K = 10;

export function clampTop(value: number | undefined): number {
  const topK = value ?? DEFAULT_TOP_K;
  return Math.max(MIN_TOP_K, Math.min(topK, MAX_TOP_K));
}
