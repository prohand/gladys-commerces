// Test helpers: a fake clock and an in-memory storage of the card balances.
// Nothing here touches the disk or the network.

/** A storage of the balances, kept in the test. */
export function memoryStorage(balances = {}) {
  const storage = {
    balances: structuredClone(balances),
    async load() {
      return structuredClone(storage.balances);
    },
    async save(next) {
      storage.balances = structuredClone(next);
    },
  };
  return storage;
}

/** A clock the test moves. */
export function fakeClock(iso) {
  let now = new Date(iso);
  const clock = () => new Date(now);
  clock.set = (value) => {
    now = new Date(value);
  };
  clock.advance = (minutes) => {
    now = new Date(now.getTime() + minutes * 60_000);
  };
  return clock;
}

/** Two valid card numbers: an EAN-13 and a number Code 128 carries. */
export const MARIE = '2900123456785';
export const PAUL = '123456789012345';
