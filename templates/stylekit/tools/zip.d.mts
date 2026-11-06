// Types for zip.mjs (the Style Kit's zip reader / writer, shared with the app's import).
export interface ZipEntry { name: string; data: Buffer }
export interface ZipLimits { files?: number; fileBytes?: number; totalBytes?: number }
/** CRC-32 of a buffer. */
export function crc32(buf: Uint8Array): number;
/** The files of a zip (folders left out). Throws an Error with code 'CZ_ZIP_REFUSED' and a plain message on zip-slip
 *  names, symlinks, encrypted / duplicate entries, zip64, unknown compression, damage, or archives over the limits. */
export function readZip(buf: Buffer | Uint8Array, limits?: ZipLimits): ZipEntry[];
/** A zip of the given files (deflate or stored, UTF-8 names). Throws on an unsafe name. */
export function writeZip(files: { name: string; data: Buffer | Uint8Array | string }[], opts?: { date?: Date }): Buffer;
