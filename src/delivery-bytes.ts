import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export function checkDeliveryAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Delivery check cancelled.", "AbortError");
}

const table = Uint32Array.from({ length: 256 }, (_, i) => {
  for (let bit = 0; bit < 8; bit++) i = (i >>> 1) ^ (i & 1 ? 0xedb88320 : 0);
  return i;
});

// Read at most one 2 MiB chunk at a time. WebM is already compressed.
export async function deliveryDigest(blob: Blob, signal?: AbortSignal, onBytes?: (count: number) => void) {
  const hash = sha256.create();
  let crc = 0xffffffff;
  for (let offset = 0; offset < blob.size; offset += 2 * 1024 * 1024) {
    checkDeliveryAbort(signal);
    const bytes = new Uint8Array(await blob.slice(offset, offset + 2 * 1024 * 1024).arrayBuffer());
    checkDeliveryAbort(signal);
    hash.update(bytes);
    for (const byte of bytes) crc = (crc >>> 8) ^ table[(crc ^ byte) & 255];
    onBytes?.(bytes.length);
  }
  checkDeliveryAbort(signal);
  return { sha256: bytesToHex(hash.digest()), crc32: (crc ^ 0xffffffff) >>> 0 };
}
