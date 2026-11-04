import { checkDeliveryAbort } from "./delivery-bytes";

export const MAX_ZIP_ENTRIES = 242;
const DIRECTORY_LIMIT = 1024 * 1024;
const MAX32 = 0xffffffff;
const localTag = 0x04034b50, directoryTag = 0x02014b50, endTag = 0x06054b50;
const asciiName = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/;
const encoder = new TextEncoder(), decoder = new TextDecoder("utf-8", { fatal: true });
export interface StoredEntry { name: string; blob: Blob; crc32: number }

function header(length: number, tag: number) {
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, tag, true);
  return { bytes, view };
}
function invalid(): never {
  throw new Error("This ZIP does not match ChipToons’ delivery archive format. Choose the complete ZIP created by the delivery studio.");
}

// Deliberately supports only classic, single-disk, uncompressed ZIP entries.
// Blob composition preserves the original video bytes without recompression.
export function storedZip(entries: StoredEntry[], maxBytes: number) {
  if (!entries.length || entries.length > MAX_ZIP_ENTRIES ||
      new Set(entries.map(entry => entry.name)).size !== entries.length) return invalid();
  const files: BlobPart[] = [], directory: BlobPart[] = [];
  let offset = 0, directoryBytes = 0;
  for (const { name, blob, crc32 } of entries) {
    if (!asciiName.test(name) || !Number.isInteger(crc32) || crc32 < 0 || crc32 > MAX32 || blob.size > MAX32)
      return invalid();
    const key = encoder.encode(name);
    const local = header(30, localTag);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(12, 0x21, true);
    local.view.setUint32(14, crc32, true);
    local.view.setUint32(18, blob.size, true);
    local.view.setUint32(22, blob.size, true);
    local.view.setUint16(26, key.length, true);
    const central = header(46, directoryTag);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(14, 0x21, true);
    central.view.setUint32(16, crc32, true);
    central.view.setUint32(20, blob.size, true);
    central.view.setUint32(24, blob.size, true);
    central.view.setUint16(28, key.length, true);
    central.view.setUint32(42, offset, true);
    files.push(local.bytes, key, blob);
    directory.push(central.bytes, key);
    offset += 30 + key.length + blob.size;
    directoryBytes += 46 + key.length;
    if (offset + directoryBytes + 22 > Math.min(MAX32, maxBytes))
      throw new Error("The ZIP exceeds this device’s delivery limit. Keep the separate parts and download the complete order and checksum manifest.");
  }
  const end = header(22, endTag);
  end.view.setUint16(8, entries.length, true);
  end.view.setUint16(10, entries.length, true);
  end.view.setUint32(12, directoryBytes, true);
  end.view.setUint32(16, offset, true);
  return new Blob([...files, ...directory, end.bytes], { type: "application/zip" });
}

export async function readStoredZip(blob: Blob, maxBytes: number, signal?: AbortSignal) {
  if (blob.size > maxBytes) throw new Error("This ZIP is larger than the safe checking limit on this device. Check it on a larger screen or keep the separate parts.");
  if (blob.size < 22) return invalid();
  const bytesAt = async (from: number, to: number) => {
    checkDeliveryAbort(signal);
    const bytes = await blob.slice(from, to).arrayBuffer();
    checkDeliveryAbort(signal);
    return new DataView(bytes);
  };
  const end = await bytesAt(blob.size - 22, blob.size);
  if (end.getUint32(0, true) !== endTag || end.getUint32(4, true) !== 0 || end.getUint16(20, true) !== 0) return invalid();
  const count = end.getUint16(10, true), length = end.getUint32(12, true), offset = end.getUint32(16, true);
  if (!count || count > MAX_ZIP_ENTRIES || end.getUint16(8, true) !== count ||
      length > DIRECTORY_LIMIT || offset + length + 22 !== blob.size) return invalid();
  const central = await bytesAt(offset, offset + length);
  const entries = new Map<string, StoredEntry>();
  let cursor = 0, localOffset = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > length || central.getUint32(cursor, true) !== directoryTag ||
        central.getUint32(cursor + 8, true) !== 0 || central.getUint16(cursor + 34, true) !== 0 ||
        central.getUint32(cursor + 30, true) !== 0) return invalid();
    const crc32 = central.getUint32(cursor + 16, true), size = central.getUint32(cursor + 24, true),
      nameLength = central.getUint16(cursor + 28, true);
    if (!nameLength || nameLength > 101 || cursor + 46 + nameLength > length ||
        size !== central.getUint32(cursor + 20, true) ||
        central.getUint32(cursor + 42, true) !== localOffset) return invalid();
    const name = decoder.decode(new Uint8Array(central.buffer, cursor + 46, nameLength));
    const start = localOffset + 30 + nameLength;
    if (!asciiName.test(name) || entries.has(name) || start + size > offset) return invalid();
    const local = await bytesAt(localOffset, start);
    if (local.getUint32(0, true) !== localTag || local.getUint32(6, true) !== 0 ||
        local.getUint32(14, true) !== crc32 || local.getUint32(18, true) !== size ||
        local.getUint32(22, true) !== size || local.getUint16(26, true) !== nameLength ||
        local.getUint16(28, true) !== 0 ||
        decoder.decode(new Uint8Array(local.buffer, 30)) !== name) return invalid();
    entries.set(name, { name, crc32, blob: blob.slice(start, start + size) });
    cursor += 46 + nameLength;
    localOffset = start + size;
  }
  if (cursor !== length || localOffset !== offset) return invalid();
  return entries;
}
