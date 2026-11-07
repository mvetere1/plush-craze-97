// Game rules. No DOM code here, so these functions can be tested in Node.
// Every action takes a state and returns a NEW state (the old one is never changed).
// Functions that roll dice take an optional rng (defaults to Math.random) so tests can be repeatable.
(function (root) {
  const D = root.PlushData || require('./data.js');
  const C = D.CONFIG;

  const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const place = (id) => D.PLACES.find((p) => p.id === id);
  const plush = (id) => D.PLUSHIES.find((p) => p.id === id);

  // Hype multiplier on a given day. Grows every day, then collapses on crashDay.
  function hype(day, crashDay) {
    if (day < crashDay) return Math.pow(C.hypeGrowth, day - 1);
    const peak = Math.pow(C.hypeGrowth, crashDay - 2);
    return peak * C.crashDrop * Math.pow(C.postCrashDecay, day - crashDay);
  }

  function isRetired(state, plushId, day) {
    return plushId === state.retiredId && day >= state.retireDay;
  }

  // The "price guide" value: what a plushie is worth in general on that day.
  function guide(state, plushId, day) {
    const p = plush(plushId);
    const b = isRetired(state, plushId, day) ? C.retireBoost : 1;
    return Math.max(1, Math.round(p.base * hype(day, state.crashDay) * b));
  }

  // Roll buy and sell prices for every plushie at one place on one day.
  function genPrices(state, placeId, day, rng) {
    rng = rng || Math.random;
    const loc = place(placeId);
    const h = hype(day, state.crashDay);
    const out = {};
    D.PLUSHIES.forEach((p) => {
      const special = loc.cheap === p.id ? 0.7 : 1;
      const b = isRetired(state, p.id, day) ? C.retireBoost : 1;
      const wobble = 1 + loc.noise * (rng() * 2 - 1);
      const raw = p.base * loc.mult * Math.pow(h, loc.k) * b * special * wobble;
      out[p.id] = { buy: Math.max(1, Math.round(raw)), sell: Math.max(1, Math.round(raw * loc.spread)) };
    });
    return out;
  }

  function newGame(rng) {
    rng = rng || Math.random;
    const state = {
      place: C.startPlace,
      day: 1,
      cash: C.startCash,
      shelf: {},   // plushId -> count
      notes: {},   // placeId -> { day, prices } from your last visit
      crashDay: randInt(rng, C.crashWindow[0], C.crashWindow[1]),
      retireDay: randInt(rng, C.retireWindow[0], C.retireWindow[1]),
      retiredId: D.PLUSHIES[randInt(rng, 0, D.PLUSHIES.length - 1)].id,
      msg: "It's 1997 and everyone's nuts for bean-filled plushies. Turn your $60 into a fortune before the craze ends!"
    };
    state.prices = genPrices(state, state.place, 1, rng);
    return state;
  }

  const shelfUsed = (state) => Object.values(state.shelf).reduce((n, c) => n + c, 0);

  function travelDays(fromId, toId) {
    const a = place(fromId);
    const b = place(toId);
    return Math.max(1, Math.round(Math.hypot(a.x - b.x, a.y - b.y) / C.travelDivisor));
  }

  function canReach(state, placeId) {
    return placeId !== state.place && state.day + travelDays(state.place, placeId) <= C.seasonDays;
  }

  const canTravelAnywhere = (state) => D.PLACES.some((p) => canReach(state, p.id));
  const isLastDay = (state) => state.day >= C.seasonDays;

  function buy(state, plushId) {
    const price = state.prices[plushId].buy;
    if (state.cash < price || shelfUsed(state) >= C.shelfCapacity) return state;
    const shelf = Object.assign({}, state.shelf, { [plushId]: (state.shelf[plushId] || 0) + 1 });
    return Object.assign({}, state, {
      cash: state.cash - price,
      shelf,
      msg: 'Bought ' + plush(plushId).name + ' for $' + price + '. Tag protector on, straight to the shelf.'
    });
  }

  function sell(state, plushId) {
    const owned = state.shelf[plushId] || 0;
    if (owned < 1) return state;
    const price = state.prices[plushId].sell;
    const shelf = Object.assign({}, state.shelf, { [plushId]: owned - 1 });
    return Object.assign({}, state, {
      cash: state.cash + price,
      shelf,
      msg: 'Sold ' + plush(plushId).name + ' for $' + price + '. Ka-ching!'
    });
  }

  function rememberHere(state) {
    return Object.assign({}, state.notes, { [state.place]: { day: state.day, prices: state.prices } });
  }

  function travel(state, placeId, rng) {
    if (!canReach(state, placeId)) return state;
    const d = travelDays(state.place, placeId);
    const day = state.day + d;
    const next = Object.assign({}, state, {
      notes: rememberHere(state),
      place: placeId,
      day,
      msg: 'Made it to ' + place(placeId).name + ' after ' + d + (d === 1 ? ' day.' : ' days.')
    });
    next.prices = genPrices(next, placeId, day, rng);
    return next;
  }

  function wait(state, rng) {
    if (isLastDay(state)) return state;
    const day = state.day + 1;
    const next = Object.assign({}, state, {
      notes: rememberHere(state),
      day,
      msg: 'You hung around ' + place(state.place).name + ' for a day. Prices moved.'
    });
    next.prices = genPrices(next, state.place, day, rng);
    return next;
  }

  function headline(state) {
    const H = D.HEADLINES;
    const day = state.day;
    const pick = (list, i) => list[((i % list.length) + list.length) % list.length];
    if (day >= state.crashDay) return pick(H.crash, day - state.crashDay);
    if (day === state.retireDay) {
      const r = plush(state.retiredId);
      return H.retired.replace('{name}', r.name).replace('{kind}', r.kind);
    }
    if (state.crashDay - day <= C.warningDays) return pick(H.warning, day);
    const h = hype(day, state.crashDay);
    if (h < 2) return pick(H.early, day);
    if (h < 5) return pick(H.rising, day);
    return pick(H.mania, day);
  }

  // Leftover plushies are valued at what a garage sale would pay for them today.
  function finalScore(state) {
    const garage = place('garage');
    const h = hype(state.day, state.crashDay);
    let leftover = 0;
    D.PLUSHIES.forEach((p) => {
      const n = state.shelf[p.id] || 0;
      if (!n) return;
      const b = isRetired(state, p.id, state.day) ? C.retireBoost : 1;
      leftover += n * Math.max(1, Math.round(p.base * garage.mult * Math.pow(h, garage.k) * b * garage.spread));
    });
    return { cash: state.cash, leftover, unsold: shelfUsed(state), total: state.cash + leftover };
  }

  const api = {
    place, plush, hype, guide, genPrices, newGame, shelfUsed, travelDays, canReach,
    canTravelAnywhere, isLastDay, isRetired, buy, sell, travel, wait, headline, finalScore
  };
  root.PlushGame = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
