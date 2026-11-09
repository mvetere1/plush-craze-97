// Rule tests. Run with: npm test   (or: node tests/game.test.js)
// Uses only Node's built-in assert, so there is nothing to install.
const assert = require('node:assert/strict');
const D = require('../src/data.js');
const G = require('../src/game.js');
const C = D.CONFIG;

// Repeatable random numbers so every run gives the same result.
function seeded(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (err) { console.error('  FAIL ' + name + '\n       ' + err.message); process.exitCode = 1; }
}

test('a new game starts with the configured cash, day 1 and an empty shelf', () => {
  const s = G.newGame(seeded(1));
  assert.equal(s.cash, C.startCash);
  assert.equal(s.day, 1);
  assert.equal(G.shelfUsed(s), 0);
  assert.equal(s.place, C.startPlace);
});

test('the crash and retirement days fall inside their windows', () => {
  for (let i = 0; i < 200; i++) {
    const s = G.newGame(seeded(i));
    assert.ok(s.crashDay >= C.crashWindow[0] && s.crashDay <= C.crashWindow[1]);
    assert.ok(s.retireDay >= C.retireWindow[0] && s.retireDay <= C.retireWindow[1]);
  }
});

test('hype rises every day before the crash and collapses on the crash day', () => {
  const crash = 24;
  for (let d = 2; d < crash; d++) assert.ok(G.hype(d, crash) > G.hype(d - 1, crash));
  assert.ok(G.hype(crash, crash) < G.hype(crash - 1, crash) * 0.2);
  assert.ok(G.hype(crash + 3, crash) < G.hype(crash, crash));
});

test('buying costs the buy price and fills one shelf spot', () => {
  const s = G.newGame(seeded(2));
  const price = s.prices.pinky.buy;
  const after = G.buy(s, 'pinky');
  assert.equal(after.cash, s.cash - price);
  assert.equal(after.shelf.pinky, 1);
  assert.equal(s.shelf.pinky, undefined, 'the old state must not change');
});

test('you cannot buy past the shelf limit or with too little cash', () => {
  let s = Object.assign(G.newGame(seeded(3)), { cash: 1e9 });
  for (let i = 0; i < C.shelfCapacity + 5; i++) s = G.buy(s, 'waddles');
  assert.equal(G.shelfUsed(s), C.shelfCapacity);
  const broke = Object.assign(G.newGame(seeded(3)), { cash: 0 });
  assert.equal(G.buy(broke, 'duchess'), broke);
});

test('selling adds the sell price; selling what you do not own does nothing', () => {
  const s = G.buy(G.newGame(seeded(4)), 'bubbles');
  const after = G.sell(s, 'bubbles');
  assert.equal(after.cash, s.cash + s.prices.bubbles.sell);
  assert.equal(after.shelf.bubbles, 0);
  assert.equal(G.sell(after, 'bubbles'), after);
});

test('travelling moves you, costs days and remembers the old prices', () => {
  const s = G.newGame(seeded(5));
  const d = G.travelDays('garage', 'con');
  const after = G.travel(s, 'con', seeded(6));
  assert.equal(after.place, 'con');
  assert.equal(after.day, 1 + d);
  assert.deepEqual(after.notes.garage.prices, s.prices);
});

test('you cannot travel past the last day of the season', () => {
  const s = Object.assign(G.newGame(seeded(7)), { day: C.seasonDays });
  assert.equal(G.canTravelAnywhere(s), false);
  assert.equal(G.travel(s, 'flea'), s);
  assert.equal(G.wait(s), s);
});

test('the retired plushie is worth double from its retirement day', () => {
  const s = G.newGame(seeded(8));
  const id = s.retiredId;
  const before = G.guide(s, id, s.retireDay - 1);
  const on = G.guide(s, id, s.retireDay);
  assert.ok(on >= before * C.retireBoost * 0.95);
});

test('final score counts cash plus leftovers at garage-sale value', () => {
  let s = Object.assign(G.newGame(seeded(9)), { cash: 500 });
  s = G.buy(s, 'ziggy');
  const score = G.finalScore(s);
  assert.equal(score.cash, s.cash);
  assert.equal(score.unsold, 1);
  assert.ok(score.leftover > 0);
  assert.equal(score.total, score.cash + score.leftover);
});

test('finalScore applies the cheap discount for the garage\'s discounted plushie', () => {
  const garage = D.PLACES.find((p) => p.id === 'garage');
  const cheapId = garage.cheap; // 'waddles'
  const otherId = D.PLUSHIES.find((p) => p.id !== cheapId).id;
  let s = Object.assign(G.newGame(seeded(11)), { cash: 1e6 });
  s = G.buy(s, cheapId);
  s = G.buy(s, otherId);
  const score = G.finalScore(s);
  // Cheap plushie sell value at garage must be 70% of the other plushie's sell value at the same relative base
  const h = G.hype(s.day, s.crashDay);
  const cheapBase = D.PLUSHIES.find((p) => p.id === cheapId).base;
  const otherBase = D.PLUSHIES.find((p) => p.id === otherId).base;
  const expectedCheap = Math.max(1, Math.round(cheapBase * garage.mult * Math.pow(h, garage.k) * 0.7 * garage.spread));
  const expectedOther = Math.max(1, Math.round(otherBase * garage.mult * Math.pow(h, garage.k) * 1.0 * garage.spread));
  assert.equal(score.leftover, expectedCheap + expectedOther);
});

test('finalScore applies the retire boost for a retired plushie', () => {
  const garage = D.PLACES.find((p) => p.id === 'garage');
  let s = Object.assign(G.newGame(seeded(12)), { cash: 1e6 });
  const retiredId = s.retiredId;
  const otherId = D.PLUSHIES.find((p) => p.id !== retiredId).id;
  s = Object.assign({}, s, { retireDay: 1 }); // make retirement active immediately
  s = G.buy(s, retiredId);
  s = G.buy(s, otherId);
  const score = G.finalScore(s);
  const h = G.hype(s.day, s.crashDay);
  const retiredBase = D.PLUSHIES.find((p) => p.id === retiredId).base;
  const otherBase = D.PLUSHIES.find((p) => p.id === otherId).base;
  const specialRetired = garage.cheap === retiredId ? C.cheapDiscount : 1;
  const specialOther = garage.cheap === otherId ? C.cheapDiscount : 1;
  const expectedRetired = Math.max(1, Math.round(retiredBase * garage.mult * Math.pow(h, garage.k) * C.retireBoost * specialRetired * garage.spread));
  const expectedOther = Math.max(1, Math.round(otherBase * garage.mult * Math.pow(h, garage.k) * 1 * specialOther * garage.spread));
  assert.equal(score.leftover, expectedRetired + expectedOther);
});

test('there is always a headline', () => {
  const s = G.newGame(seeded(10));
  for (let d = 1; d <= C.seasonDays; d++) {
    assert.equal(typeof G.headline(Object.assign({}, s, { day: d })), 'string');
  }
});

console.log(passed + ' tests passed');
