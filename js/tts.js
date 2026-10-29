// Narration via the browser's built-in speech synthesis. Text is spoken sentence
// by sentence (avoids Chrome cutting off long utterances and lets captions follow
// along). When muted or unsupported, a timer paced at speaking speed stands in.

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
let voice = null;
let preferredURI = null;
let token = 0;
let finishCurrent = null;
const voiceListeners = new Set();

// Browsers ship both robotic and natural-sounding voices; rank so the natural
// ones win: Edge "Online (Natural)", Apple "Enhanced/Premium", Google network voices.
export function voiceScore(v) {
  const n = v.name;
  let s = 0;
  if (/natural|neural/i.test(n)) s += 60;
  if (/premium/i.test(n)) s += 55;
  if (/enhanced/i.test(n)) s += 45;
  if (/^google/i.test(n)) s += 35;
  if (/online/i.test(n)) s += 20;
  if (v.localService === false) s += 10;
  if (/en[-_]IN/i.test(v.lang) || /india/i.test(n)) s += 25;
  else if (/en[-_](GB|US|AU|IE)/i.test(v.lang)) s += 8;
  if (/espeak|compact|desktop|zira|david|mark|fred|albert|bad news|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|bahh|junior|ralph|kathy|princess/i.test(n)) s -= 60;
  return s;
}

export function englishVoices() {
  if (!synth) return [];
  return synth
    .getVoices()
    .filter((v) => /^en/i.test(v.lang))
    .sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
}

function pickVoice() {
  const list = englishVoices();
  voice = list.find((v) => v.voiceURI === preferredURI) || list[0] || null;
  voiceListeners.forEach((fn) => fn());
}
if (synth) {
  pickVoice();
  synth.addEventListener?.("voiceschanged", pickVoice);
}

export const canSpeak = () => !!synth && !!voice;
export const currentVoice = () => voice;
export const onVoicesChanged = (fn) => voiceListeners.add(fn);

export function setPreferredVoice(uri) {
  preferredURI = uri || null;
  pickVoice();
}

// Rewrite symbols and abbreviations the way a person would read them aloud.
export function forSpeech(text) {
  return text
    .replace(/(\d)\s*[–-]\s*(\d)/g, "$1 to $2")
    .replace(/<\s*(\d)/g, "less than $1")
    .replace(/>\s*(\d)/g, "more than $1")
    .replace(/~\s*(\d)/g, "about $1")
    .replace(/(\d)\s*%/g, "$1 percent")
    .replace(/₹\s*(\d[\d,.]*)(\s+(?:crore|lakh|thousand|million|billion))?/gi, "$1$2 rupees")
    .replace(/\s*÷\s*/g, " divided by ")
    .replace(/\s+=\s+/g, " equals ")
    .replace(/\be\.g\./gi, "for example")
    .replace(/\bi\.e\./gi, "that is")
    .replace(/\bvs\.?\s/gi, "versus ")
    .replace(/\bWW ?II\b/g, "World War Two")
    .replace(/§\s*/g, "section ")
    .replace(/\s*[—–]\s*/g, ", ");
}

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
      const u = new SpeechSynthesisUtterance(forSpeech(s));
      try {
        u.voice = voice;
      } catch {} // an engine that rejects the voice still speaks with its default
      u.lang = voice.lang;
      // Natural voices already speak at a good pace; slightly slower helps the others.
      u.rate = rate * (voiceScore(voice) >= 40 ? 1 : 0.95);
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
