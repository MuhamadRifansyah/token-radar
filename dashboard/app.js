// Token Radar's dashboard, radar-2. It reads window.RADAR (dashboard/data.js, written by main.ts
// from the same board as board.json) and renders the ranked board, a filterable table and a
// per-protocol detail drawer with the model's inputs and the farm plan. No network. The page
// recomputes each row's implied value and farm plan with the same functions main.ts uses.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var M = DATA.model;
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre', wl: false, sort: 'implied', dir: -1, selected: null };

  var CUT = {};
  M.cut_categories.forEach(function (c) { CUT[c] = true; });
  var VER = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

  // The compact rows decoded: pre-token rows carry their radar rank (their place among pre-token
  // rows); live rows carry the market cap the snapshot records.
  var PRE = DATA.rows.map(function (a, i) {
    return { slug: a[0], name: a[1], cat: DATA.cats[a[2]], chains: a[3].map(function (x) { return DATA.chains[x]; }), tvl: a[4], chg: a[5], age: a[6], implied: a[7], rank: i + 1, wl: DATA.wlb[i] === '1' };
  });
  var LIVE = DATA.live.map(function (a) {
    return { slug: a[0], name: a[1], symbol: a[2], cat: DATA.cats[a[3]], chains: a[4].map(function (x) { return DATA.chains[x]; }), tvl: a[5], mcap: a[6], chg: a[7], implied: a[8] };
  });
  var BY_SLUG = {};
  PRE.concat(LIVE).forEach(function (r) { BY_SLUG[r.slug] = r; });

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // The model in one function, the same arithmetic main.ts runs: base x growth x maturity x category.
  function catMult(r) { return (CUT[r.cat] || VER.test(r.name)) ? M.category_cut : 1; }
  function impliedOf(r) {
    var g = Math.min(M.growth_cap, Math.max(M.growth_floor, r.chg === null || r.chg === undefined ? 0 : r.chg));
    var gm = 1 + (g / 100) * M.growth_weight;
    var age = r.age === null || r.age === undefined ? M.unknown_age_days : r.age;
    var mm = M.maturity_floor + (Math.min(Math.max(age, 0), M.maturity_days) / M.maturity_days) * M.maturity_range;
    var cm = catMult(r);
    return { implied: Math.max(1, Math.round(r.tvl * M.base_multiple * gm * mm * cm)), g: g, gm: gm, mm: mm, cm: cm };
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function t(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; n.textContent = text; return n; }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and age
  // decide the action, the capital, the hold and every cost and time. No name is special-cased.
  var GAS = { Ethereum: 5, Arbitrum: 0.3, Base: 0.2, Optimism: 0.3, Solana: 0.01, Binance: 0.2, Avalanche: 0.3, Polygon: 0.1, 'zkSync Era': 0.3, Linea: 0.3, Scroll: 0.3, Sui: 0.01, Aptos: 0.01, Tron: 0.5, Fantom: 0.1, Mantle: 0.1, Blast: 0.2, Mode: 0.1, Fraxtal: 0.1, Sonic: 0.1, Berachain: 0.2, 'Hyperliquid L1': 0.01, 'Bittensor EVM': 0.1, Unichain: 0.1, Ink: 0.1, Katana: 0.1, Sei: 0.05, 'World Chain': 0.1, Abstract: 0.1, Soneium: 0.1, Gravity: 0.1, 'X Layer': 0.1, Cronos: 0.1 };
  function gasFor(chain) { return GAS[chain] === undefined ? 1 : GAS[chain]; }
  function gasStr(g) { return g >= 1 ? '$' + g : '$' + g.toFixed(2); }
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl >= 5e9) return 250;
    if (p.tvl >= 1e9) return 150;
    if (p.tvl >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  // The category's two actions as a table: [match, main, second]. $C capital, $N protocol,
  // $H chain, $P half, $Q quarter, $T third, $F four tenths, $W a fifth. First match wins.
  var ACT = [
    ['lend|cdp|collateral', 'Supply $C of USDC to $N on $H and keep the supply open so the position earns interest.', 'Borrow $F of USDC against the supply and repay it within a week.'],
    ['dex', "Provide $C of liquidity to $N's main USDC pair on $H and keep the position in range.", 'Swap $Q through $N on $H once a week, alternating the direction.'],
    ['yield|leveraged farm|farm', "Deposit $C of USDC into $N's highest-yield vault on $H and leave it compounding.", "Claim the vault's yield once a week and redeposit it."],
    ['bridge', 'Bridge $C of USDC to $H through $N and use the bridged funds in an app on that chain.', 'Bridge $P back a week later, then bridge again.'],
    ['staking|restak', "Stake $C of $H's staking asset through $N and keep the receipt token in the wallet.", 'Use the receipt token once in a $H app, such as a lending market.'],
    ['perpetual|derivative|options|synthetic', 'Deposit $C of USDC as margin on $N and open one small hedged position on $H.', 'Close the position after a few days and open another, keeping each trade under $P of notional.'],
    ['prediction', 'Fund the account with $C and place one market position on $N, sized under $P.', 'Settle one position a week and open another.'],
    ['curator|allocator', 'Deposit $C into a $N vault on $H and keep the vault shares in the wallet.', 'Move $P into a second $N vault on $H after two weeks.'],
    ['stable', 'Mint or deposit $C of the stable asset through $N on $H and hold it in the wallet.', 'Use $P of the stable asset in a $H lending market once, then return it to the wallet.'],
    ['rwa', "Mint $C of the protocol's yield-bearing asset on $H and hold it for the full period.", 'Let the yield accrue for 30 days, then claim or compound it once.'],
    ['insurance', 'Buy $C of cover from $N on $H and keep the policy active for the full term.', 'Top up the cover by $T after a month if the policy allows it.'],
    ['payment|card', 'Top up $C on $N and spend $P through its card or payment rail on $H.', 'Make one card payment a week, at least $W each.'],
    ['chain', "Bridge $C of USDC to $H and use it in two of the chain's own apps.", "Stake $P of the chain's native asset through a validator or the chain's staking app."],
    ['cex', 'Deposit $C of USDC to $N and place one spot trade under $P.', 'Keep $P on the exchange for two weeks, then withdraw half of it to the wallet.'],
  ];
  function actionsFor(p, capital, chain) {
    var c = (p.cat || '').toLowerCase();
    var vals = { $C: '$' + capital, $N: p.name, $H: chain, $P: '$' + Math.round(capital * 0.5), $Q: '$' + Math.round(capital * 0.25), $T: '$' + Math.round(capital * 0.3), $F: '$' + Math.round(capital * 0.4), $W: '$' + Math.round(capital * 0.2) };
    function fill(t) { return t.replace(/\$[CNHPTQFW]/g, function (k) { return String(vals[k]); }); }
    for (var i = 0; i < ACT.length; i++) {
      if (new RegExp(ACT[i][0]).test(c)) return { main: fill(ACT[i][1]), second: fill(ACT[i][2]) };
    }
    return { main: fill('Deposit $C of USDC into $N on $H and keep the position open.'), second: 'Make one more qualifying action a week, such as a deposit, a swap or a vote.' };
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age);
    var gas = gasFor(chain);
    var act = actionsFor(p, capital, chain);
    var fund = chain === 'Ethereum'
      ? { text: 'Fund the wallet with $' + capital + ' of USDC on Ethereum, ready to deploy into ' + p.name + '.', cost: 'about ' + gasStr(gas) + ' of gas', time: '5 minutes' }
      : { text: 'Bridge $' + capital + ' of USDC from Ethereum to ' + chain + ' with the official bridge or a trusted bridge, ready to deploy into ' + p.name + '.', cost: 'about $5 to $10 of gas for the bridge', time: '10 to 30 minutes' };
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      fund,
      { text: act.main, cost: '$' + capital + ' of capital and about ' + gasStr(gas) + ' of gas', time: '15 minutes to set up' },
      { text: act.second, cost: 'about ' + gasStr(gas) + ' of gas a time', time: '10 minutes a week' },
      { text: 'Repeat one qualifying action each week, such as a deposit, a borrow, a swap or a vote, so the account shows steady activity.', cost: 'about ' + gasStr(gas) + ' of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }
  function liveSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var gas = gasFor(chain);
    var token = p.symbol ? '$' + p.symbol : 'the token';
    return [
      { text: 'Buy $' + capital + ' of ' + token + ' on a decentralised exchange on ' + chain + ', at the market price, and move it to a wallet you control.', cost: '$' + capital + ' of capital and about ' + gasStr(gas) + ' of gas', time: '10 minutes' },
      { text: 'Stake or provide liquidity with $' + Math.round(capital * 0.5) + ' of ' + token + ' through ' + p.name + ' on ' + chain + ' to earn fees or yield.', cost: 'about ' + gasStr(gas) + ' of gas', time: '15 minutes' },
      { text: 'Vote on one governance proposal with the position, or delegate the voting power, so the stake is active.', cost: 'about ' + gasStr(gas) + ' of gas', time: '10 minutes' },
      { text: 'Check the position once a week and compound or claim the yield, keeping the position size under $' + (capital * 2) + '.', cost: 'about ' + gasStr(gas) + ' of gas a week', time: '10 minutes a week' },
      { text: 'Set an exit rule before the position grows: take profit above $' + (capital * 2) + ' of value and never add funds you cannot afford to lose.', cost: 'nothing but the rule', time: '5 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('wl') === '1') state.wl = true;
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'pre') params.set('tab', state.tab);
    if (state.wl) params.set('wl', '1');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return PRE.filter(function (r) {
      if (state.wl && !r.wl) return false;
      if (state.category !== 'all' && r.cat !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.cat, r.chains.join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl; bv = b.tvl; }
      else if (key === 'growth') { av = a.chg === null ? -Infinity : a.chg; bv = b.chg === null ? -Infinity : b.chg; }
      else if (key === 'age') { av = a.age === null ? Infinity : a.age; bv = b.age === null ? Infinity : b.age; }
      else { av = a.implied; bv = b.implied; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The radar scores all ' + DATA.pre_size + ' pre-token protocols; the table shows the top ' + DATA.rows.length + ' by implied value, and the ' + DATA.live_size + ' whose token already trades are set aside with their market caps. Implied value is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, t('span', null, 'Watchlist covered'), t('b', null, DATA.watchlist_size + ' / ' + DATA.watchlist_size)),
        el('div', { class: 'fact' }, t('span', null, 'Pre-token rows scored'), t('b', null, String(DATA.pre_size))),
        el('div', { class: 'fact' }, t('span', null, 'Live-token protocols set aside'), t('b', null, String(DATA.live_size))),
        el('div', { class: 'fact' }, t('span', null, 'Board rows in total'), t('b', null, String(DATA.board_size)))
      )
    );
  }

  function toplist() {
    var top = PRE.slice(0, 10);
    var max = top[0] ? top[0].implied : 1;
    var rows = top.map(function (r) {
      return el('div', { class: 'toprow' },
        el('span', { class: 'num', text: String(r.rank) }),
        el('span', { class: 'topname', text: r.name }),
        el('div', { class: 'topbar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied / max) * 100)) + '%' })),
        el('span', { class: 'val', text: fmtUsd(r.implied) })
      );
    });
    return el('section', { class: 'toplist' },
      el('h2', { text: 'Top 10 by implied value' }),
      rows
    );
  }

  function topChains() {
    var counts = {};
    PRE.forEach(function (r) { r.chains.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; }); });
    return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 12);
  }

  function controls() {
    var categories = DATA.cats.slice().sort();
    var chains = topChains();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre'; state.sort = 'implied'; state.dir = -1; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; state.sort = 'implied'; state.dir = -1; render(); } });
    var wlBox = el('label', { class: 'check' },
      el('input', { type: 'checkbox', checked: state.wl ? 'checked' : null, onchange: function (e) { state.wl = e.target.checked; writeHash(); render(); } }),
      'Watchlist only'
    );
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSel),
      el('div', { class: 'field' }, el('span', { text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      state.tab === 'pre' ? wlBox : null,
      el('span', { class: 'count', text: state.tab === 'pre' ? rows().length + ' rows shown' : LIVE.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.wl = false; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.chg === null ? 'n/a' : fmtPct(r.chg);
      var growthClass = r.chg === null ? '' : r.chg >= 0 ? 'pos' : 'neg';
      var cut = catMult(r) < 1;
      var sub = (r.cat || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + (cut ? ' · cut ×0.01' : '');
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: sub })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied) })
        )),
        el('td', null, el('span', { class: r.wl ? 'badge wl' : 'badge pre', text: r.wl ? 'WATCHLIST' : 'PRE-TOKEN' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    var list = LIVE.slice().sort(function (a, b) { return (b.mcap === null ? 0 : b.mcap) - (a.mcap === null ? 0 : a.mcap) || b.tvl - a.tvl; });
    list.forEach(function (r) {
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.cat || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl) }),
        el('td', { class: 'num ' + (r.chg !== null && r.chg >= 0 ? 'pos' : 'neg'), text: fmtPct(r.chg) }),
        el('td', { class: 'num', text: r.mcap === null ? fmtUsd(r.implied) + ' *' : fmtUsd(r.mcap) }),
        el('td', null, el('span', { class: 'badge live', text: 'TOKEN LIVE' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking. * means no market cap was recorded, so the value is a tenth of TVL.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = M;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every pre-token row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x ' + m.base_multiple + ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x category )'
      ),
      el('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days.' }),
      el('p', { class: 'sub', text: 'Category is ' + m.category_cut + ' for ' + m.cut_categories.join(', ') + ', and for a versioned pool (a name ending in V2, v2 or 2.0): those are exchanges, bridges, wrapped or staked products of a token that already trades, and they will almost certainly never issue a token of their own, so their launch value is cut by 99%. Everything else is 1.00. A live-token protocol is valued at its market cap, or a tenth of its TVL when no market cap is recorded.' }),
      el('p', { class: 'sub', text: 'Why the cut matters: the biggest pre-token protocols by TVL are Bybit, Bitfinex, Robinhood, WBTC and Binance staked ETH. Ranked by TVL alone they would sit on top; the cut drops them to the bottom half, and the watchlist DeFi protocols — Steakhouse Financial, Gauntlet, Veda, USDD — take the top.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = BY_SLUG[slug];
    if (!row) return;
    var isPre = row.rank !== undefined;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = isPre ? farmSteps(row) : liveSteps(row);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: isPre ? 'Radar rank ' + row.rank + ' of ' + DATA.pre_size : 'Live token' }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.cat || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    if (isPre) {
      var calc = impliedOf(row);
      dialog.appendChild(el('section', { class: 'detail-section' },
        el('h3', { text: 'Implied value' }),
        el('div', { class: 'equation' }, [
          ['TVL', fmtUsd(row.tvl)],
          ['Seven-day growth', fmtPct(row.chg)],
          ['Age with no token', fmtAge(row.age)],
          ['Growth multiplier', String(Math.round(calc.gm * 1e4) / 1e4)],
          ['Maturity multiplier', String(Math.round(calc.mm * 1e4) / 1e4)],
          ['Category multiplier', String(calc.cm) + (calc.cm < 1 ? '  (cut: cannot launch a token)' : '')],
          ['Implied value', fmtUsd(row.implied)]
        ].map(function (kv) { return el('div', null, t('span', null, kv[0]), t('b', 'num', kv[1])); })),
        el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(calc.implied) + (calc.implied === row.implied ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
      ));
    } else {
      dialog.appendChild(el('section', { class: 'detail-section' },
        el('h3', { text: 'Market value' }),
        el('div', { class: 'equation' }, [
          ['TVL', fmtUsd(row.tvl)],
          ['Seven-day growth', fmtPct(row.chg)],
          ['Market cap', row.mcap === null ? fmtUsd(row.implied) + ' (TVL x 0.10, no cap recorded)' : fmtUsd(row.mcap)]
        ].map(function (kv) { return el('div', null, t('span', null, kv[0]), t('b', 'num', kv[1])); })),
        el('p', { class: 'sub', text: 'This token already trades, so its value is the market cap the snapshot records — a fact, not a model — and it is set aside from the pre-token ranking.' })
      ));
    }
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: isPre ? 'Farm plan' : 'Plan for a live token' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(toplist());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre' ? boardTable() : liveTable());
    if (state.tab === 'pre') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
