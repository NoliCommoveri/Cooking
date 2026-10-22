// Saving cooks to the family's account (plan §1, §8.4). The player hands each
// change of a cook to saveCook(); it goes into an outbox on this device first,
// then to the server. A cook that can't reach the server stays in the outbox
// and is sent when the app next starts or the connection comes back, so a
// Wi-Fi drop at Plate it doesn't lose the cook. Each send carries the whole
// cook under an id made here, so sending it twice saves it once.
const OUTBOX = 'cpr.outbox';

function readBox() {
  try { return JSON.parse(localStorage.getItem(OUTBOX)) || {}; } catch { return {}; }
}
function writeBox(box) {
  try { localStorage.setItem(OUTBOX, JSON.stringify(box)); } catch { /* private mode: sent now or not at all */ }
}

let sending = null, again = false;

async function sendAll() {
  do {
    again = false;
    for (const [id, body] of Object.entries(readBox())) {
      let res;
      try {
        res = await fetch(`/api/attempts/${id}`, {
          method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin',
          // A dropped connection can leave a request hanging; give up and retry later.
          signal: AbortSignal.timeout(15000),
        });
      } catch { return; } // offline: tried again when the connection comes back
      // Kept for a retry: server trouble, or signed out (sent once a parent logs back in).
      if (res.status >= 500 || res.status === 401) continue;
      // Saved, or refused for good (a retry can't fix a 400). Dropped only
      // if it hasn't changed since this send began.
      const box = readBox();
      if (JSON.stringify(box[id]) === JSON.stringify(body)) { delete box[id]; writeBox(box); }
    }
  } while (again);
}

// One send at a time. A change made during a send gets one more pass after it.
export function flushCooks() {
  if (sending) { again = true; return sending; }
  sending = sendAll().finally(() => { sending = null; });
  return sending;
}

export function saveCook(id, body) {
  const box = readBox();
  box[id] = body;
  writeBox(box);
  return flushCooks();
}

window.addEventListener('online', () => { flushCooks(); });
