// Balance check: plays many seeded seasons through the real rules and prints score spreads.
// Run with: npm run sim            (or: node tools/simulate.js 5000)
const G = require('../src/game.js');
const D = require('../src/data.js');
const C = D.CONFIG;

const SEASONS = Number(process.argv[2]) || 3000;
const ORACLE_SEASONS = Math.min(40, SEASONS);
const BEAM_WIDTH = 40;

function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- trading helpers ----------

function sellAll(s) {
  D.PLUSHIES.forEach((p) => {
    while ((s.shelf[p.id] || 0) > 0) s = G.sell(s, p.id);
  });
  return s;
}

// Spend evenly across the empty shelf spots, favouring pricier plushies once cash allows.
function buyFill(s) {
  for (;;) {
    const slots = C.shelfCapacity - G.shelfUsed(s);
    const affordable = D.PLUSHIES.filter((p) => s.prices[p.id].buy <= s.cash);
    if (slots < 1 || !affordable.length) return s;
    const budget = s.cash / slots;
    const inBudget = affordable.filter((p) => s.prices[p.id].buy <= budget);
    const pool = inBudget.length ? inBudget : affordable;
    const worth = (p) => G.guide(s, p.id, s.day);
    const pick = inBudget.length
      ? pool.reduce((a, b) => (worth(b) > worth(a) ? b : a))
      : pool.reduce((a, b) => (s.prices[b.id].buy < s.prices[a.id].buy ? b : a));
    s = G.buy(s, pick.id);
  }
}

const holding = (s) => G.shelfUsed(s) > 0;
const crashed = (s) => s.day >= s.crashDay;
const warned = (s) => D.HEADLINES.warning.includes(G.headline(s));

function waitOut(s, rng) {
  while (!G.isLastDay(s)) s = G.wait(s, rng);
  return s;
}

// ---------- strategies: each returns a finished state ----------

// Shuttle between two shops. `exit` decides when to stop:
//   ride:   keep going until the crash is visible, then dump stock wherever you stand
//   warn:   same, but dump stock and stop as soon as a warning headline appears
//   safe:   stop so the last sale lands before the earliest possible crash day
//   oracle: knows the crash day and makes the last sale the day before it
function route(buyAt, sellAt, exit) {
  return function (s, rng) {
    const trip = G.travelDays(buyAt, sellAt);
    const lastSale = () => (exit === 'oracle' ? s.crashDay - 1 : C.crashWindow[0] - 1);
    while (!G.isLastDay(s)) {
      if (crashed(s) || (exit === 'warn' && warned(s))) return waitOut(sellAll(s), rng);
      if (s.place === sellAt) s = sellAll(s);
      const mayBuy = exit === 'ride' || exit === 'warn' || s.day + trip <= lastSale();
      if (s.place === buyAt && mayBuy) s = buyFill(s);
      const target = holding(s) ? sellAt : buyAt;
      if (!holding(s) && !mayBuy && (exit === 'safe' || exit === 'oracle')) {
        const canStillLoop = s.day + G.travelDays(s.place, buyAt) + trip <= lastSale();
        if (!canStillLoop) return waitOut(s, rng);
      }
      if (s.place !== target && G.canReach(s, target)) s = G.travel(s, target, rng);
      else s = G.wait(s, rng);
    }
    return sellAll(s);
  };
}

function holdForever(s, rng) {
  return waitOut(buyFill(s), rng);
}

function holdThenSell(sellDay) {
  return function (s, rng) {
    s = buyFill(s);
    while (s.day < sellDay) s = G.wait(s, rng);
    return waitOut(sellAll(s), rng);
  };
}

// A kid mashing buttons: a few random trades, then a random move.
function randomPlayer(s, rng) {
  while (!G.isLastDay(s)) {
    const trades = Math.floor(rng() * 5);
    for (let i = 0; i < trades; i++) {
      const p = D.PLUSHIES[Math.floor(rng() * D.PLUSHIES.length)];
      s = rng() < 0.5 ? G.buy(s, p.id) : G.sell(s, p.id);
    }
    const options = D.PLACES.filter((p) => G.canReach(s, p.id));
    if (options.length && rng() < 0.7) s = G.travel(s, options[Math.floor(rng() * options.length)].id, rng);
    else s = G.wait(s, rng);
  }
  return sellAll(s);
}

// A sensible player: buys when a price is under the guide, sells when it is well over what
// garage prices would be, moves to the shop that pays best for what they carry, and bails out
// on the first warning headline. Roughly "someone who has played a few times".
function sensiblePlayer(s, rng) {
  while (!G.isLastDay(s)) {
    if (crashed(s) || warned(s)) return waitOut(sellAll(s), rng);
    const here = G.place(s.place);
    if (here.mult >= 1) s = sellAll(s);
    if (here.mult < 1) s = buyFill(s);
    const target = holding(s) ? 'online' : 'garage';
    if (s.place !== target && G.canReach(s, target)) s = G.travel(s, target, rng);
    else s = G.wait(s, rng);
  }
  return sellAll(s);
}

// ---------- perfect-foresight upper bound ----------

// Beam search that knows the crash day. It tries hold, sell-and-rebuy and sell-to-cash at every
// stop, then every move. Not a proof of the maximum, but a good estimate of what is possible.
function oracleBeam(start, rng) {
  const byDay = {};
  const add = (s) => { (byDay[s.day] = byDay[s.day] || []).push(s); };
  const worth = (s) => s.cash + D.PLUSHIES.reduce(
    (n, p) => n + (s.shelf[p.id] || 0) * G.guide(s, p.id, s.day), 0);
  add(start);
  let best = start;
  for (let day = 1; day <= C.seasonDays; day++) {
    const nodes = (byDay[day] || []).sort((a, b) => worth(b) - worth(a)).slice(0, BEAM_WIDTH);
    nodes.forEach((s) => {
      const cashOut = sellAll(s);
      if (G.finalScore(cashOut).total > G.finalScore(best).total) best = cashOut;
      [s, buyFill(s), cashOut, buyFill(cashOut)].forEach((t) => {
        if (G.isLastDay(t)) return;
        D.PLACES.forEach((p) => { if (G.canReach(t, p.id)) add(G.travel(t, p.id, rng)); });
        add(G.wait(t, rng));
      });
    });
    delete byDay[day];
  }
  return best;
}

// ---------- report ----------

function percentile(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function run(label, play, seasons) {
  const scores = [];
  for (let i = 0; i < seasons; i++) {
    const rng = seeded(i + 1);
    scores.push(G.finalScore(play(G.newGame(rng), rng)).total);
  }
  scores.sort((a, b) => a - b);
  const share = (test) => Math.round((scores.filter(test).length / seasons) * 100) + '%';
  return {
    strategy: label,
    p10: percentile(scores, 0.1),
    median: percentile(scores, 0.5),
    p90: percentile(scores, 0.9),
    'lost money': share((n) => n < C.startCash),
    tycoon: share((n) => n >= C.tycoonScore)
  };
}

const rows = [
  ['Mashes buttons at random', randomPlayer],
  ['Buys day 1, never sells', holdForever],
  ['Buys day 1, sells day 21', holdThenSell(21)],
  ['Garage <-> online, ignores warnings', route('garage', 'online', 'ride')],
  ['Garage <-> online, heeds warnings', sensiblePlayer],
  ['Garage <-> online, stops by day 21', route('garage', 'online', 'safe')],
  ['Garage <-> online, knows crash day', route('garage', 'online', 'oracle')],
  ['Flea <-> mall, knows crash day', route('flea', 'mall', 'oracle')],
  ['Gift <-> con, knows crash day', route('gift', 'con', 'oracle')],
  ['Garage <-> con, ignores warnings', route('garage', 'con', 'ride')],
  ['Garage <-> con, heeds warnings', route('garage', 'con', 'warn')],
  ['Garage <-> con, stops by day 21', route('garage', 'con', 'safe')],
  ['Garage <-> con, knows crash day', route('garage', 'con', 'oracle')]
].map(([label, play]) => run(label, play, SEASONS));

rows.push(run('Best route found, knows crash day', oracleBeam, ORACLE_SEASONS));

console.log(SEASONS + ' seasons per strategy (' + ORACLE_SEASONS + ' for the last row)');
console.table(rows);
