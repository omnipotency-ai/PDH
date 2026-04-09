export function normalizeBarcode(input: string): string {
  return input.trim().replace(/\D/g, "");
}

export function isValidGtinBarcode(barcode: string): boolean {
  if (!/^\d+$/.test(barcode)) return false;
  if (![8, 12, 13, 14].includes(barcode.length)) return false;

  const digits = barcode.split("").map((digit) => Number(digit));
  const checkDigit = digits.pop();
  if (checkDigit === undefined) return false;

  let sum = 0;
  for (let i = digits.length - 1, weight = 3; i >= 0; i -= 1, weight = weight === 3 ? 1 : 3) {
    sum += digits[i] * weight;
  }

  return (10 - (sum % 10)) % 10 === checkDigit;
}
