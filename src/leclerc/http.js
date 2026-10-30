// -----------------------------------------------------------------------------
// The one HTTP helper of the integration: a JSON GET with a timeout.
//
// Node 22+ ships `fetch`: no dependency. The function is injectable everywhere
// it is used, so the tests never touch the network.
// -----------------------------------------------------------------------------

const TIMEOUT_MS = 20_000;

/** An HTTP answer that is not a 2xx. `status` tells a missing dataset (404) apart. */
export class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} from ${new URL(url).host}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * @param {string} url
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<any>} the parsed body
 */
export async function getJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: { accept: 'application/json', 'user-agent': 'gladys-eleclerc' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new HttpError(response.status, url);
  }
  return response.json();
}
