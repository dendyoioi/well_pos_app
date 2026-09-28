import * as crypto from 'crypto';

/**
 * Standard DNS Namespace UUID (RFC 4122)
 */
export const WELL_POS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Generates a deterministic RFC 4122 Version 5 UUID using SHA-1.
 * Ensures 100% repeatable identifiers across migration runs and dry-runs.
 *
 * @param name The entity key or string identifier (e.g., `${productId}:variant`)
 * @param namespace The namespace UUID string
 */
export function generateDeterministicUuid(name: string, namespace: string = WELL_POS_NAMESPACE): string {
  // Convert namespace UUID to bytes
  const cleanNamespace = namespace.replace(/-/g, '');
  const namespaceBytes = Buffer.from(cleanNamespace, 'hex');

  // SHA-1 hash of namespace + name bytes
  const hash = crypto.createHash('sha1');
  hash.update(namespaceBytes);
  hash.update(name, 'utf8');
  const buffer = hash.digest();

  // Set Version 5 (0101 in bits 4-7 of time_hi_and_version)
  buffer[6] = (buffer[6] & 0x0f) | 0x50;
  // Set RFC 4122 Variant (10 in bits 6-7 of clock_seq_hi_and_reserved)
  buffer[8] = (buffer[8] & 0x3f) | 0x80;

  // Format as standard UUID string (8-4-4-4-12)
  const hex = buffer.toString('hex', 0, 16);
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join('-');
}
