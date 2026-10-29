// Voice assignment for recorded narration (see docs/voice.json).

// Small seeded PRNG (mulberry32) so the assignment is random-looking but stable.
function rng(seedText) {
  let a = [...seedText].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761), 1779033703) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function assignVoices(chapterId, count, ids) {
  const rand = rng(chapterId);
  const out = [];
  while (out.length < count) {
    const deck = [...ids];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    if (out.length && deck[0] === out.at(-1)) deck.push(deck.shift()); // no repeat across decks
    out.push(...deck);
  }
  return out.slice(0, count);
}
