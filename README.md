# TeachPal

A study app that turns one textbook chapter into a scrollable feed of short narrated **reels**. Each reel ends with a **quiz**, recall cards are **mixed into the feed**, and a **spaced-repetition** review queue brings ideas back right before you'd forget them.

The first chapter loaded is NCERT Class 11 *Indian Economic Development*, Ch. 1, **Indian Economy on the Eve of Independence**: 17 reels, 64 scenes and 43 recall cards, written for RBI Grade B preparation.

## Why it's built this way

| Learning-science principle | Where it shows up |
|---|---|
| **Retrieval practice** (testing beats re-reading) | Every reel ends with a question you answer before scrolling on; recall cards ask you to produce the answer before revealing it |
| **Spaced repetition** | Cards are scheduled with an SM-2 style algorithm (10 min → 1 d → 3 d → …); missed quiz questions bring their cards back the same day |
| **Interleaving** | Every 3 reels, a recall break pulls a card from an *earlier* reel |
| **Dual coding** | Each narrated sentence is paired with an animated visual (flows, stats, bars, timelines, comparisons) |
| **Elaboration and concrete examples** | Narration explains *why*, with Indian examples; a "Go deeper" panel adds context from outside the book |
| **Honesty about sources** | Anything not from NCERT is tagged **Beyond NCERT**, so you know what the book says versus what's extra |

## Run it

```bash
npm start            # serves the app at http://localhost:5173
```

No build step and no dependencies are needed to run the app. To use it on your phone, open `http://<your-computer's-LAN-IP>:5173` while both devices are on the same Wi-Fi. You can also host the folder on any static host (for example GitHub Pages); over https it installs as an app and works offline.

**Narration** uses your device's built-in text-to-speech. It prefers an Indian English voice when one is installed. On Android, install the English (India) voice under *Settings → Text-to-speech*. If speech isn't available, or you mute it, the reels still advance at reading speed with captions.

**Controls:** tap the right side of a reel to skip a scene, the left side to go back, and the middle to pause. The side buttons toggle sound, change narration speed, open "Go deeper" (Beyond NCERT and the exam angle), and jump to the question.

Progress is stored in your browser on that device (`localStorage`).

## Add your next chapter

The content for each chapter is a JSON file in `content/`. To generate one from a chapter PDF with Claude:

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm run generate -- ~/Downloads/keec102.pdf --id eco11-ch02 --subject "Economics · Class 11"
npm run validate
```

The generator sends the PDF to Claude together with two finished reels from chapter 1 as a style reference. It validates the output, writes `content/<id>.json`, and adds the chapter to `content/index.json`. When the app has more than one chapter, the top bar becomes a chapter picker. Skim the generated **Beyond NCERT** facts before you rely on them.

## Project layout

```
index.html, css/app.css     app shell and styles (mobile-first)
js/app.js                   boot, tabs, shared state
js/feed.js                  scroll-snap feed: reels, recall breaks, end card
js/reel.js                  reel player: scenes, narration, captions, quiz
js/scenes.js                animated scene types (hook, points, stat, bars, flow, compare, quote, timeline)
js/srs.js                   spaced-repetition scheduler
js/review.js, progress.js   review queue and progress dashboard
js/tts.js, store.js         narration, local persistence
content/                    chapter JSON files and index
scripts/                    dev server, validator, PDF → chapter generator
```

## Ideas for what's next

- Explain-it-back mode: you explain a concept by voice and AI grades what you missed
- RBI Phase 1-style MCQ sets and Phase 2 descriptive practice with answer feedback
- Concept map linking reels across chapters
- Current-affairs linker that tags news articles to concepts you've already studied
- Audio-only "podcast mode" for commutes
- Higher-quality cloud TTS voices, and sync across devices
