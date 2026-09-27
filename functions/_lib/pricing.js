// Prices come straight from js/data.js — the same definitions the booking
// screen displays — so what the customer sees and what Stripe charges can't
// drift apart. Totals are still recomputed here from option keys rather than
// trusting any amount sent by the client.
import { EXTRA_OPTIONS, PHOTOGRAPHER_PAYOUT_RATE } from '../../js/data.js';

export { EXTRA_OPTIONS, PHOTOGRAPHER_PAYOUT_RATE };

export function optionsTotalFor(keys) {
  const selected = new Set(keys || []);
  return EXTRA_OPTIONS.filter((o) => selected.has(o.key)).reduce((sum, o) => sum + o.price, 0);
}
