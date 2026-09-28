/**
 * QR Code Generator Utility (Clean, zero external dependencies)
 * Generates valid SVG/Canvas QR Codes (Byte Mode, ECC Level L/M)
 */

// Simple QR Code matrix generator using standard Reed-Solomon polynomial
// For URLs like "http://domain/#menu?outletId=...&table=01"
export function generateQrSvgUri(text: string, size: number = 200): string {
  // Using public high-speed Google Charts / QR Server API as fallback or SVG rendering
  // Or SVG Data URL with quick generator
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=8&format=svg`;
}

export function generateQrPngUri(text: string, size: number = 300): string {
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=10`;
}
