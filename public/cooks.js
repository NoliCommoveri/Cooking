// Saving cooks to the family's account (plan §1, §8.4). The player hands each
// change of a cook to saveCook(); it goes into an outbox on this device first,
// then to the server. A cook that can't reach the server stays in the outbox
// and is sent when the app next starts or the connection comes back, so a
// Wi-Fi drop at Plate it doesn't lose the cook. Each send carries the whole
// cook under an id made here, so sending it twice saves it once.
// Reflections (§3) wait in their own outbox and go after the cooks, since a
// reflection needs its cook saved first.
const OUTBOX = 'cpr.outbox';
const REFLECT_BOX = 'cpr.reflections';

function readBox(key = OUTBOX) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}
function writeBox(box, key = OUTBOX) {
  try { localStorage.setItem(key, JSON.stringify(box)); } catch { /* private mode: sent now or not at all */ }
}

let sending = null, again = false;

async function sendAll() {
  do {
    again = false;
    for (const [id, body] of Object.entries(readBox())) {
      let res;
      try {
        // The device's calendar decides the Sabbath (§6.18), so the offset goes too.
        res = await fetch(`/api/attempts/${id}?tz=${new Date().getTimezoneOffset()}`, {
          method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin',
          // A dropped connection can leave a request hanging; give up and retry later.
          signal: AbortSignal.timeout(15000),
        });
      } catch { return; } // offline: tried again when the connection comes back
      // Kept for a retry: server trouble, signed out (sent once a parent logs
      // back in), or a kid's own login that can't send another profile's cook
      // (sent once a session that can logs in, §8.3a).
      if (res.status >= 500 || res.status === 401 || res.status === 403) continue;
      // Saved, or refused for good (a retry can't fix a 400). Dropped only
      // if it hasn't changed since this send began.
      const box = readBox();
      if (JSON.stringify(box[id]) === JSON.stringify(body)) { delete box[id]; writeBox(box); }
    }
    for (const [key, body] of Object.entries(readBox(REFLECT_BOX))) {
      const [cookId] = key.split(':');
      let res;
      try {
        res = await fetch(`/api/attempts/${cookId}/reflection`, {
          method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin',
          signal: AbortSignal.timeout(15000),
        });
      } catch { return; }
      if (res.status >= 500 || res.status === 401 || res.status === 403) continue;
      // Not found while its cook still waits to go up: try again after it.
      if (res.status === 404 && readBox()[cookId]) continue;
      const box = readBox(REFLECT_BOX);
      if (JSON.stringify(box[key]) === JSON.stringify(body)) { delete box[key]; writeBox(box, REFLECT_BOX); }
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

// One profile's reflection on a cook, kept until it reaches the server.
export function saveReflection(cookId, body) {
  const box = readBox(REFLECT_BOX);
  box[`${cookId}:${body.profile_id}`] = body;
  writeBox(box, REFLECT_BOX);
  return flushCooks();
}

window.addEventListener('online', () => { flushCooks(); });
