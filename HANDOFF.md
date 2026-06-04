# NYM Portfolio — Handoff for next session

> **READ THIS FILE FIRST.** Everything you need to know about the project lives here.

---

## 1. What this is

**`nympro.studio`** — Kirill Stepanov's creative-developer portfolio.

- Hero is a 3D Guy Fawkes / Anonymous mask (dotted point cloud), driven by Three.js
- Mask rotates following the cursor (or gyroscope on mobile)
- Brand: `NYM` (short for "anonymous"). Real name `KIRILL STEPANOV` revealed on the About page
- Vibe: dark, cyan/teal accent (`#5BBFC0`), monospace + Inter typography, glitch + scramble motifs throughout

---

## 2. Where it lives & how it deploys

| | |
|---|---|
| **Local working dir** | `/Users/kirill/Desktop/nympro-new/portfolio/` |
| **GitHub repo** | `nymprotwo/nymprostudio` (default branch: `main`) |
| **Live domain** | https://nympro.studio (GitHub Pages, CNAME in repo root) |
| **Deploy method** | `git push origin main` → GitHub Pages rebuilds automatically (~30-60 sec) |

There is **no build step**. Source files are served as-is. ES modules imported via `importmap` at the top of `index.html` (Three.js, Lenis come from unpkg/jsdelivr CDN).

### Cache-busting

GitHub Pages caches aggressively. Every JS / CSS import has a `?v=N` query in its URL. **After any change, bump the relevant version number in `index.html` (and in any module that imports another module)**, otherwise the browser keeps the stale file.

Current version numbers as of last commit:
- `main.css?v=34`
- `main.js?v=35` (bumped when fx-decode was added) and other module imports `?v=28` to `?v=35`

### Backup of the original site

The pre-portfolio "AI Business Audit" landing that used to live at nympro.studio is backed up at
`/Users/kirill/Desktop/nympro-new/_backups/nympro-ai-audit/index.html`.

---

## 3. File-by-file map

```
portfolio/
├── HANDOFF.md            ← this file
├── index.html            ← single page, splash + hero shell + About page section + overlay panels
├── CNAME                 ← 'nympro.studio' — DO NOT delete
├── favicon.ico
├── assets/
│   └── mask.glb          ← 17 MB Anonymous mask model (Meshy.ai output)
├── css/
│   └── main.css          ← all styles, BEM-ish (.hero__*, .page__*, .overlay__*, .splash__*)
└── js/
    ├── main.js           ← entry point, orchestrates init order, hides splash when scene+splash done
    ├── splash.js         ← '> ESTABLISHING CONNECTION / IDENTITY: UNKNOWN / READY' scramble
    ├── scene.js          ← Three.js: loads mask.glb, dot-cloud material, mouse-tracking rotation
    ├── overlays.js       ← Routes (data-page, data-overlay), home button, exit handlers
    ├── shift.js          ← Bottom-left SHIFT toggle (placeholder for future mini-game)
    ├── clock.js          ← Live Bangkok time + weather (wttr.in) bottom-left of hero
    ├── rotator.js        ← Right-side scramble-cycling taglines (BRAIN IS OFFLINE etc.)
    ├── input-mobile.js   ← Gyro tilt + touch drag fallback. iOS permission flow
    ├── cursor-strip.js   ← About page bottom invisible band — emits cyan squares on hover
    ├── name-hover.js     ← Splits KIRILL/STEPANOV into per-letter spans for CSS shimmer hover
    ├── smooth-scroll.js  ← Lenis smooth scroll init
    ├── scroll-effects.js ← About: parallax hero overlay fade, scroll → mask scrollProgress, scrambles
    ├── fx-switcher.js    ← Reads ?fx=... query, lazily loads matching effect module
    ├── fx-glitch.js      ← #2: glitch scramble across hero name + statement during scroll
    ├── fx-type.js        ← #4B: typewriter prints body content as you scroll (BROKEN, needs debug)
    └── fx-decode.js      ← #6: binary stream decompiles letter by letter on scroll (LATEST, awaiting verdict)
```

### Component overview

- **Splash (`splash.js`):** glitch-text intro. Holds until Three.js scene finishes loading mask.glb (~3-5s).
- **Scene (`scene.js`):** mask.glb loaded into a Three.js `Group`, sampled vertices become a sparse cyan `Points` cloud. Exposes:
  - `setMaskTarget(rx, ry)` — used by mouse/gyro/touch inputs
  - `setScrollProgress(p)` — currently a no-op since cube-shatter was reverted; safe to extend
- **Routes (`overlays.js`):**
  - `data-page="about"` opens the scroll-revealed About page (sets `body.is-page-open` + `body[data-page="about"]`)
  - `data-overlay="works"` / `"contact"` open full-screen overlay panels (legacy, unchanged)
  - `data-home` on the NYM logo closes whatever's open; runs all registered exit handlers (e.g. SHIFT reset)
- **About page (`scroll-effects.js`):** parallax-fades hero overlay (`.page__id`, `.page__year`, `.page__scroll-cue`, `.page__cursor-strip`) as user scrolls. Intersection observer reveals content blocks. Statement scramble fires once when scrolled past 60vh.
- **FX system (`fx-switcher.js`):**
  - Reads `?fx=glitch` / `?fx=type` / `?fx=decode` from URL
  - Sets `body[data-fx]`
  - Lazy-loads the corresponding `fx-*.js` module
  - `scroll-effects.js` calls `fxOnScrollProgress(p)` on each scroll if fx is active. Skips legacy statement reveal in that case.

---

## 4. Current state (2026-06-03)

### What works on prod (https://nympro.studio)

- ✅ Splash with scramble
- ✅ 3D mask, dotted, mouse-tracking + idle floating
- ✅ Hero overlay: NYM logo (centered, clickable home), AVAILABLE FOR WORK badge, Bangkok clock+weather, rotating glitch tagline, SHIFT toggle, BUILT WITH CODE & NIGHTMARE
- ✅ Mobile: gyroscope tilt + touch drag, "TILT TO MOVE" hint
- ✅ About page (scroll mode): KIRILL STEPANOV name, 2025/CODING SINCE badge, SCROLL pill cue, scramble-revealed statement, content blocks WHO I AM / WHAT ARE YOU LOOKING FOR? (5 services list) / CURRENTLY
- ✅ Per-letter cyan-stroke hover on name letters (`.page__name-letter:hover`)
- ✅ Lenis smooth scroll
- ✅ FX switcher: `?fx=glitch` works (Kirill said "looks cheap" — see §6 verdict)

### About page content

```
> WHO I AM
Independent creative developer based in Bangkok. I build digital things
that don't look like everyone else's — often with a layer of motion, AI,
or controlled chaos that makes people stop scrolling.

> WHAT ARE YOU LOOKING FOR?
01 A LANDING PAGE
02 A FULL WEBSITE
03 AN AI-POWERED PRODUCT
04 BUSINESS AUTOMATION
05 A FITNESS APP — MY OWN, AS A BONUS

> CURRENTLY
Open for serious work, ambitious ideas, and unhinged experiments.
The weirder, the better. Based in Bangkok, working anywhere with wi-fi.
```

### Works / Contact

Still old overlay-panel style (full-screen modal). Not yet refactored to page mode. Works has 4 placeholder cards. Contact has email + Telegram/Instagram/GitHub placeholders.

---

## 5. The big open thread — About scroll transition

Kirill is **not satisfied** with the current About scroll transition. He wants something memorable / wow-factor for the moment when the user scrolls from the hero (mask + name + statement) down into the content (WHO I AM, skills, CURRENTLY).

### Ideas under consideration

Five options were proposed. Status:

| # | Name | Status | Notes |
|---|---|---|---|
| 1 | **Iris from center** (clip-path circle expands) | **REJECTED** by Kirill |
| 2 | **Glitch scramble during scroll** (KIRILL STEPANOV dissolves, statement resolves) | **IMPLEMENTED** as `?fx=glitch`. Kirill: "looks cheap, glitch never settles, scroll feels long-empty" |
| 3 | **Edge blur on scroll** | **REJECTED** ("too plain") |
| 4B | **Typewriter** (body content types on scroll, statement fades in/out, hero stays clean) | **IMPLEMENTED** as `?fx=type`. **Kirill reports BROKEN** — needs debug in next session |
| 5 | **Portal through mask eyes** (content emerges from a point between the eyes; 3D → 2D screen projection) | **REJECTED** ("too complex, mask floats / eyes wander, won't be stable") |
| 6 | **Code decompile** (hex/binary letters decompile to real text) | **IMPLEMENTED** as `?fx=decode` in commit `12e72b1` — awaiting Kirill's verdict. Full-page decode: hero name (0-25%), statement (10-42%), body content (30-95%). Each letter walks `0/1 → hex 0-9A-F → real char`. |
| 7 | **Horizontal slide** (scroll moves the whole page side-to-side instead of vertical) | **NOT YET STARTED**. Kirill: "самый сладкий на десерт" — save for last if 2/4B/6 don't land. Outline plan in §10. |

### Kirill's bonus idea
Whatever FX we use, the hero name (`KIRILL STEPANOV`) should also react — letters fly apart / scramble / decompile in sync with the rest. Just like the mask shatter idea but applied to text. **#2 already does this** (the right-to-left wave on KIRILL STEPANOV). #6 should also do this.

---

## 6. What to do next session

### Top priorities

1. **Get Kirill's verdict on `?fx=decode`** (latest deployed, commit `12e72b1`). If he likes it: lock it in (remove the URL switcher, make it the default scroll behaviour on About). If not: jump straight to #7 horizontal slide.

2. **Likely follow-up: build #7 horizontal slide.** Kirill called it "самый сладкий на десерт" — the dessert. Reserved for when none of the per-letter effects (2 / 4B / 6) land. Detailed outline in §10 below.

3. **(Optional) Fix `?fx=type`** — Kirill says "вообще не работает". Most likely cause: body content elements live inside `.page__content` which is hidden by Intersection-Observer reveal classes until they enter viewport — so the typewriter collector finds 0 nodes (or text is set after observation starts). `fx-decode.js` solves this with `root.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-revealed'))` — apply the same to `fx-type.js`. Low priority unless Kirill picks `type` over `decode`.

4. **Show Kirill all three side-by-side** (`?fx=glitch`, `?fx=type`, `?fx=decode`) so he can pick.

### Other open items (lower priority)

- **Works** page is still old overlay. Refactor to the same `<section class="page">` pattern as About (data-page="works"). Reuse same parallax/cursor-strip patterns. Add real project cards (Kirill hasn't supplied content yet).
- **Contact** page: same — refactor from overlay to page. Big email button + social links.
- **SHIFT toggle:** placeholder right now (just visual). Future: minigame on tap. Possibly Snake or block-falling thing.
- **Splash:** sometimes the user briefly sees the 3 lines flash before JS hides them. CSS already has `opacity: 0` on `.splash__line` but worth re-verifying after any future change.
- **Mobile**: the gyro permission flow seems correct (synchronous `requestPermission()` from the user-gesture handler), but it's worth testing on a real iOS device — preview doesn't expose gyro.

### Process / etiquette

- Kirill expects every code change to be **immediately deployed** (commit + push). His CLAUDE memory says: `run bash deploy.sh sportbrain index.html after every code change`. For this project, deploy is just `git push origin main`. **Push aggressively** so he can refresh and see results.
- Bump `?v=` cache-busters on EVERY change so he doesn't hit stale cache.
- After push, GitHub Pages takes 30-60s to rebuild. Tell him to **hard reload** (Cmd+Shift+R) or use Incognito to dodge browser cache.
- He is in **Bangkok (UTC+7)** — keep that in mind for the clock widget.
- Russian-speaking; technical English in code is fine, replies should be Russian.

### Commands cheatsheet

```bash
# Open project
cd /Users/kirill/Desktop/nympro-new/portfolio

# Run a local preview (any static server works)
python3 -m http.server 4322
# then visit http://localhost:4322/?fx=glitch (or type / decode / nothing)

# Deploy
git add -A
git commit -m "message"
git push origin main

# Check if Pages build is live
gh api repos/nymprotwo/nymprostudio/pages/builds --jq '.[0] | "\(.commit) \(.status)"'

# Inspect the live site
curl -s https://nympro.studio/ | head -30
```

---

## 7. Key technical decisions / gotchas

- **WebGL canvas screenshots:** `WebGLRenderer` defaults `preserveDrawingBuffer: false`. We set it to `true` so headless screenshots capture the rendered frame. Kept it on prod — minor perf cost is fine for our static scene.
- **InstancedMesh frustum culling:** any future InstancedMesh (cube shatter etc) needs `frustumCulled = false` because bounding sphere is computed from the per-instance geometry, not the actual instance positions. Without this, instances at scattered positions invisibly disappear.
- **Cube shatter / wireframe attempts:** Kirill rejected all three "mask transforms on scroll" experiments (cubes, wireframe fly-through, points growing into voxels). Hero mask should stay as a **static dotted point cloud** unless he asks otherwise. The current `scene.js` is the reverted-clean version (`git log: 1674ba2 Revert mask to static dots`).
- **`.page__name-letter`:** name-hover.js splits both KIRILL and STEPANOV into per-letter spans. fx-glitch.js piggybacks on that split (just tags letters with `.fx-letter`). Any future fx that targets the name should do the same — don't re-split.
- **Statement (`A creative dev / fueled by code & nightmares`):** the `[data-scramble]` spans are populated from HTML text, then JS scrambles them on a one-shot reveal. fx-glitch re-splits them into letter spans. fx-type just fades the whole `.page__statement` in/out.
- **Cache deploys:** when you bump `?v=`, also remember to bump every cross-import inside JS files (`import x from './scene.js?v=...'`) — they're independent strings and the browser caches per full URL.

---

## 8. Memory hooks for Kirill's `~/.claude/memory`

These were noted earlier and apply:

- **Deploy after every code change** (immediate live)
- **Uses Arc browser with per-tab Dev Mode** — per-tab "Developer Mode" silently blocks userscripts; not directly relevant here but worth knowing if he reports "your script doesn't run" on some pages
- **The cable handle card style** memo applies to his sportbrain project, not this one
- **nympro.studio = primary domain.** sportbrain, english, etc. are subdomains served from sibling repos (`nymprotwo/sportbrain` etc) via the `deploy.sh` flow in `/Users/kirill/Desktop/nympro-new/`. **`portfolio/` deploys to the root domain, not via deploy.sh — direct `git push` to `nymprotwo/nymprostudio`.**

---

## 9. TL;DR for the next agent

1. Read this file
2. Check `git log --oneline -10` in `portfolio/` for recent work
3. Ask Kirill which FX option he wants to debug/implement next (`type` is broken, `decode` not started, `horizontal slide` is the dessert)
4. Bump `?v=`, push, tell him to hard reload
5. Be honest about timelines — he was burned earlier when AI quoted human-days for AI-minute tasks

End of handoff.

---

## 10. Plan for #7 horizontal slide (the dessert)

**Concept:** the About page doesn't scroll vertically. The mouse wheel / touchpad / arrow keys move the viewport (or a horizontal track of panels) **left-to-right**. Sections become a ribbon:

```
[hero mask + name + statement] → [skills (WHAT ARE YOU LOOKING FOR?)] → [WHO I AM bio] → [CURRENTLY]
```

The mask stays as a fixed background, slightly parallaxed for depth as the foreground slides.

### Implementation outline

1. **Suspend native vertical scroll** while About is open:
   - `body.is-page-open` → `overflow: hidden`
   - Capture `wheel`, `keydown` (arrow keys), `touchmove`. preventDefault.
2. **Horizontal track container** wrapping the existing sections. Width = `N * 100vw`. Move via `transform: translateX(-px)` driven by a virtual scroll position.
3. **Try Lenis horizontal mode first** (`orientation: 'horizontal'`). If it's not smooth enough, hand-roll inertia (the existing `Lenis` import would have to be replaced or extended).
4. **Snap vs free scrolling.** Snap = each panel locks to the viewport on release (more readable). Free = ribbon (more cinematic). Start with snap; demote later if Kirill wants pure ribbon.
5. **Mobile fallback.** Gate horizontal mode to `(min-width: 900px)`. On phones, fall back to the current vertical scroll. (Or implement left/right swipe — more work, do it after desktop is solid.)
6. **Mask & hero overlay.** The mask remains fixed-background in `#stage`. The KIRILL STEPANOV / 2025 badge / SCROLL pill move with the first panel (they're DOM children of the first section in the track). Parallax the mask group's `position.x` by a small fraction of the track position for depth.
7. **Replace `scroll-effects.js`'s scroll handler** with a horizontal-track-progress driver. Key change: `fxOnScrollProgress(p)` becomes "track progress (0 = leftmost, 1 = rightmost)". All existing FX modules (glitch/type/decode) continue to work — they don't care whether progress comes from vertical or horizontal scroll.
8. **Update the SCROLL pill** — change its arrow from down `↓` to right `→` when in horizontal mode.

### Estimated effort

- Desktop horizontal-only, snap-points, basic parallax: **half a day**
- Mobile fallback decision + implementation (swipe or revert-to-vertical): **+half a day**
- Polish (anim timing, edge cases at start/end of track, transition between panels): **+half a day**

### Risks / things to watch

- **Lenis horizontal mode** has shipped but isn't as battle-tested as vertical. May need to disable smoothness or do CSS scroll-snap as fallback.
- **Mouse-wheel UX is contested** — some users will be confused that wheel-down moves the page right. Add a one-time "SCROLL" hint pointing right, fading after 5 seconds.
- **Accessibility:** screen readers and keyboard users need a way through. Arrow keys must work (Left/Right). Tab order must follow track order. Don't break that.
- **3D mask still rotates with mouse.** Mouse-tracking in `scene.js` uses `e.clientX/Y` — that's viewport-relative, won't break when track scrolls. Good.

Then commit, push, hard-reload, get verdict. If Kirill loves it: refactor `?fx=horizontal` into the default and delete the URL switcher.
