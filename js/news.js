import { autoGrow, esc, h, relTime, reveal } from "./util.js";
import { askJSON, newsLinkPrompt } from "./ai.js";

// Current-affairs linker. The learner pastes a news item; Claude ties it to the
// lessons they've studied and drafts recall cards, which join the normal
// spaced-repetition reviews (keys "news/<id>/<i>"). Without AI the learner links
// it and writes the card themselves, which is good practice in its own right.

export function newsCardRefs(ctx) {
  return Object.values(ctx.state.news || {})
    .filter((n) => !n.deleted)
    .flatMap((n) => n.cards.map((c, i) => ({ key: `news/${n.id}/${i}`, chapterId: "news", reelId: n.id, reelTitle: n.title, reelEmoji: "📰", q: c.q, a: c.a })));
}

const clip = (s, n) => String(s || "").trim().slice(0, n);

// Keep only what the app can use: real lessons, short cards.
function clean(d, ctx) {
  const reels = new Set(ctx.chapters.flatMap((ch) => ch.reels.map((r) => `${ch.id}/${r.id}`)));
  return {
    title: clip(d.title, 90) || "News item",
    summary: clip(d.summary, 400),
    examAngle: clip(d.examAngle, 300),
    links: (d.links || []).filter((l) => reels.has(`${l.chapterId}/${l.reelId}`)).slice(0, 3).map((l) => ({ chapterId: l.chapterId, reelId: l.reelId, why: clip(l.why, 240) })),
    cards: (d.cards || []).filter((c) => c?.q && c?.a).slice(0, 3).map((c) => ({ q: clip(c.q, 200), a: clip(c.a, 260) })),
  };
}

function lessonName(ctx, chapterId, reelId) {
  const ch = ctx.chapters.find((c) => c.id === chapterId);
  return `${ch?.reels.find((r) => r.id === reelId)?.title || reelId} · ${ch?.title || ""}`;
}

export function newsSection(ctx) {
  const el = h(`
    <div class="news">
      <p class="prompt">Paste a headline or a paragraph from today's news (an RBI or PIB release, a newspaper). It gets linked to the chapters you've studied, and 2–3 recall cards join your reviews.</p>
      <textarea placeholder="e.g. RBI keeps the repo rate unchanged at … ; inflation eases to …"></textarea>
      <button class="btn primary big" data-link disabled>Link to my chapters</button>
      <div class="out"></div>
      <div class="saved"></div>
    </div>`);
  const ta = el.querySelector("textarea");
  const btn = el.querySelector("[data-link]");
  const out = el.querySelector(".out");
  autoGrow(ta);
  ta.addEventListener("input", () => (btn.disabled = ta.value.trim().split(/\s+/).length < 5));

  btn.onclick = async () => {
    const text = ta.value.trim();
    btn.disabled = true;
    ta.blur();
    out.innerHTML = `<div class="box">Linking… (can take up to a minute)</div>`;
    reveal(out);
    const res = await askJSON(newsLinkPrompt(text, ctx.chapters));
    if (res.data && res.data.relevant === false) {
      out.innerHTML = `<div class="box warn">This doesn't seem to connect to the chapters you've studied yet. Try an economy or banking news item.</div>`;
      btn.disabled = false;
      return;
    }
    if (res.data) {
      const d = clean(res.data, ctx);
      if (!d.cards.length) return manual(text, "Claude didn't suggest any cards. Write one yourself:");
      return preview(text, d);
    }
    manual(text, res.error);
  };

  // AI result: show it, and save the cards on confirmation.
  const preview = (text, d) => {
    out.replaceChildren(
      h(`<div class="box news-card">
        <h4>📰 ${esc(d.title)}</h4>
        <p>${esc(d.summary)}</p>
        ${d.links.length ? `<h4>Links to what you studied</h4><div class="reel-list links"></div>` : ""}
        <h4>Recall cards</h4>
        <ul>${d.cards.map((c) => `<li><b>${esc(c.q)}</b><br>${esc(c.a)}</li>`).join("")}</ul>
        ${d.examAngle ? `<p class="prompt">🎯 ${esc(d.examAngle)}</p>` : ""}
        <div class="row"><button class="btn" data-discard>Discard</button><button class="btn primary" data-save>Add ${d.cards.length} cards to reviews</button></div>
      </div>`)
    );
    const links = out.querySelector(".links");
    for (const l of d.links) {
      const row = h(`<button class="reel-row"><span class="e">🔗</span><span class="t">${esc(lessonName(ctx, l.chapterId, l.reelId))}<small>${esc(l.why)}</small></span></button>`);
      row.onclick = () => ctx.openReel(l.chapterId, l.reelId);
      links.append(row);
    }
    out.querySelector("[data-discard]").onclick = () => {
      out.innerHTML = "";
      btn.disabled = false;
    };
    out.querySelector("[data-save]").onclick = () => save({ ...d, text: clip(text, 600) });
  };

  // No AI (or it failed): the learner links it and writes one card.
  const manual = (text, note) => {
    const options = ctx.chapters
      .map((ch) => `<optgroup label="${esc(ch.title)}">${ch.reels.map((r) => `<option value="${esc(ch.id)}/${esc(r.id)}">${esc(r.title)}</option>`).join("")}</optgroup>`)
      .join("");
    out.replaceChildren(
      h(`<div class="box practice-start">
        ${note ? `<div class="box warn">${esc(note)}</div>` : ""}
        <h4>Link it yourself</h4>
        <label for="news-reel">Which lesson does it connect to?</label>
        <select id="news-reel">${options}</select>
        <label for="news-q">A question about it</label>
        <textarea id="news-q" placeholder="e.g. What did RBI do with the repo rate in this policy?"></textarea>
        <label for="news-a">The answer, and the link to the lesson</label>
        <textarea id="news-a" placeholder="e.g. Kept it unchanged, to keep inflation near the 4% target…"></textarea>
        <button class="btn primary" data-save disabled>Add card to reviews</button>
      </div>`)
    );
    const q = out.querySelector("#news-q");
    const a = out.querySelector("#news-a");
    const save1 = out.querySelector("[data-save]");
    [q, a].forEach((t) => {
      autoGrow(t);
      t.addEventListener("input", () => (save1.disabled = !q.value.trim() || !a.value.trim()));
    });
    save1.onclick = () => {
      const [chapterId, reelId] = out.querySelector("#news-reel").value.split("/");
      save({ title: clip(text.split(/[.\n]/)[0], 90), summary: "", examAngle: "", text: clip(text, 600), links: [{ chapterId, reelId, why: "" }], cards: [{ q: clip(q.value, 200), a: clip(a.value, 260) }] });
    };
  };

  const save = (item) => {
    ctx.saveNews(item);
    ta.value = "";
    out.replaceChildren(h(`<div class="why">✅ Saved. The cards come up in Today from tomorrow, spaced out like the rest.</div>`));
    listSaved();
  };

  const listSaved = () => {
    const items = Object.values(ctx.state.news || {})
      .filter((n) => !n.deleted)
      .sort((a, b) => b.at - a.at);
    const wrap = el.querySelector(".saved");
    wrap.replaceChildren();
    if (!items.length) return;
    wrap.append(h(`<div class="list-h">Saved news (${items.length})</div>`));
    for (const n of items) {
      const row = h(`
        <div class="box news-item">
          <div class="row"><b class="grow">📰 ${esc(n.title)}</b><button class="link" data-del>Delete</button></div>
          <small class="prompt">${relTime(Date.now() - n.at)} ago · ${n.cards.length} card${n.cards.length > 1 ? "s" : ""}${n.links.length ? ` · ${esc(n.links.map((l) => lessonName(ctx, l.chapterId, l.reelId).split(" · ")[0]).join(", "))}` : ""}</small>
        </div>`);
      const del = row.querySelector("[data-del]");
      del.onclick = () => {
        if (!del.dataset.armed) {
          del.dataset.armed = "1";
          del.textContent = "Tap again to delete";
          return;
        }
        ctx.deleteNews(n.id);
        listSaved();
      };
      wrap.append(row);
    }
  };
  listSaved();
  return el;
}
