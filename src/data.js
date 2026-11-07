// All game content and tuning numbers live here.
// Change these to rebalance the game; game.js reads everything from this file.
(function (root) {
  const CONFIG = {
    seasonDays: 30,        // the season ends after this day
    startCash: 60,         // dollars the player starts with
    shelfCapacity: 15,     // how many plushies the player can hold
    startPlace: 'garage',

    hypeGrowth: 1.11,      // hype multiplies by this every day before the crash
    crashWindow: [22, 27], // the bubble pops on a random day in this range (inclusive)
    crashDrop: 0.12,       // on the crash day hype falls to this fraction of its peak
    postCrashDecay: 0.85,  // after the crash hype keeps shrinking by this factor per day
    warningDays: 2,        // warning headlines appear this many days before the crash

    retireWindow: [8, 14], // one plushie is "retired" on a random day in this range
    retireBoost: 2,        // retired plushie's price multiplier

    travelDivisor: 260,    // trip days = map distance / this, rounded, minimum 1

    steal: 0.8,            // buy price below guide x this shows "Steal!"
    overpriced: 1.15       // buy price above guide x this shows "Overpriced"
  };

  // Original characters. Do not swap in real brand names or characters.
  const PLUSHIES = [
    { id: 'pinky',   name: 'Pinky',       kind: 'flamingo',       base: 6,  color: '#FF8FC8' },
    { id: 'waddles', name: 'Sir Waddles', kind: 'penguin',        base: 5,  color: '#B9C3D6' },
    { id: 'bubbles', name: 'Bubbles',     kind: 'whale',          base: 8,  color: '#7FC8F8' },
    { id: 'patches', name: 'Patches',     kind: 'calico cat',     base: 7,  color: '#F6B26B' },
    { id: 'ziggy',   name: 'Ziggy',       kind: 'neon gecko',     base: 10, color: '#9BE564' },
    { id: 'duchess', name: 'Duchess',     kind: 'lavender bunny', base: 12, color: '#C9A7F5' }
  ];

  // x, y are positions on the 1280x800 town map.
  // mult:   overall price level (garage sales are cheap, the con is pricey)
  // k:      how strongly prices follow hype (below 1 = lags the craze, above 1 = leads it)
  // spread: sell price as a fraction of buy price
  // noise:  random +/- swing on each price
  // cheap:  one plushie that is 30% cheaper here (or null)
  const PLACES = [
    { id: 'garage', name: 'Garage sales',     x: 230,  y: 470, mult: 0.55, k: 0.75, spread: 0.8,  noise: 0.15, cheap: 'waddles' },
    { id: 'flea',   name: 'Flea market',      x: 300,  y: 230, mult: 0.75, k: 0.85, spread: 0.85, noise: 0.15, cheap: 'patches' },
    { id: 'mall',   name: 'Mall toy store',   x: 590,  y: 290, mult: 1,    k: 0.9,  spread: 0.6,  noise: 0.05, cheap: 'pinky' },
    { id: 'con',    name: "Collectors' con",  x: 1040, y: 300, mult: 1.3,  k: 1.08, spread: 0.95, noise: 0.1,  cheap: null },
    { id: 'gift',   name: 'Card & gift shop', x: 860,  y: 560, mult: 1,    k: 0.95, spread: 0.8,  noise: 0.1,  cheap: 'bubbles' },
    { id: 'online', name: 'Online auction',   x: 560,  y: 590, mult: 1.15, k: 1.05, spread: 0.9,  noise: 0.3,  cheap: null }
  ];

  // News ticker. Lists rotate by day. {name} and {kind} are filled in for the retirement headline.
  const HEADLINES = {
    early: [
      'A new line of bean-filled plushies hits store shelves.',
      'Kids at school are trading plushies at recess.',
      "Your cousin says these little guys are 'gonna be worth something.'"
    ],
    rising: [
      'Price guide: values up AGAIN this week!',
      'Grown-ups spotted lining up outside the mall toy store.',
      "Local news asks: 'Are plushies the new baseball cards?'"
    ],
    mania: [
      'Man trades his used car for one rare plushie. Seriously.',
      'Shoving match breaks out over a restock at the mall!',
      'Price guide predicts values will DOUBLE by next year!',
      'Everyone is buying display cases and tag protectors.'
    ],
    warning: [
      'Stores report shelves overflowing with brand-new stock.',
      "Your mom asks if you're 'really sure about all this.'",
      "This month's price guide is suspiciously thick."
    ],
    crash: [
      'CRASH! Nobody wants plushies anymore. Prices in free fall.',
      'Bargain bins are overflowing with plushies, 3 for $1.',
      "Collectors vow to 'hold for the rebound.' It isn't coming.",
      'Your mom found the receipts. She is not happy.'
    ],
    retired: 'BREAKING: {name} the {kind} has been RETIRED! Collectors go wild.'
  };

  const data = { CONFIG, PLUSHIES, PLACES, HEADLINES };
  root.PlushData = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof window !== 'undefined' ? window : globalThis);
