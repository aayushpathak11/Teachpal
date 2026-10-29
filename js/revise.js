import { esc, h, shuffle } from "./util.js";
import { audioRevision } from "./audio-revision.js";
import { mapExercise } from "./conceptmap.js";
import { newsSection } from "./news.js";

const PAUSES = [3, 5, 8];

// Concept-map chains that are due: a chain becomes available the day after all
// its reels' quizzes are done, then spaces out by how well it was rebuilt.
export function mapsDue(ctx, now = Date.now()) {
  const out = [];
  for (const ch of ctx.chapters)
    for (const chain of ch.maps?.chains || []) {
      const key = `${ch.id}/${chain.id}`;
      const st = ctx.state.maps?.[key];
      let due = st?.due;
      if (due == null) {
        const ats = chain.reelIds.map((r) => ctx.state.reels[`${ch.id}/${r}`]?.quiz?.at);
        if (ats.every(Boolean)) due = Math.max(...ats) + 20 * 36e5;
      }
      if (due != null && due <= now) out.push({ ch, chain, due });
    }
  return out.sort((a, b) => a.due - b.due);
}

// Distractors for a chain's word bank: steps from the chapter's other chains.
export const mapPool = (ch, chain) => (ch.maps?.chains || []).filter((c) => c.id !== chain.id).flatMap((c) => c.steps);

export function renderRevise(ctx) {
  const page = h(`<div class="page"><h2>Revise</h2><p class="sub">Audio recall, concept maps, and linking the news to what you've learned.</p><div class="body"></div></div>`);
  const body = page.querySelector(".body");
  const S = ctx.state.settings;
  let scope = ctx.chapters.some((c) => c.id === S.reviseChapter) ? S.reviseChapter : ctx.chapter.id;

  const home = () => {
    const ch = ctx.chapters.find((c) => c.id === scope);
    const now = Date.now();
    const dueRefs = ctx.allCardRefs().filter((r) => ctx.state.cards[r.key]?.due <= now);
    const chRefs = ctx.cardRefs(ch);
    const pause = PAUSES.includes(S.recallPause) ? S.recallPause : 5;
    body.replaceChildren(
      h(`<div>
        <div class="box practice-start">
          <label for="revise-scope">Chapter</label>
          <select id="revise-scope">${ctx.chapters.map((c, i) => `<option value="${esc(c.id)}" ${c.id === scope ? "selected" : ""}>${i + 1}. ${esc(c.title)}</option>`).join("")}</select>
        </div>

        <div class="section-h">🎧 Audio revision</div>
        <div class="box practice-start">
          <p class="prompt">Hands-free recall for a walk or a commute: hear a question, answer it in your head during the pause, then hear the answer.</p>
          <label for="recall-pause">Thinking pause</label>
          <select id="recall-pause">${PAUSES.map((p) => `<option value="${p}" ${p === pause ? "selected" : ""}>${p} seconds</option>`).join("")}</select>
          ${dueRefs.length ? `<button class="btn primary big" data-audio="due">Cards due now (${dueRefs.length}, all chapters)</button>` : ""}
          <button class="btn ${dueRefs.length ? "" : "primary"} big" data-audio="chapter">Whole chapter (${chRefs.length} cards)</button>
        </div>

        <div class="section-h">🗺️ Concept maps</div>
        <div class="reel-list maps"></div>

        <div class="section-h">📰 News → concepts</div>
        <div class="news-slot"></div>
      </div>`)
    );
    body.querySelector("#revise-scope").onchange = (e) => {
      scope = S.reviseChapter = e.target.value;
      ctx.commit({ quiet: true });
      home();
    };
    body.querySelector("#recall-pause").onchange = (e) => {
      S.recallPause = +e.target.value;
      ctx.commit({ quiet: true });
    };
    body.querySelectorAll("[data-audio]").forEach(
      (b) =>
        (b.onclick = () => {
          const due = b.dataset.audio === "due";
          openAudio({
            refs: due ? dueRefs.sort((a, b) => ctx.state.cards[a.key].due - ctx.state.cards[b.key].due) : shuffle(chRefs),
            title: due ? "Cards due now" : ch.title,
            grade: due ? (key, g) => ctx.gradeCard(key, g) : null,
          });
        })
    );

    const maps = body.querySelector(".maps");
    const chains = ch.maps?.chains || [];
    if (!chains.length) maps.append(h(`<p class="prompt">No concept maps for this chapter yet.</p>`));
    const dueKeys = new Set(mapsDue(ctx).map((d) => `${d.ch.id}/${d.chain.id}`));
    for (const chain of chains) {
      const st = ctx.state.maps?.[`${ch.id}/${chain.id}`];
      const pill = dueKeys.has(`${ch.id}/${chain.id}`)
        ? `<span class="pill no">due</span>`
        : st
          ? `<span class="pill ${st.lastScore >= 8 ? "ok" : "na"}">${st.lastScore}/10</span>`
          : `<span class="pill na">new</span>`;
      const row = h(`<button class="reel-row"><span class="e">🗺️</span><span class="t">${esc(chain.title)}<small>${chain.steps.length} steps</small></span>${pill}</button>`);
      row.onclick = () => openMap(ch, chain);
      maps.append(row);
    }
    body.querySelector(".news-slot").replaceWith(newsSection(ctx));
  };

  const openAudio = (opts) => {
    body.replaceChildren(audioRevision(ctx, { ...opts, pauseSec: PAUSES.includes(S.recallPause) ? S.recallPause : 5, onExit: home }));
    page.scrollTop = 0;
  };

  const openMap = (ch, chain) => {
    body.replaceChildren(
      mapExercise(chain, {
        pool: mapPool(ch, chain),
        onScore: (score) => ctx.recordMap(ch.id, chain.id, score),
        onDone: home,
        onRewatch: (reelId) => ctx.openReel(ch.id, reelId),
      })
    );
    page.scrollTop = 0;
  };

  home();
  return page;
}
