# Plush Craze '97

It's 1997 and everyone is going nuts for bean-filled plushies. You have $60, a shelf with room for 15 plushies, and 30 days. Buy low, sell high, and cash out before the bubble pops.

## Play it

Double-click `index.html` to open it in your browser. That's it: no install, no build step.

While developing, a live preview is nicer. In VS Code, install the **Live Server** extension, then right-click `index.html` and choose **Open with Live Server**. The page reloads every time a file is saved.

The game is a fixed 1280×800 screen for now, so use a desktop browser window at least that big.

## Work on it with Claude in VS Code

1. In VS Code, choose **File > Open Folder…** and open this `plush-craze-97` folder.
2. Open the Claude Code panel (the spark icon) and sign in.
3. Claude reads `CLAUDE.md` automatically, which explains the game, the rules and how the code is organized.

Some good first requests:

- "Make the hype number hidden so players have to guess from the headlines."
- "Add a random event: a surprise restock at the mall that drops prices for a day."
- "Make the layout work on a phone."
- "Add a high-score table that's saved in the browser."

## Project layout

| File | What's in it |
| --- | --- |
| `index.html` | The page. Loads the fonts, styles and scripts. |
| `styles.css` | Every color, font and layout rule. Colors are variables at the top. |
| `src/data.js` | Content and tuning: plushies, shops, headlines, and all game numbers in `CONFIG`. |
| `src/game.js` | The rules (prices, hype, travel, buying, selling, score). No screen code. |
| `src/ui.js` | The screens (shop, town map, end of season) and button clicks. |
| `tests/game.test.js` | Checks the rules still work. |

## Tests

If you have Node.js installed, run:

```
npm test
```

The tests check the rules in `src/game.js`: hype rising and crashing, buying and selling, travel time, the season ending, and the final score.
