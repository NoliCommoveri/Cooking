import { register } from 'node:module';
register('./sql-hooks.js', import.meta.url);

// Nothing cooked on the Sabbath counts (plan §6.18), and the tests cook "now".
// A run that lands on a Saturday (UTC, the tests' default calendar) runs as
// if it were the Friday before, so the suite passes on any day.
const RealDate = Date;
if (new RealDate().getUTCDay() === 6) {
  const shift = 24 * 60 * 60 * 1000;
  globalThis.Date = class extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(RealDate.now() - shift); }
    static now() { return RealDate.now() - shift; }
  };
}
