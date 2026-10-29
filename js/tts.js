// Narration via the browser's built-in speech synthesis. Text is spoken sentence
// by sentence (avoids Chrome cutting off long utterances and lets captions follow
// along). When muted or unsupported, a timer paced at speaking speed stands in.

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
let voice = null;
let token = 0;
let finishCurrent = null;

function pickVoice() {
  if (!synth) return;
  const voices = synth.getVoices();
  const en = voices.filter((v) => /^en/i.test(v.lang));
  voice =
    en.find((v) => /en[-_]IN/i.test(v.lang)) ||
    en.find((v) => /india/i.test(v.name)) ||
    en.find((v) => /en[-_]GB/i.test(v.lang)) ||
    en.find((v) => v.default) ||
    en[0] ||
    null;
}
if (synth) {
  pickVoice();
  synth.addEventListener?.("voiceschanged", pickVoice);
}

export const canSpeak = () => !!synth && !!voice;

export function splitSentences(text) {
  return text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) || [text];
}

export function estimateMs(text, rate = 1) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.round((words / (2.6 * rate)) * 1000 + 350);
}

export function unlock() {
  // Must run inside a user gesture so mobile browsers allow later speech.
  if (!synth) return;
  pickVoice();
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  synth.speak(u);
}

export function cancel() {
  token++;
  const f = finishCurrent;
  finishCurrent = null;
  f?.(true);
  synth?.cancel();
}

// Resolves to true if cancelled, false if it finished normally.
export function speak(text, { rate = 1, muted = false, onSentence } = {}) {
  cancel();
  const my = token;
  const sentences = splitSentences(text);
  const timers = [];

  return new Promise((resolve) => {
    let done = false;
    const finish = (cancelled) => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      if (finishCurrent === finish) finishCurrent = null;
      resolve(cancelled);
    };
    finishCurrent = finish;

    const useTimer = () => {
      let t = 0;
      sentences.forEach((s, i) => {
        timers.push(setTimeout(() => my === token && onSentence?.(i), t));
        t += estimateMs(s, rate);
      });
      timers.push(setTimeout(() => finish(false), t));
    };

    if (muted || !canSpeak()) return useTimer();

    synth.cancel();
    sentences.forEach((s, i) => {
      const u = new SpeechSynthesisUtterance(s);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = rate;
      u.onstart = () => my === token && onSentence?.(i);
      if (i === sentences.length - 1) u.onend = () => finish(my !== token);
      u.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return finish(true);
        if (!done && my === token) {
          // Speech failed mid-way (e.g. no audio permission): fall back to timing.
          synth.cancel();
          timers.forEach(clearTimeout);
          useTimer();
        }
      };
      synth.speak(u);
    });
    // Safety net: some engines never fire onend.
    timers.push(setTimeout(() => finish(false), estimateMs(text, rate) * 2.2 + 4000));
  });
}
