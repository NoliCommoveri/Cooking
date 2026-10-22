// Voice step control (plan §6.12): "next," "back," and "again" in cook mode,
// with the browser's own speech recognition. Shown only where the device has
// it (checked by feature, not by browser name), and only for a family whose
// parent turned it on. The browser usually sends the audio to Google, so when
// the connection drops, voice pauses quietly and the buttons keep working.
// Listening stops while a step is read aloud, so the app doesn't hear itself.
const Rec = () => window.SpeechRecognition || window.webkitSpeechRecognition;
export const voiceSupported = () => Boolean(Rec());

const WORDS = { next: 'next', back: 'back', previous: 'back', again: 'again', repeat: 'again' };
const WORD_RE = /\b(next|back|previous|again|repeat)\b/g;

// The command in what was heard, from the recognizer's best guess down: the
// last command word wins, so "no wait, back" goes back.
export function parseCommand(alternatives) {
  for (const heard of alternatives) {
    const words = String(heard).toLowerCase().match(WORD_RE);
    if (words) return WORDS[words.at(-1)];
  }
  return null;
}

// While the connection is down, how often to try listening again.
const RETRY_MS = 20000;

// onCommand('next' | 'back' | 'again'). onStatus('off' | 'listening' |
// 'speaking' | 'offline' | 'blocked').
export function createVoice({ onCommand, onStatus }) {
  let rec = null, wanted = false, speaking = false, failed = null, retry = null, status = 'off';
  const set = (s) => { if (s !== status) { status = s; onStatus(s); } };

  function listen() {
    clearTimeout(retry);
    if (!wanted || speaking || rec) return;
    if (navigator.onLine === false) return set('offline');
    const r = new (Rec())();
    r.lang = 'en-US';
    r.continuous = true;
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const cmd = parseCommand(Array.from(e.results[i], (a) => a.transcript));
        if (cmd) onCommand(cmd);
      }
    };
    r.onerror = (e) => { failed = e.error; };
    r.onend = () => {
      if (rec === r) rec = null;
      const why = failed;
      failed = null;
      if (!wanted) return;
      if (why === 'not-allowed' || why === 'service-not-allowed') { wanted = false; return set('blocked'); }
      if (why === 'network') { set('offline'); retry = setTimeout(listen, RETRY_MS); return; }
      // Recognition stops on its own after a quiet spell; start it again.
      if (!speaking) setTimeout(listen, 250);
    };
    rec = r;
    try { r.start(); set('listening'); } catch { rec = null; retry = setTimeout(listen, 1000); }
  }

  function halt() {
    const r = rec;
    rec = null;
    try { r?.abort(); } catch { /* already stopped */ }
  }

  const onOnline = () => { if (wanted && status === 'offline') listen(); };
  const onOffline = () => { if (wanted && !speaking) { halt(); set('offline'); } };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return {
    get on() { return wanted; },
    start() { wanted = true; listen(); },
    stop() {
      wanted = false;
      clearTimeout(retry);
      halt();
      try { speechSynthesis.cancel(); } catch { /* nothing reading */ }
      speaking = false;
      set('off');
    },
    // Reads text aloud with listening paused. Where the device can't speak, it's skipped.
    say(text) {
      if (!('speechSynthesis' in window)) return;
      speaking = true;
      halt();
      set('speaking');
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      const done = () => { speaking = false; if (wanted) listen(); else set('off'); };
      u.onend = done;
      u.onerror = done;
      speechSynthesis.speak(u);
    },
    destroy() {
      this.stop();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    },
  };
}
