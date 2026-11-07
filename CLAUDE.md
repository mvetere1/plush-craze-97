# Plush Craze '97: notes for Claude

A single-player trading game set in the late-90s craze for bean-filled plushies. The player buys and sells plushies around town while a hype bubble inflates, then pops on a secret day. The goal is the most money at the end of the season.

## How to run and check

- Play: open `index.html` in a browser (it works from `file://`; no server or build step).
- Test: `npm test` (plain Node, no dependencies). Run it after any change to `src/game.js` or `src/data.js`.

## Code layout and conventions

- `src/data.js`: content and tuning only. All numbers that affect balance belong in `CONFIG`, not hard-coded elsewhere.
- `src/game.js`: the rules. No DOM access. Every action (`buy`, `sell`, `travel`, `wait`) takes a state and returns a new state; never mutate the old one. Anything random takes an optional `rng` so tests are repeatable.
- `src/ui.js`: rendering and clicks. It rebuilds the screen with template strings after each action and handles clicks through `data-action` attributes on buttons.
- `styles.css`: all styling. Colors are CSS variables at the top.
- Scripts are classic scripts loaded in order (data, game, ui), not ES modules, so the game keeps working when opened by double-clicking. Keep it that way unless we add a dev server.
- When you change a rule, add or update a test in `tests/game.test.js`.
- Keep real buttons (`<button>`) for anything clickable, with an `aria-label` when the text alone is unclear.

## Content rules

- All plushies, shops and names are original. Do not use real toy brands, their character names or their logos.
- Tone: playful, nostalgic, kid's-eye view of the 90s.

## Current game design (assumptions; the owner may change these)

- 30-day season, $60 to start, 15 shelf spots, any plushie takes one spot.
- 6 shops on a town map. Trip time = map distance / 260, rounded, minimum 1 day. The player can also wait a day in place.
- Hype multiplies by 1.11 each day. On a random crash day (22 to 27) it drops to 12% of its peak, then keeps falling 15% a day.
- Warning headlines appear in the 2 days before the crash.
- Each shop has its own price level, sell-back spread and price noise. Garage sales lag the hype (k < 1) and the collectors' con leads it (k > 1), so flipping between them pays.
- One random plushie is "retired" between days 8 and 14 and is worth double from then on.
- Score = cash + leftover plushies valued at garage-sale prices on the last day.
- The game is a fixed 1280×800 desktop screen.

## Open questions (ask the owner before deciding)

- Show the hype number, or make players guess from the headlines?
- Add other kids (NPCs) to trade with?
- Web, mobile or desktop?
- One craze per game, or a new fad each round?
- Add new plushies as the season goes on?
