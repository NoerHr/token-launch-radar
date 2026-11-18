// Token Launch Radar — dashboard (radar-2).
// Reads window.RADAR (written beside dashboard/ by main.ts from the same board that becomes
// board.json) and renders the ranked board, its filters, a per-protocol detail drawer with the
// model's own arithmetic, a model sandbox, and the protocol's farm plan. No network, no fetch:
// every byte it shows arrived in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var M = DATA.model;
  var state = {
    q: '', category: 'all', chain: 'all', momentum: 'all', watchOnly: false,
    tab: 'pre-token', sort: 'implied', dir: -1, selected: null,
    sandbox: { growth_weight: M.growth_weight, maturity_range: M.maturity_range, breadth_step: M.breadth_step },
  };

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

  // The model, in the page, exactly as lib/model.ts computes it: tiered TVL multiple, clamped
  // seven-day growth, maturity from age with no token, breadth from the chain count. With the
  // sandbox at its defaults this returns the number board.json carries for the row.
  function tierOf(tvl) {
    if (tvl >= M.high_tvl_usd) return M.multiple_high;
    if (tvl >= M.mid_tvl_usd) return M.multiple_mid;
    if (tvl >= M.low_tvl_usd) return M.multiple_low;
    return M.multiple_early;
  }
  function impliedOf(row, sb) {
    var growth = Math.min(M.growth_cap, Math.max(M.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * sb.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? M.unknown_age_days : row.age_days;
    var maturity = M.maturity_floor + (Math.min(Math.max(age, 0), M.maturity_days) / M.maturity_days) * sb.maturity_range;
    var extra = Math.min(Math.max((row.chains ? row.chains.length : 1) - 1, 0), M.breadth_max_extra);
    var breadth = 1 + extra * sb.breadth_step;
    return Math.max(1, Math.round(row.tvl_usd * tierOf(row.tvl_usd) * growthMult * maturity * breadth));
  }
  function sandboxActive() {
    return state.sandbox.growth_weight !== M.growth_weight ||
      state.sandbox.maturity_range !== M.maturity_range ||
      state.sandbox.breadth_step !== M.breadth_step;
  }
  function shownImplied(row) { return sandboxActive() ? impliedOf(row, state.sandbox) : row.implied_value_usd; }

  function momentumOf(row) {
    // board.json carries the signal the model computed; the buckets below are the same rule,
    // kept so a row without the fields still labels correctly.
    if (row.signal_key && row.signal) return { key: row.signal_key, label: row.signal };
    var g = row.change_7d;
    if (g === null || g === undefined) return { key: 'nodata', label: 'No 7d data' };
    if (g >= 10) return { key: 'surging', label: 'Surging' };
    if (g >= 3) return { key: 'rising', label: 'Rising' };
    if (g > -3) return { key: 'flat', label: 'Flat' };
    if (g > -10) return { key: 'cooling', label: 'Cooling' };
    return { key: 'falling', label: 'Falling' };
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
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

  // The farm plan, derived in the page exactly as main.ts writes it to board.json: the category
  // picks the two actions, the first chain picks the gas, the TVL picks the capital, the age
  // picks the hold. No protocol name is special-cased anywhere in this file.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function gasFor(chain) {
    var c = String(chain).toLowerCase();
    if (c === 'ethereum') return '$12';
    if (c === 'bitcoin') return '$5';
    if (c === 'solana') return '$0.25';
    if (c === 'tron') return '$1';
    if (c === 'binance' || c === 'bsc') return '$0.60';
    return '$2';
  }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 45;
    if (age < 180) return 60;
    if (age < 365) return 45;
    if (age < 730) return 35;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the supply position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + " of liquidity to " + name + "'s main pool on " + chain + ', split evenly across both sides of the pool.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and spend the bridged funds inside its app the same day.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + " worth of the chain's staking asset through " + name + ' and keep the staking receipt in the same wallet.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position, long and short the same size.';
    if (c.indexOf('prediction') >= 0) return 'Fund the wallet with $' + capital + ' and place one market position on ' + name + ' in a market that closes within 30 days.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0) return 'Deposit $' + capital + ' into one ' + name + ' vault on ' + chain + ' and keep the vault shares in the wallet.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold the minted asset.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of ' + name + "'s yield asset on " + chain + ' and hold it through one full distribution cycle.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' for the asset you already hold there and keep the policy active.';
    if (c.indexOf('chain') >= 0) return 'Move $' + capital + ' of activity onto ' + name + ': fund a wallet on it and make the transfers below from that wallet.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function secondActionFor(p, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow no more than 20% against the supply on ' + name + ', hold the borrow for one day, then repay it in full.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Make one swap through the same ' + name + ' pool and add the proceeds back into the liquidity position.';
    if (c.indexOf('bridge') >= 0) return 'Bridge a $10 test amount back through ' + name + ', then bridge in again, so both directions appear in the wallet history.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Claim the staking rewards from ' + name + ' once and restake them instead of selling, keeping the new receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Open and close one additional small hedged trade on ' + name + ' a week later, keeping margin under the first deposit.';
    if (c.indexOf('prediction') >= 0) return 'Place one position in a second ' + name + ' market with a different closing date, sized under $10.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0) return 'Move 20% of the deposit into a second ' + name + ' vault on ' + chain + ' and keep both share balances until the hold ends.';
    if (c.indexOf('stable') >= 0) return 'Redeem a $10 slice of the stable asset through ' + name + ' once, then mint it back the same week.';
    if (c.indexOf('rwa') >= 0) return 'Record one distribution payout from ' + name + ' in the farm log and leave the yield asset untouched that week.';
    if (c.indexOf('insurance') >= 0) return 'Extend or renew the ' + name + ' cover once before it lapses, so the policy never shows a gap.';
    return 'Make one extra $10 deposit into ' + name + ' and one $10 withdrawal a week later, so both directions are on record.';
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
    var hold = holdDaysFor(p.age_days);
    var gas = gasFor(chain);
    var weeks = Math.max(1, Math.ceil(hold / 7));
    return [
      { text: 'Create a fresh wallet for ' + p.name + ' only, fund it from your main wallet, and keep its seed phrase offline on paper.', cost: 'about ' + gas + ' of gas to fund it on ' + chain, time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital plus about ' + gas + ' of gas', time: '15 minutes to set up' },
      { text: secondActionFor(p, chain), cost: 'about ' + gas + ' of gas, no new capital beyond step 2', time: '10 minutes' },
      { text: 'Repeat one qualifying action on ' + p.name + ' every week for ' + weeks + ' weeks — a deposit, a swap, a claim or a vote — and never miss two weeks in a row.', cost: 'about ' + gas + ' of gas a week', time: '10 minutes a week' },
      { text: 'Hold the ' + p.name + ' position for at least ' + hold + ' days, so the activity spans more than one weekly snapshot of the protocol.', cost: 'the $' + capital + ' stays in the position for the whole hold', time: hold + ' days' },
      { text: "Check " + p.name + "'s own points or rewards page from the link on its official site, and claim only there — never pay a fee or a stranger to claim for you.", cost: 'nothing to check, and never pay to claim', time: '10 minutes' },
      { text: 'Log the wallet, every date and every transaction hash in a farm log, set a reminder for day ' + hold + ', then unwind in two tranches a week apart.', cost: 'about ' + gas + ' of gas per withdrawal tranche', time: '20 minutes at the end of the hold' }
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
    if (params.get('momentum')) state.momentum = params.get('momentum');
    if (params.get('watch') === '1') state.watchOnly = true;
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.momentum !== 'all') params.set('momentum', state.momentum);
    if (state.watchOnly) params.set('watch', '1');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watchOnly && !r.on_watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.momentum !== 'all' && momentumOf(r).key !== state.momentum) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = shownImplied(a); bv = shownImplied(b); }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Launch Radar' })),
      el('div', { class: 'top-meta' },
        el('span', null, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', null, 'Model ', el('b', { text: DATA.model_version }))
      )
    );
  }

  function lede() {
    var values = DATA.rows.map(function (r) { return r.implied_value_usd; }).sort(function (a, b) { return a - b; });
    var median = values.length ? values[Math.floor(values.length / 2)] : 0;
    var top = values.length ? values[values.length - 1] : 0;
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Pre-token protocols, ranked by what a launch would be worth' }),
        el('p', null,
          'Every protocol here ', el('b', { text: 'records no token' }), ' in the snapshot. The radar prices a hypothetical launch from its TVL, its seven-day growth and how long it has run tokenless — then gives the exact steps to farm it before a launch, if one ever comes. Implied value is this model\u2019s estimate, never a prediction that a token will exist.')
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', null, String(DATA.watchlist_size), el('em', { text: ' / ' + DATA.watchlist_size }))),
        el('div', { class: 'fact' }, el('span', { text: 'Board rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Top implied value' }), el('b', { text: fmtUsd(top) })),
        el('div', { class: 'fact' }, el('span', { text: 'Median implied value' }), el('b', { text: fmtUsd(median) }))
      )
    );
  }

  function selectField(id, label, options, current, onChange) {
    var select = el('select', { id: id, 'aria-label': label },
      options.map(function (o) { return el('option', { value: o.value, text: o.label, selected: o.value === current ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { onChange(select.value); writeHash(); render(); });
    return el('div', { class: 'field' }, el('label', { for: id, text: label }), select);
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); renderBoardOnly(); });
    var watch = el('input', { type: 'checkbox', id: 'watch', checked: state.watchOnly ? 'checked' : null });
    watch.addEventListener('change', function () { state.watchOnly = watch.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token board', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live tokens, set aside', onclick: function () { state.tab = 'live'; render(); } });
    var countText = state.tab === 'pre-token'
      ? rows().length + ' of ' + DATA.board_size + ' rows shown' + (sandboxActive() ? ' — sandbox on, board.json unchanged' : '')
      : DATA.live.length + ' live-token protocols';
    return el('div', { class: 'controls', id: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      selectField('category', 'Category', [{ value: 'all', label: 'All categories' }].concat(categories.map(function (c) { return { value: c, label: c }; })), state.category, function (v) { state.category = v; }),
      selectField('chain', 'Chain', [{ value: 'all', label: 'All chains' }].concat(chains.map(function (c) { return { value: c, label: c }; })), state.chain, function (v) { state.chain = v; }),
      selectField('momentum', 'Momentum (7d)', [
        { value: 'all', label: 'All momentum' }, { value: 'surging', label: 'Surging (+10% or more)' },
        { value: 'rising', label: 'Rising (+3% to +10%)' }, { value: 'flat', label: 'Flat (-3% to +3%)' },
        { value: 'cooling', label: 'Cooling (-10% to -3%)' }, { value: 'falling', label: 'Falling (under -10%)' },
        { value: 'nodata', label: 'No 7d data' }
      ], state.momentum, function (v) { state.momentum = v; }),
      el('label', { class: 'check' }, watch, el('span', { text: 'Watchlist only' })),
      el('div', { class: 'field' }, el('span', { class: 'lab', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: countText })
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
        el('p', { text: 'Clear the search or widen the category, chain and momentum filters to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.momentum = 'all'; state.watchOnly = false; writeHash(); render(); } })
      ));
    }
    var max = Math.max.apply(null, list.map(shownImplied)) || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var shown = shownImplied(r);
      var sig = momentumOf(r);
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'an unnamed chain') })
        )),
        el('td', null, el('span', { class: r.on_watchlist ? 'tag watch' : 'tag early', text: r.on_watchlist ? 'WATCHLIST' : 'EARLY' })),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((shown / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(shown) })
        )),
        el('td', null, el('span', { class: 'tag sig-' + sig.key, text: sig.label }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel', id: 'board-panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. The watchlist floor is $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL; EARLY rows are pre-token protocols below it. Select any row for its model breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            el('th', { scope: 'col', text: 'Radar' }),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age tokenless'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Momentum' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel', id: 'board-panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Set aside, not ranked: these protocols already trade, so their market cap is a market fact, not a model estimate. The radar never mixes the two.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function slider(id, label, min, max, step, value, key) {
    var val = el('b', { text: String(value) });
    var input = el('input', { type: 'range', id: id, min: String(min), max: String(max), step: String(step), value: String(value), 'aria-label': label });
    input.addEventListener('input', function () { val.textContent = input.value; });
    input.addEventListener('change', function () { state.sandbox[key] = parseFloat(input.value); render(); });
    return el('div', { class: 'slider' }, el('label', { for: id }, el('span', { text: label }), val), input);
  }

  function modelPanel() {
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed — model ' + DATA.model_version }),
      el('div', { class: 'formula', text: 'implied = round( tvl x tier(tvl) x (1 + clamp(7d growth, ' + M.growth_floor + ', ' + M.growth_cap + ') / 100 x ' + M.growth_weight + ') x (' + M.maturity_floor + ' + min(age days, ' + M.maturity_days + ') / ' + M.maturity_days + ' x ' + M.maturity_range + ') x (1 + min(extra chains, ' + M.breadth_max_extra + ') x ' + M.breadth_step + ') )' }),
      el('p', { class: 'sub', text: 'The tier is ' + M.multiple_high + ' at $1B of TVL or more, ' + M.multiple_mid + ' from $200M, ' + M.multiple_low + ' from $50M and ' + M.multiple_early + ' below that: a launch worth half a small protocol\u2019s TVL is ordinary, half a giant\u2019s would be historic, so the multiple falls as TVL rises. Growth is the snapshot\u2019s seven-day TVL change, clamped so one wild week cannot carry a ranking. Age is the time since DefiLlama first tracked the protocol — how long it has run with no token on record; an unknown age counts as ' + M.unknown_age_days + ' days. Breadth rewards TVL spread over several chains. One function scores every row; no name is special-cased, and live-token protocols are set aside at their market caps.' }),
      el('h3', { text: 'Model sandbox — re-rank the page, not the board' }),
      el('p', { class: 'sub', text: 'Move a weight and the table above re-ranks with it, so a reader can test how much of a ranking is growth, maturity or breadth. board.json always carries the stated defaults; reset returns the page to them.' }),
      el('div', { class: 'sandbox' },
        slider('sb-growth', 'Growth weight', 0, 1, 0.05, state.sandbox.growth_weight, 'growth_weight'),
        slider('sb-maturity', 'Maturity range', 0, 0.8, 0.05, state.sandbox.maturity_range, 'maturity_range'),
        slider('sb-breadth', 'Breadth step per chain', 0, 0.06, 0.01, state.sandbox.breadth_step, 'breadth_step'),
        el('button', { class: 'button', type: 'button', text: 'Reset to model defaults', onclick: function () { state.sandbox = { growth_weight: M.growth_weight, maturity_range: M.maturity_range, breadth_step: M.breadth_step }; render(); } })
      )
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    var sig = momentumOf(row);
    var recomputed = impliedOf(row, { growth_weight: M.growth_weight, maturity_range: M.maturity_range, breadth_step: M.breadth_step });
    dialog.textContent = '';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') }),
        el('div', { class: 'badges' },
          el('span', { class: row.on_watchlist ? 'tag watch' : 'tag early', text: row.on_watchlist ? 'WATCHLIST — above the $' + Math.round(DATA.floor_usd / 1e6) + 'M floor' : 'EARLY — below the watchlist floor' }),
          el('span', { class: 'tag sig-' + sig.key, text: sig.label + ' ' + fmtPct(row.change_7d) }),
          el('span', { class: 'tag', text: 'records no token' })
        )
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value — the model, line by line' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL (snapshot)' }), el('b', { text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Tier multiple for this TVL' }), el('b', { text: 'x ' + row.base_multiple })),
        el('div', null, el('span', { text: 'Seven-day TVL growth' }), el('b', { text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { text: 'x ' + row.growth_multiplier })),
        el('div', null, el('span', { text: 'Age with no token (' + (row.listed_at || 'unlisted') + ')' }), el('b', { text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { text: 'x ' + row.maturity_multiplier })),
        el('div', null, el('span', { text: 'Chains carrying its TVL' }), el('b', { text: String(row.chains ? row.chains.length : 0) })),
        el('div', null, el('span', { text: 'Breadth multiplier' }), el('b', { text: 'x ' + row.breadth_multiplier })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ' — the same number board.json carries.' : ' — which differs from the board, so the data would be stale.') })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan — seven concrete steps' }),
      el('ol', { class: 'steps' }, farmSteps(row).map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('div', { class: 'note', text: 'Read this before farming: DefiLlama records no token for ' + row.name + ' as of ' + DATA.as_of + '. A record is not proof — a protocol can have a token its record does not carry, and it may never issue one at all. The implied value above prices a launch if the protocol\u2019s record stayed as it is; it is not a promise, a price target or advice.' })
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  var boardHost = el('div', { id: 'board-host' });
  function renderBoardOnly() {
    // Search keystrokes re-render only the table host, so the input keeps focus.
    var panel = document.getElementById('board-panel');
    if (!panel) { render(); return; }
    var fresh = state.tab === 'pre-token' ? boardTable() : liveTable();
    panel.replaceWith(fresh);
    var count = document.querySelector('.count');
    if (count) count.textContent = rows().length + ' of ' + DATA.board_size + ' rows shown' + (sandboxActive() ? ' — sandbox on, board.json unchanged' : '');
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    boardHost.textContent = '';
    boardHost.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    shell.appendChild(boardHost);
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
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
