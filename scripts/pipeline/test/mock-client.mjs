// Offline stand-in for ClaudeClient, used only by the pipeline test (--mock).
// It replays chapter 1 with two planted defects (a wrong quiz answer and a false
// "Beyond NCERT" date) so the test can confirm review → fact-check → revise fixes them.
import { readFileSync } from "node:fs";

const ch1 = JSON.parse(readFileSync(new URL("../../../content/eco11-ch01.json", import.meta.url), "utf8"));
const original = new Map(ch1.reels.map((r) => [r.id, r]));
const clone = (x) => JSON.parse(JSON.stringify(x));

export class MockClient {
  constructor() {
    this.usage = { calls: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, searches: 0 };
    this.coverageCalls = 0;
    this.factIds = new Map();
  }
  costUSD() {
    return null;
  }

  withFacts(r) {
    return { ...clone(r), factIds: this.factIds.get(r.id) || [] };
  }

  respond({ stage, ids = [], reels = [], claims = [] }) {
    if (stage === "plan") {
      let n = 0;
      const facts = [];
      const planReels = ch1.reels.map((r) => {
        const fids = r.cards.map((c) => {
          facts.push({ id: `F${++n}`, section: r.section, text: c.a, importance: "high" });
          return `F${n}`;
        });
        this.factIds.set(r.id, fids);
        return { id: r.id, title: r.title, section: r.section, factIds: fids, angle: "" };
      });
      return { title: ch1.title, chapterNumber: 1, sections: [], facts, reels: planReels };
    }
    if (stage === "write") {
      return {
        reels: ids.map((id) => {
          const r = this.withFacts(original.get(id));
          if (id === "zamindari-revenue") r.quiz.answer = 0; // planted defect 1
          if (id === "foreign-trade") r.beyond = "The Suez Canal opened in 1859."; // planted defect 2
          return r;
        }),
      };
    }
    if (stage === "review") {
      const issues = [];
      for (const r of reels) {
        if (r.quiz.answer !== original.get(r.id).quiz.answer)
          issues.push({ reelId: r.id, where: "quiz", severity: "blocker", type: "quiz", problem: "answer index points to a wrong option", fix: "Set answer to the revenue-deadline option." });
        if (r.id === "railways") issues.push({ reelId: r.id, where: "scene 2", severity: "minor", type: "clarity", problem: "could mention the station names", fix: "Optional polish." });
      }
      return { issues, scores: reels.map((r) => ({ reelId: r.id, accuracy: 5, clarity: 4, engagement: 4 })) };
    }
    if (stage === "coverage") {
      this.coverageCalls++;
      return { missing: this.coverageCalls === 1 ? [{ factId: "F1", reelId: "why-1947", note: "planted gap" }] : [] };
    }
    if (stage === "factcheck") {
      return {
        claims: claims.map((c) =>
          c.claim.includes("1859")
            ? { id: c.id, verdict: "false", correction: "The Suez Canal opened in 1869.", sources: ["https://example.org/suez"] }
            : { id: c.id, verdict: "supported", correction: "", sources: [] }
        ),
      };
    }
    if (stage === "revise") return { reels: ids.map((id) => this.withFacts(original.get(id))) };
    throw new Error(`mock: unknown stage ${stage}`);
  }

  async json({ label, check = () => [], meta }) {
    this.usage.calls++;
    const data = this.respond(meta);
    const problems = check(data);
    if (problems.length) throw new Error(`mock ${label} failed its own check: ${problems.join("; ")}`);
    return data;
  }
}
