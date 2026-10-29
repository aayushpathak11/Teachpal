// Thin wrapper around the Claude API for the pipeline: streaming, server-side
// fallback, pause_turn resumption for web search, JSON extraction with one retry,
// and a running token/cost tally.
import Anthropic from "@anthropic-ai/sdk";

// USD per million tokens (cache writes are 1.25x input). Web search: $10 / 1000.
const PRICES = { "claude-opus-5-5": { in: 4, out: 20, cacheWrite: 5, cacheRead: 0.2 } };

export function extractJSON(text) {
  const t = text.replace(/```(?:json)?/g, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end < start) throw new SyntaxError("no JSON object in response");
  return JSON.parse(t.slice(start, end + 1));
}

export class ClaudeClient {
  constructor({ model = "claude-opus-5-5", effort = "high", log = console.log } = {}) {
    this.client = new Anthropic();
    this.model = model;
    this.effort = effort;
    this.log = log;
    this.usage = { calls: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, searches: 0 };
  }

  tally(u) {
    this.usage.calls++;
    this.usage.input += u.input_tokens || 0;
    this.usage.output += u.output_tokens || 0;
    this.usage.cacheWrite += u.cache_creation_input_tokens || 0;
    this.usage.cacheRead += u.cache_read_input_tokens || 0;
    this.usage.searches += u.server_tool_use?.web_search_requests || 0;
  }

  costUSD() {
    const p = PRICES[this.model];
    if (!p) return null;
    const u = this.usage;
    return (u.input * p.in + u.output * p.out + u.cacheWrite * p.cacheWrite + u.cacheRead * p.cacheRead) / 1e6 + u.searches * 0.01;
  }

  async once({ system, content, tools, label }) {
    const messages = [{ role: "user", content }];
    for (let turn = 0; turn < 6; turn++) {
      const stream = this.client.beta.messages.stream({
        model: this.model,
        max_tokens: 64000,
        thinking: { type: "adaptive" },
        output_config: { effort: this.effort },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        messages,
        ...(tools ? { tools } : {}),
      });
      const msg = await stream.finalMessage();
      this.tally(msg.usage);
      if (msg.stop_reason === "refusal") throw new Error(`${label}: request declined (${msg.stop_details?.category || "refusal"})`);
      if (msg.stop_reason === "max_tokens") throw new Error(`${label}: output hit max_tokens; use a smaller batch`);
      if (msg.stop_reason === "pause_turn") {
        // Server-side tool loop paused: send the turn back so it resumes.
        messages.push({ role: "assistant", content: msg.content });
        continue;
      }
      const texts = msg.content.filter((b) => b.type === "text").map((b) => b.text);
      return { last: texts.at(-1) || "", all: texts.join("\n") };
    }
    throw new Error(`${label}: too many pause_turn continuations`);
  }

  // Ask for a JSON object; `check` returns a list of problems (empty = OK).
  async json({ system, content, tools, label, check = () => [] }) {
    let note = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      const c = note ? [...content, { type: "text", text: note }] : content;
      const t0 = Date.now();
      const out = await this.once({ system, content: c, tools, label });
      let data, problems;
      try {
        try {
          data = extractJSON(out.last);
        } catch {
          data = extractJSON(out.all);
        }
        problems = check(data);
      } catch (e) {
        problems = [`response was not valid JSON (${e.message})`];
      }
      this.log(`  · ${label} ${problems.length ? "✗" : "✓"} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      if (!problems.length) return data;
      note = `Your previous answer had these problems. Fix them and answer again with only the JSON object:\n- ${problems.slice(0, 20).join("\n- ")}`;
    }
    throw new Error(`${label}: invalid output after retry`);
  }
}

// The PDF goes first and is marked for caching, so every stage after the first
// reads it from cache instead of paying for it again.
export const pdfBlock = (b64) => ({
  type: "document",
  source: { type: "base64", media_type: "application/pdf", data: b64 },
  cache_control: { type: "ephemeral" },
});
