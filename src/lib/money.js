/**
 * Money comparison in integer cents.
 *
 * Summing two-decimal amounts in binary floating point overshoots: four
 * expenses against a ₱500 limit can total 500.00000000000006, which reads as
 * over budget and renders "Over by ₱0.00". Comparing rounded cents removes the
 * whole class of problem.
 */
export function cents(value) {
  return Math.round((Number(value) || 0) * 100)
}

/** a > b, in cents. */
export function isOver(a, b) {
  return cents(a) > cents(b)
}

/** Round a computed total to two decimals, killing accumulated float dust. */
export function round2(value) {
  return cents(value) / 100
}
