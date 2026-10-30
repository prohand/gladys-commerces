import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import {
  barcodePng,
  cardModules,
  CODE128_PATTERNS,
  code128Modules,
  code128Values,
  ean13CheckDigit,
  ean13Modules,
  isEan13,
} from '../src/shops/barcode.js';
import { crc32 } from '../src/shops/png.js';

// Reference modules produced by the python-barcode library, independently of
// this code.
const REFERENCE = {
  4006381333931:
    '10100011010100111010111101111010001001011001101010100001010000101000010111010010000101100110101',
  2900123456785:
    '10100010110001101010011101100110010011010000101010101110010011101010000100010010010001001110101',
  123456789012:
    '11010011100101100111001000101100011100010110110000101001101111011010110011100111010110001100011101011',
  'ABC-12':
    '11010010000101000110001000101100010001000110100110111001001110011011001110010110001010001100011101011',
};

test('EAN-13: check digit and modules, as the reference library draws them', () => {
  assert.equal(ean13CheckDigit('400638133393'), '1');
  assert.equal(isEan13('4006381333931'), true);
  assert.equal(isEan13('4006381333932'), false);
  assert.equal(ean13Modules('4006381333931'), REFERENCE['4006381333931']);
  assert.equal(ean13Modules('2900123456785'), REFERENCE['2900123456785']);
});

test('Code 128: subset C for pairs of digits, B otherwise, as the reference draws them', () => {
  assert.equal(code128Modules('123456789012'), REFERENCE['123456789012']);
  assert.equal(code128Modules('ABC-12'), REFERENCE['ABC-12']);
  assert.deepEqual(code128Values('1234'), [105, 12, 34, 82, 106]);
  assert.throws(() => code128Values('é'), /printable ASCII/);
});

test('every Code 128 symbol is 11 modules, three bars of even total width', () => {
  // The structural rules of the symbology: a typo in the table breaks one.
  const symbols = CODE128_PATTERNS.slice(0, 106);
  assert.equal(new Set(symbols).size, 106);
  for (const pattern of symbols) {
    const widths = [...pattern].map(Number);
    assert.equal(
      widths.reduce((a, b) => a + b),
      11,
      pattern,
    );
    assert.equal((widths[0] + widths[2] + widths[4]) % 2, 0, pattern);
  }
  assert.equal(CODE128_PATTERNS[106], '2331112');
});

test('a card gets an EAN-13 when its number is one, Code 128 otherwise', () => {
  assert.equal(cardModules('2900123456785').symbology, 'EAN-13');
  assert.equal(cardModules('2900123456786').symbology, 'Code 128');
  assert.equal(cardModules('123456789012345').symbology, 'Code 128');
});

test('the PNG is a valid grayscale image of the modules', () => {
  const png = barcodePng('2900123456785', { moduleWidth: 2, height: 10, quietModules: 5 });
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.equal(width, (95 + 10) * 2);
  assert.equal(height, 10);
  // Each chunk's CRC covers its type and data.
  let offset = 8;
  const chunks = {};
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const body = png.subarray(offset + 4, offset + 8 + length);
    assert.equal(png.readUInt32BE(offset + 8 + length), crc32(body));
    chunks[body.subarray(0, 4).toString()] = body.subarray(4);
    offset += 12 + length;
  }
  const raw = inflateSync(chunks.IDAT);
  const firstRow = raw.subarray(1, 1 + width);
  const bits = [...firstRow]
    .filter((_, i) => i % 2 === 0)
    .map((gray) => (gray === 0 ? '1' : '0'))
    .join('');
  assert.equal(bits, `00000${REFERENCE['2900123456785']}00000`);
  // A widget image is 300 KB at most.
  assert.ok(barcodePng('123456789012345678').length < 300 * 1024);
});
