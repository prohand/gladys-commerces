// -----------------------------------------------------------------------------
// Barcodes of the loyalty cards, drawn as PNG for the dashboard widget, so the
// card can be scanned at the till from a phone.
//
// Two symbologies, chosen from the number itself:
//   - EAN-13, when the number is 13 digits with a valid check digit (the
//     retail standard);
//   - Code 128 otherwise (subset C for an even count of digits, B for the
//     rest), which encodes any card number as is.
//
// No dependency: the modules are computed here, the PNG is written with
// node:zlib (see png.js).
// -----------------------------------------------------------------------------

import { encodePng } from './png.js';

// EAN-13: the L codes of the digits; R is their complement, G the reverse of R.
const EAN_L = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];
const EAN_R = EAN_L.map((code) => [...code].map((bit) => (bit === '0' ? '1' : '0')).join(''));
const EAN_G = EAN_R.map((code) => [...code].reverse().join(''));
// Which of the first six digits use G, from the first digit of the number.
const EAN_PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
];

/** The EAN-13 check digit of the first twelve digits. */
export function ean13CheckDigit(twelve) {
  const sum = [...twelve].reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

export function isEan13(number) {
  return /^\d{13}$/.test(number) && ean13CheckDigit(number.slice(0, 12)) === number[12];
}

/** The 95 modules of an EAN-13, '1' for a bar. */
export function ean13Modules(number) {
  if (!isEan13(number)) {
    throw new Error(`${number} is not an EAN-13`);
  }
  const parity = EAN_PARITY[Number(number[0])];
  const left = [...number.slice(1, 7)]
    .map((digit, i) => (parity[i] === 'L' ? EAN_L : EAN_G)[Number(digit)])
    .join('');
  const right = [...number.slice(7)].map((digit) => EAN_R[Number(digit)]).join('');
  return `101${left}01010${right}101`;
}

// Code 128: bar and space widths of the 107 symbols (103 data values, the
// three start codes, then STOP with its final bar).
export const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212',
  '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221',
  '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221',
  '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321',
  '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131',
  '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131',
  '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111',
  '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242',
  '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311',
  '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]; // prettier-ignore
const START_B = 104;
const START_C = 105;
const STOP = 106;

/** The symbol values of a text in Code 128 (start, data, checksum, stop). */
export function code128Values(text) {
  if (!/^[\x20-\x7e]+$/.test(text)) {
    throw new Error('Code 128 B/C: printable ASCII only');
  }
  const subsetC = /^(\d\d)+$/.test(text);
  const data = subsetC
    ? text.match(/\d\d/g).map(Number)
    : [...text].map((char) => char.charCodeAt(0) - 32);
  const start = subsetC ? START_C : START_B;
  const checksum = data.reduce((sum, value, i) => sum + value * (i + 1), start) % 103;
  return [start, ...data, checksum, STOP];
}

/** The modules of a Code 128, '1' for a bar. */
export function code128Modules(text) {
  return code128Values(text)
    .map((value) =>
      [...CODE128_PATTERNS[value]]
        .map((width, i) => (i % 2 ? '0' : '1').repeat(Number(width)))
        .join(''),
    )
    .join('');
}

/** The modules of the card's barcode, and the symbology chosen. */
export function cardModules(number) {
  return isEan13(number)
    ? { symbology: 'EAN-13', modules: ean13Modules(number) }
    : { symbology: 'Code 128', modules: code128Modules(number) };
}

/**
 * A PNG of the card's barcode: black bars on white, with the quiet zones the
 * scanners need on each side.
 * @param {string} number the card number (digits)
 * @returns {Buffer}
 */
export function barcodePng(number, { moduleWidth = 3, height = 150, quietModules = 12 } = {}) {
  const { modules } = cardModules(number);
  const quiet = '0'.repeat(quietModules);
  const row = Buffer.from(
    [...`${quiet}${modules}${quiet}`].flatMap((bit) =>
      Array(moduleWidth).fill(bit === '1' ? 0 : 255),
    ),
  );
  return encodePng(row.length, height, row);
}
