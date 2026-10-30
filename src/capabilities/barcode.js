// -----------------------------------------------------------------------------
// "Is this product recalled?" — one barcode checked against the whole
// RappelConso register, whatever the retailer and the age of the recall.
//
// Reached from three places: the "Check a barcode" button of the
// Configuration screen, the `check_barcode` scene action and the form of the
// product recalls widget.
// -----------------------------------------------------------------------------

import { localize, pick } from '../i18n.js';
import { findRecallsByBarcode, normalizeBarcode } from '../leclerc/recalls.js';
import { title } from '../leclerc/recallFeed.js';

/**
 * @param {string} barcode as typed: spaces and dashes are ignored
 * @param {{ find?: typeof findRecallsByBarcode }} [options]
 * @returns {Promise<{ barcode: string, recalls: object[] }>}
 */
export async function checkBarcode(barcode, { find = findRecallsByBarcode } = {}) {
  const digits = String(barcode ?? '').replace(/\D/g, '');
  if (!normalizeBarcode(digits)) {
    throw new Error(
      `"${barcode}" is not a barcode: type the 8 or 13 digits under the bars of the product.`,
    );
  }
  return { barcode: digits, recalls: await find(digits) };
}

/** The answer in one sentence per language. `length` bounds it (a toast holds 200). */
export function describeCheck({ barcode, recalls }, length = 1000) {
  const recall = recalls[0];
  return localize((language) => {
    const text = recall
      ? pick(language, {
          en: `RECALLED: ${title(recall)}. ${recall.reason}`,
          fr: `RAPPELÉ : ${title(recall)}. ${recall.reason}`,
          de: `ZURÜCKGERUFEN: ${title(recall)}. ${recall.reason}`,
          es: `RETIRADO: ${title(recall)}. ${recall.reason}`,
        })
      : pick(language, {
          en: `No recall found for ${barcode}.`,
          fr: `Aucun rappel trouvé pour ${barcode}.`,
          de: `Kein Rückruf für ${barcode} gefunden.`,
          es: `Ningún aviso encontrado para ${barcode}.`,
        });
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
  });
}
