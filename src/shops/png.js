// -----------------------------------------------------------------------------
// A minimal PNG writer: one 8-bit grayscale image whose rows are all the same
// (a barcode). node:zlib does the compression; the CRC-32 of the chunks is
// computed here, `zlib.crc32` being missing from the first Node 22 releases.
// -----------------------------------------------------------------------------

import { deflateSync } from 'node:zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * @param {number} width
 * @param {number} height
 * @param {Buffer} row the `width` gray levels of one row, repeated `height` times
 * @returns {Buffer} the PNG file
 */
export function encodePng(width, height, row) {
  if (row.length !== width) {
    throw new Error(`a row holds ${row.length} pixels, ${width} expected`);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 0; // grayscale
  // [10..12] = 0: deflate, adaptive filtering, no interlace.
  const line = Buffer.concat([Buffer.from([0]), row]); // filter "None"
  const raw = Buffer.concat(Array(height).fill(line));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
