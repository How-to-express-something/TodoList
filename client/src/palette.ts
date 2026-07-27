/** Distinct, pleasant colors for category tags */
export const CATEGORY_PALETTE = [
  '#e06c75', // soft red
  '#61afef', // soft blue
  '#98c379', // soft green
  '#d19a66', // warm orange
  '#c678dd', // soft purple
  '#56b6c2', // teal
  '#e5c07b', // warm yellow
  '#be5046', // maroon
  '#7ec8a0', // mint
  '#f0a0a0', // pink
  '#a0c4ff', // light blue
  '#b0d0a0', // sage
  '#d0b0a0', // tan
  '#c0a0d0', // lavender
  '#a0d0d0', // cyan
];

/** Pick the first color from the palette not already used by existing categories */
export function pickUnusedColor(existingColors: (string | null)[]): string {
  const used = new Set(existingColors.filter(Boolean));
  for (const c of CATEGORY_PALETTE) {
    if (!used.has(c)) return c;
  }
  // If all used, cycle back to the first one based on count
  return CATEGORY_PALETTE[used.size % CATEGORY_PALETTE.length];
}
