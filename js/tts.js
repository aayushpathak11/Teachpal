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

// Short stable hash of a narration text, used to tell whether a recording is stale.
export function textHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function splitSentences(text) {
  return text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) || [text];
}

export function estimateMs(text, rate = 1) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.round((words / (2.6 * rate)) * 1000 + 350);
}

// One shared <audio> element for recorded narration. It is unlocked inside the
// Start tap, so later scenes can play without another tap on iPhone.
let audioEl = null;
let loadedFor = null; // which recording the <audio> element holds
const blobs = new Map(); // recordings loaded whole, for servers without range requests
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
function player() {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = "auto";
  }
  return audioEl;
}

export function unlock() {
  // Must run inside a user gesture so mobile browsers allow later speech.
  const a = player();
  a.src = SILENCE;
  loadedFor = null;
  a.play().catch(() => {});
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
  if (audioEl && !audioEl.paused) audioEl.pause();
}

// Plays one recorded segment ({src, start, end, sents}). Resolves like speak():
// true if cancelled, false when finished; "failed" if the audio couldn't play,
// so the caller can fall back to the device voice.
export function playClip(clip, { rate = 1, muted = false, onSentence } = {}) {
  cancel();
  const my = token;
  return new Promise((resolve) => {
    let done = false;
    const timers = [];
    const a = player();
    const finish = (result) => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      a.removeEventListener("timeupdate", tick);
      if (finishCurrent === finish) finishCurrent = null;
      if (result !== true && !a.paused) a.pause();
      resolve(result);
    };
    finishCurrent = finish;
    let shown = -1;
    const tick = () => {
      const t = a.currentTime;
      const k = clip.sents.reduce((n, s, i) => (t + 0.05 >= s ? i : n), 0);
      if (k !== shown) onSentence?.((shown = k));
      if (t >= clip.end) finish(false);
    };

    if (muted) {
      clip.sents.forEach((s, i) => timers.push(setTimeout(() => my === token && onSentence?.(i), ((s - clip.start) * 1000) / rate)));
      timers.push(setTimeout(() => finish(false), ((clip.end - clip.start) * 1000) / rate));
      return;
    }

    const begin = () => {
      if (done) return;
      // Some servers can't jump into the middle of a file; then load it whole.
      if (!canSeek(a, clip.start)) return viaBlob();
      try {
        a.currentTime = clip.start;
      } catch {
        return finish("failed");
      }
      a.playbackRate = rate;
      a.addEventListener("timeupdate", tick);
      a.play().catch(() => finish("failed"));
      // Backstop in case timeupdate stops (backgrounded tab, stalled network).
      timers.push(setTimeout(() => finish(false), ((clip.end - clip.start) * 1000) / rate + 6000));
    };
    const load = (url) => {
      loadedFor = clip.src;
      a.src = url;
      a.addEventListener("loadedmetadata", begin, { once: true });
      a.addEventListener("error", () => finish("failed"), { once: true });
      timers.push(setTimeout(() => a.readyState < 1 && finish("failed"), 15000));
      a.load();
    };
    let triedBlob = false;
    const viaBlob = async () => {
      if (triedBlob) return finish("failed");
      triedBlob = true;
      try {
        let url = blobs.get(clip.src);
        if (!url) {
          const res = await fetch(clip.src);
          if (!res.ok) return finish("failed");
          url = URL.createObjectURL(await res.blob());
          blobs.set(clip.src, url);
        }
        if (!done) load(url);
      } catch {
        finish("failed");
      }
    };
    if (loadedFor === clip.src && a.readyState >= 1) begin();
    else load(blobs.get(clip.src) || clip.src);
  });
}

function canSeek(a, t) {
  if (t < 0.5) return true;
  for (let i = 0; i < a.seekable.length; i++) if (a.seekable.start(i) <= t && a.seekable.end(i) >= t) return true;
  return false;
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
