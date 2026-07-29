/**
 * Barcode generation for products without a manufacturer barcode.
 *
 * Generated codes are 13 digits, shaped like a standard EAN-13 number so
 * they remain compatible with any symbology (we render Code-128, but the
 * digit string itself is also valid EAN-13 if ever needed):
 *
 *   [prefix "20"] [10 random digits] [check digit]
 *
 * The "20"-"29" prefix range is reserved by GS1 for internal / in-store
 * use, so these codes will never collide with a real manufacturer barcode
 * a product might also carry.
 */

const INTERNAL_PREFIX = "20";

function computeEAN13CheckDigit(twelveDigits: string): number {
  const digits = twelveDigits.split("").map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

/** Produces one candidate barcode. Not guaranteed unique on its own. */
export function generateBarcodeCandidate(): string {
  const base = INTERNAL_PREFIX + randomDigits(10); // 12 digits
  const check = computeEAN13CheckDigit(base);
  return base + String(check); // 13 digits
}

/**
 * Generates a barcode guaranteed not to collide with any existing product,
 * by repeatedly generating candidates and checking them against the
 * caller-supplied `isTaken` lookup (typically a DB query).
 */
export async function generateUniqueBarcode(
  isTaken: (code: string) => Promise<boolean>,
  maxAttempts = 25
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateBarcodeCandidate();
    // eslint-disable-next-line no-await-in-loop
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }
  throw new Error("Could not generate a unique barcode after several attempts. Please try again.");
}
