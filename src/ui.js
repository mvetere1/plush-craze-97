// Screens and clicks. Reads rules from game.js and content from data.js.
// The whole screen is re-rendered after every action; buttons carry data-action (and data-id).
(function () {
  const G = window.PlushGame;
  const D = window.PlushData;
  const C = D.CONFIG;
  const app = document.getElementById('app');

  let state = G.newGame();
  let view = 'market'; // 'market' | 'map' | 'end'

  const money = (n) => '$' + n.toLocaleString('en-US');
  const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

  // ---------- shared pieces ----------

  function hypeInfo() {
    const h = G.hype(state.day, state.crashDay);
    const crashed = state.day >= state.crashDay;
    // The bar fills at the highest hype any season can reach, so a full bar never gives away the crash day.
    const maxLog = Math.log(C.hypeGrowth) * (C.crashWindow[1] - 2);
    const pct = Math.max(4, Math.min(100, Math.round((Math.log(Math.max(h, 1)) / maxLog) * 100)));
    return {
      label: h.toFixed(1) + '×',
      pct,
      crashed,
      note: crashed ? 'The bubble has popped. Prices keep sinking.'
        : (state.crashDay - state.day <= C.warningDays ? 'Something feels off. Watch the headlines.'
          : 'Prices are climbing. How high can they go?')
    };
  }

  function stat(label, value, extraClass) {
    return `<div class="stat ${extraClass || ''}"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;
  }

  // ---------- market screen ----------

  function dealTag(plushId) {
    const ratio = state.prices[plushId].buy / G.guide(state, plushId, state.day);
    if (ratio < C.steal) return '<span class="tag tag-steal">Steal!</span>';
    if (ratio > C.overpriced) return '<span class="tag tag-over">Overpriced</span>';
    return '<span class="tag tag-fair">Fair</span>';
  }

  function plushRow(p) {
    const pr = state.prices[p.id];
    const owned = state.shelf[p.id] || 0;
    const full = G.shelfUsed(state) >= C.shelfCapacity;
    const retired = G.isRetired(state, p.id, state.day) ? '<span class="retired">RETIRED</span>' : '';
    return `
      <div class="row">
        <div class="plush">
          <span class="badge" style="background:${p.color}">${p.name.charAt(0)}</span>
          <div class="plush-text">
            <span class="plush-name">${p.name}${retired}</span>
            <span class="plush-sub">${p.kind} · guide ${money(G.guide(state, p.id, state.day))}</span>
          </div>
        </div>
        <div>${dealTag(p.id)}</div>
        <span class="num">${money(pr.buy)}</span>
        <span class="num">${money(pr.sell)}</span>
        <span class="num muted">${owned}</span>
        <div class="trade">
          <button class="btn btn-buy" data-action="buy" data-id="${p.id}" ${state.cash < pr.buy || full ? 'disabled' : ''} aria-label="Buy one ${p.name}">Buy</button>
          <button class="btn btn-sell" data-action="sell" data-id="${p.id}" ${owned < 1 ? 'disabled' : ''} aria-label="Sell one ${p.name}">Sell</button>
        </div>
      </div>`;
  }

  function shelfPanel() {
    const items = D.PLUSHIES.filter((p) => state.shelf[p.id] > 0);
    const list = items.length
      ? items.map((p) => `<div class="shelf-item"><span><span class="dot" style="background:${p.color}"></span>${p.name}</span><span>× ${state.shelf[p.id]}</span></div>`).join('')
      : '<span class="hint">Nothing yet. Every collection starts somewhere!</span>';
    return `
      <div class="card">
        <div class="card-head"><h2>My shelf</h2><span class="hint">${G.shelfUsed(state)} of ${C.shelfCapacity} spots</span></div>
        ${list}
      </div>`;
  }

  function notesPanel() {
    const notes = Object.keys(state.notes)
      .filter((id) => id !== state.place)
      .map((id) => {
        const n = state.notes[id];
        const score = (p, side) => n.prices[p.id][side] / G.guide(state, p.id, n.day);
        const lo = D.PLUSHIES.reduce((a, b) => (score(b, 'buy') < score(a, 'buy') ? b : a));
        const hi = D.PLUSHIES.reduce((a, b) => (score(b, 'sell') > score(a, 'sell') ? b : a));
        return { id, day: n.day, lo, hi, prices: n.prices };
      })
      .sort((a, b) => b.day - a.day)
      .slice(0, 2);
    const body = notes.length
      ? notes.map((n) => `
          <div class="note">
            <span class="note-title">${G.place(n.id).name} <span class="hint">· day ${n.day}</span></span>
            <span>Cheap: ${n.lo.name} ${money(n.prices[n.lo.id].buy)}</span>
            <span>Buys high: ${n.hi.name} ${money(n.prices[n.hi.id].sell)}</span>
          </div>`).join('')
      : '<span class="hint">Shop around town and you\'ll jot prices down here.</span>';
    return `<div class="card"><h2>Price notes</h2>${body}</div>`;
  }

  function actions() {
    if (G.isLastDay(state)) {
      return '<button class="btn btn-big btn-dark" data-action="end">Cash out for good</button>';
    }
    return `
      <button class="btn btn-big btn-pink" data-action="map" ${G.canTravelAnywhere(state) ? '' : 'disabled'}>Head out</button>
      <button class="btn btn-wait" data-action="wait">Wait a day here</button>`;
  }

  function marketView() {
    const hy = hypeInfo();
    const msg = G.isLastDay(state) ? state.msg + ' Last day! Sell what you can, then cash out.' : state.msg;
    return `
      <div class="screen market">
        <div class="frame">
          <header class="top">
            <div class="sticker sticker-yellow where">
              <span class="eyebrow">NOW SHOPPING AT</span>
              <h1>${G.place(state.place).name}</h1>
            </div>
            <div class="sticker hype">
              <div class="hype-head"><span class="eyebrow">HYPE-O-METER</span><span class="hype-num">${hy.label}</span></div>
              <div class="bar"><div class="bar-fill ${hy.crashed ? 'crashed' : ''}" style="width:${hy.pct}%"></div></div>
              <span class="hint">${hy.note}</span>
            </div>
            <div class="stats">
              ${stat('CASH', money(state.cash), 'stat-green')}
              ${stat('DAY', `${state.day}<small> / ${C.seasonDays}</small>`)}
              ${stat('SHELF', `${G.shelfUsed(state)}<small> / ${C.shelfCapacity}</small>`)}
            </div>
          </header>

          <div class="ticker"><span class="extra">EXTRA!</span><span>${G.headline(state)}</span></div>

          <div class="body">
            <section class="table">
              <div class="row row-head">
                <span>PLUSHIE</span><span>DEAL?</span><span>BUY</span><span>SELL</span><span>OWN</span><span class="right">TRADE</span>
              </div>
              ${D.PLUSHIES.map(plushRow).join('')}
              <p class="msg">${msg}</p>
            </section>
            <aside class="side">
              ${shelfPanel()}
              ${notesPanel()}
              <div class="actions">${actions()}</div>
            </aside>
          </div>
        </div>
      </div>`;
  }

  // ---------- map screen ----------

  const MAP_ART = `
    <svg class="map-art" width="1280" height="800" viewBox="0 0 1280 800" aria-hidden="true">
      <g stroke="#54D2C6" stroke-width="2"><path d="M0 160 H1280 M0 380 H1280 M0 660 H1280 M160 0 V800 M420 0 V800 M720 0 V800 M960 0 V800 M1180 0 V800"/></g>
      <path d="M330 330 C380 300 470 320 470 380 C470 440 380 450 340 420 C300 395 290 350 330 330 Z" fill="#9BE564" stroke="#1B1035" stroke-width="4"/>
      <circle cx="370" cy="370" r="8" fill="#1B1035"/><circle cx="420" cy="360" r="8" fill="#1B1035"/><circle cx="400" cy="405" r="8" fill="#1B1035"/>
      <ellipse cx="1050" cy="620" rx="80" ry="40" fill="#7FC8F8" stroke="#1B1035" stroke-width="4"/>
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path id="roads" d="M230 470 L300 230 L590 290 L1040 300 L860 560 L560 590 L230 470 M590 290 L560 590" stroke="#1B1035" stroke-width="34"/>
        <path d="M230 470 L300 230 L590 290 L1040 300 L860 560 L560 590 L230 470 M590 290 L560 590" stroke="#FFF8E7" stroke-width="24"/>
        <path d="M230 470 L300 230 L590 290 L1040 300 L860 560 L560 590 L230 470 M590 290 L560 590" stroke="#FFD23F" stroke-width="3" stroke-dasharray="12 12"/>
      </g>
      <path d="M60 720 q24 -28 48 0 t48 0 t48 0" fill="none" stroke="#FFD23F" stroke-width="7" stroke-linecap="round"/>
      <path d="M760 120 l24 -40 l24 40 Z" fill="#FF4FA3" stroke="#1B1035" stroke-width="4" stroke-linejoin="round"/>
      <rect x="1150" y="440" width="44" height="44" rx="6" fill="#FFD23F" stroke="#1B1035" stroke-width="4" transform="rotate(18 1172 462)"/>
      <circle cx="700" cy="720" r="18" fill="#FF4FA3" stroke="#1B1035" stroke-width="4"/>
      <path d="M880 730 q20 -24 40 0 t40 0 t40 0" fill="none" stroke="#7B2CBF" stroke-width="7" stroke-linecap="round"/>
    </svg>`;

  const SHOP_ICON = '<svg width="34" height="30" viewBox="0 0 34 30" aria-hidden="true"><path d="M3 12 L6 3 H28 L31 12 Z" fill="#FF4FA3" stroke="#1B1035" stroke-width="2.5" stroke-linejoin="round"/><rect x="5" y="12" width="24" height="16" fill="#FFF8E7" stroke="#1B1035" stroke-width="2.5"/><rect x="14" y="18" width="6" height="10" fill="#7B2CBF" stroke="#1B1035" stroke-width="2"/></svg>';

  function spotButton(p) {
    const here = p.id === state.place;
    const d = G.travelDays(state.place, p.id);
    const ok = G.canReach(state, p.id);
    const sub = here ? "You're here" : (ok ? plural(d, 'day') + ' away' : 'No time left');
    const aria = here ? p.name + ', you are here' : 'Go to ' + p.name + ', ' + plural(d, 'day');
    return `
      <button class="spot ${here ? 'here' : ''}" style="left:${p.x - 105}px; top:${p.y - 32}px"
        data-action="travel" data-id="${p.id}" ${ok ? '' : 'disabled'} aria-label="${aria}">
        ${SHOP_ICON}
        <span class="spot-text"><span class="spot-name">${p.name}</span><span class="spot-sub">${sub}</span></span>
      </button>`;
  }

  function endOverlay() {
    const s = G.finalScore(state);
    const verdict = s.total >= C.tycoonScore ?'Plush tycoon! You rode the bubble like a pro.'
      : (s.total > C.startCash ? 'Not bad, kid. You came out ahead.' : "Ouch. Should've sold sooner...");
    const leftover = s.unsold ? `<span>${plural(s.unsold, 'unsold plushie')}, worth ${money(s.leftover)} at a garage sale</span>` : '';
    return `
      <div class="overlay">
        <div class="end-card" role="dialog" aria-label="Season results">
          <span class="extra">The craze is over</span>
          <h2>${money(s.total)}</h2>
          <strong>${verdict}</strong>
          <span>Cash in hand: ${money(s.cash)} (you started with ${money(C.startCash)})</span>
          ${leftover}
          <span class="hint">The bubble popped on day ${state.crashDay}.</span>
          <button class="btn btn-big btn-pink" data-action="restart">Play again</button>
        </div>
      </div>`;
  }

  function mapView() {
    const hy = hypeInfo();
    return `
      <div class="screen map">
        ${MAP_ART}
        <div class="sticker sticker-yellow map-title"><h1>Plush Craze '97</h1><span>Around town</span></div>
        <div class="stats map-stats">
          ${stat('CASH', money(state.cash), 'stat-green')}
          ${stat('DAY', state.day + ' / ' + C.seasonDays)}
          ${stat('SHELF', G.shelfUsed(state) + ' / ' + C.shelfCapacity)}
          ${stat('HYPE', hy.label, 'stat-pink')}
        </div>
        ${D.PLACES.map(spotButton).join('')}
        <div class="card where-next">
          <h2>Where to next?</h2>
          <p>You're at ${G.place(state.place).name} on day ${state.day}. Every trip takes time, and the craze keeps moving while you're on the road.</p>
          <button class="btn btn-wait" data-action="market">Back to the shop</button>
        </div>
        ${view === 'end' ? endOverlay() : ''}
      </div>`;
  }

  // ---------- wiring ----------

  function render() {
    app.innerHTML = view === 'market' ? marketView() : mapView();
  }

  app.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const id = btn.dataset.id;
    switch (btn.dataset.action) {
      case 'buy': state = G.buy(state, id); break;
      case 'sell': state = G.sell(state, id); break;
      case 'wait': state = G.wait(state); break;
      case 'travel': state = G.travel(state, id); view = 'market'; break;
      case 'map': view = 'map'; break;
      case 'market': view = 'market'; break;
      case 'end': view = 'end'; break;
      case 'restart': state = G.newGame(); view = 'market'; break;
      default: return;
    }
    render();
  });

  render();
})();
