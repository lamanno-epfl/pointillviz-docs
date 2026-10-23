/*! docs.pointillviz.com · docs.js · no dependencies, after assets/pv/pv.js
 *
 *   Search     [data-dv-search] is a combobox over every page's title,
 *              summary, headings and hidden keywords (the index is inlined
 *              in #dv-index); a section's own keywords send a match to that
 *              section. British and US spellings find each other, and a
 *              plural its singular (only where a word starts).
 *              Arrow keys move through the results, Enter opens one, Escape
 *              closes the list and then clears the field. The home keeps
 *              its query in the address (?q=), and the 404 page starts from
 *              the missing address's last word.
 *   "/"        focuses the search from anywhere (also Ctrl or Cmd + K).
 *   Contents   the section in view is the lit point of "On this page", and
 *              the phone's sub-bar names it.
 *   Skeletons  each section is swept once as it comes into view.
 *   Loops      a lead figure's loop plays only in view and in a visible tab,
 *              with a Pause button (the figure's own, over the corner the
 *              capture leaves free); under reduced motion it waits for Play.
 *   The theme toggle's name, the browser chrome's colour and focus going back
 *   to a drawer's opener without a page jump are pv.js's (shared/pv).
 */
(() => {
  'use strict';

  const doc = document;
  const body = doc.body;
  const ROOT = body.getAttribute('data-dv-root') || '';
  const $$ = (sel, ctx = doc) => Array.from(ctx.querySelectorAll(sel));
  const escapeHTML = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------ index */

  // Fold one character at a time so folded text keeps the original's indices
  // (needed to highlight matches in the original wording).
  function fold(s) {
    let out = '';
    for (const ch of s) {
      let c = ch;
      const d = ch.normalize('NFD');
      if (d.length > 1 && /^[\u0300-\u036f]+$/.test(d.slice(1))) c = d[0];
      if (/[\u2010-\u2015]/.test(c)) c = '-';
      if (c === '\u2019' || c === '\u2018') c = "'";
      const low = c.toLowerCase();
      out += low.length === c.length ? low : c;
    }
    return out;
  }

  // The docs spell like the README (colour, centre, grey, visualize); a reader
  // may not. A term also matches its other spelling.
  const SPELL = [
    ['colour', 'color'], ['neighbour', 'neighbor'], ['tumour', 'tumor'], ['behaviour', 'behavior'],
    ['centre', 'center'], ['metre', 'meter'], ['fibre', 'fiber'], ['grey', 'gray'], ['licence', 'license'],
    ['catalogue', 'catalog'], ['dialogue', 'dialog'], ['modelling', 'modeling'], ['labelled', 'labeled'],
    ['labelling', 'labeling'], ['analyse', 'analyze'], ['analysed', 'analyzed'], ['analysing', 'analyzing'],
  ];
  // A term as typed and in its other spellings (vs, matched anywhere), plus
  // the singular of a plural (st, matched only where a word starts, so
  // "violins" finds "Violin plot" but "lens" never finds "blend").
  function variants(t) {
    const out = new Set([t]);
    for (const [gb, us] of SPELL) {
      if (t.includes(gb)) out.add(t.replace(gb, us));
      if (t.includes(us)) out.add(t.replace(us, gb));
    }
    // -ise and -ize: visualise, normalise, harmonise, organise …
    let m = t.match(/^(.{3,})is(e|ed|es|ing|ation|ations)$/);
    if (m) out.add(`${m[1]}iz${m[2]}`);
    m = t.match(/^(.{3,})iz(e|ed|es|ing|ation|ations)$/);
    if (m) out.add(`${m[1]}is${m[2]}`);
    // A plural finds its singular (clusters, genes, violins), when the stem
    // keeps at least four letters and the word is no -ss, -us or -is.
    const st = new Set();
    for (const v of out) {
      if (v.length > 4 && v.endsWith('s') && !/(ss|us|is)$/.test(v)) st.add(v.slice(0, -1));
    }
    return { vs: [...out], st: [...st].filter((s) => !out.has(s)) };
  }

  let INDEX = null;
  function index() {
    if (INDEX) return INDEX;
    const el = doc.getElementById('dv-index');
    try { INDEX = JSON.parse(el ? el.textContent : '{}'); } catch (e) { INDEX = {}; }
    INDEX.pages = INDEX.pages || [];
    INDEX.pages.forEach((p, i) => {
      p.i = i;
      p.ft = fold(p.t);
      p.fd = fold(p.d);
      p.fg = fold(p.g);
      p.k = p.k || [];
      p.fk = p.k.map(fold);
      // A heading: [title, id, keywords of that section (optional)].
      p.h.forEach((h) => { h.f = fold(h[0]); h.k = h[2] || []; h.fk = h.k.map(fold); });
    });
    return INDEX;
  }

  const startsWord = (hay, t) => hay.startsWith(t) || hay.includes(' ' + t) || hay.includes('-' + t) || hay.includes('(' + t);
  // How a term meets a text: begins it, starts one of its words, or (as
  // typed, never as a singular) sits inside one.
  const begins = (hay, term) => term.vs.some((v) => hay.startsWith(v)) || term.st.some((v) => hay.startsWith(v));
  const starts = (hay, term) => term.vs.some((v) => startsWord(hay, v)) || term.st.some((v) => startsWord(hay, v));
  const inside = (hay, term) => term.vs.some((v) => hay.includes(v)) || term.st.some((v) => startsWord(hay, v));
  // A keyword met where one of its words starts (as typed, then as a
  // singular), or inside a word.
  const keyHit = (f, term) => {
    if (term.vs.some((v) => startsWord(f, v))) return 36;
    if (term.st.some((v) => startsWord(f, v))) return 34;
    return term.t.length >= 3 && term.vs.some((v) => f.includes(v)) ? 20 : 0;
  };

  // Every term must match somewhere in the page (title, a heading, the
  // summary, the group, or a keyword of the page or of one of its sections).
  // Title hits rank first, then headings, keywords, summaries. A match
  // through a section's keyword points at that section.
  function search(q) {
    const terms = fold(q).split(/\s+/).filter(Boolean).map((t) => ({ t, ...variants(t) }));
    if (!terms.length) return { terms, results: [] };
    const results = [];
    for (const p of index().pages) {
      let score = 0;
      let ok = true;
      const viaKeyword = [];
      const viaHead = new Map();
      for (const term of terms) {
        let s = 0;
        if (begins(p.ft, term)) s = 100;
        else if (starts(p.ft, term)) s = 80;
        else if (inside(p.ft, term)) s = 55;
        for (const h of p.h) {
          if (inside(h.f, term)) s = Math.max(s, starts(h.f, term) ? 46 : 32);
        }
        // Of two keywords that meet the term alike, the one that meets more
        // of the query wins ("dot plot": Marker dot plot, not Alluvial plot).
        const cover = (f) => terms.filter((t2) => inside(f, t2)).length;
        let k = 0;
        let kc = 0;
        let kw = null;
        p.fk.forEach((f, j) => {
          const hit = keyHit(f, term);
          const c = hit ? cover(f) : 0;
          if (hit > k || (hit && hit === k && c > kc)) { k = hit; kc = c; kw = p.k[j]; }
        });
        let hk = 0;
        let hc = 0;
        let hkw = null;
        let hh = null;
        p.h.forEach((h) => h.fk.forEach((f, j) => {
          const hit = keyHit(f, term);
          const c = hit ? cover(f) : 0;
          if (hit > hk || (hit && hit === hk && c > hc)) { hk = hit; hc = c; hkw = h.k[j]; hh = h; }
        }));
        if (inside(p.fd, term)) s = Math.max(s, starts(p.fd, term) ? 24 : 12);
        if (inside(p.fg, term)) s = Math.max(s, 10);
        if (Math.max(k, hk) > s) {
          if (hk > k) {
            s = hk;
            viaKeyword.push(hkw);
            viaHead.set(hh, (viaHead.get(hh) || 0) + 1);
          } else {
            s = k;
            viaKeyword.push(kw);
          }
        }
        if (!s) { ok = false; break; }
        score += s;
      }
      if (!ok) continue;
      // Point at a heading when the title alone does not explain the match.
      let heading = null;
      if (!terms.every((term) => inside(p.ft, term))) {
        let best = 0;
        for (const h of p.h) {
          const n = terms.filter((term) => inside(h.f, term)).length + (viaHead.get(h) || 0);
          if (n > best) { best = n; heading = h; }
        }
      }
      // "Covers" names each keyword once, and not one that a longer keyword
      // it lists already contains ("differential expression", not also
      // "expression").
      const uniq = [...new Set(viaKeyword)];
      const also = uniq.filter((w) => !uniq.some((o) => o !== w && fold(o).includes(fold(w))));
      results.push({ p, score, heading, also });
    }
    results.sort((a, b) => b.score - a.score || a.p.i - b.p.i);
    return { terms, results };
  }

  function highlight(text, terms) {
    const f = fold(text);
    const marks = new Array(text.length).fill(false);
    const mark = (t, wordStart) => {
      if (!t) return;
      let at = f.indexOf(t);
      while (at !== -1) {
        if (!wordStart || at === 0 || /[\s\-(]/.test(f[at - 1])) {
          for (let k = at; k < at + t.length; k++) marks[k] = true;
        }
        at = f.indexOf(t, at + 1);
      }
    };
    terms.forEach((term) => {
      term.vs.forEach((t) => mark(t, false));
      term.st.forEach((t) => mark(t, true));
    });
    let out = '';
    let open = false;
    for (let k = 0; k < text.length; k++) {
      if (marks[k] && !open) { out += '<mark>'; open = true; }
      if (!marks[k] && open) { out += '</mark>'; open = false; }
      out += escapeHTML(text[k]);
    }
    return open ? out + '</mark>' : out;
  }

  /* ----------------------------------------------------------- combobox */

  const boxes = [];

  // Bring el into view inside its own scrolling box only (a results list, the
  // sidebar, the drawer's page list). scrollIntoView would also scroll the
  // page behind a drawer, which moves the reader and the section in view, and
  // the drawer's panel, which hid its head and search.
  function reveal(el, mode = 'nearest') {
    let box = el.parentElement;
    while (box && box !== doc.body) {
      const oy = getComputedStyle(box).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && box.scrollHeight > box.clientHeight + 1) break;
      box = box.parentElement;
    }
    if (!box || box === doc.body) {
      // Nothing scrolls around it: in a dialog it is already in view.
      if (!el.closest('dialog')) el.scrollIntoView({ block: mode });
      return;
    }
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (mode === 'center') box.scrollTop += (r.top - b.top) - (box.clientHeight - r.height) / 2;
    else if (r.top < b.top) box.scrollTop -= b.top - r.top + 6;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 6;
  }

  function setupSearch(box) {
    const scope = box.getAttribute('data-dv-search');
    const input = box.querySelector('input');
    const list = box.querySelector('[role="listbox"]');
    const status = box.querySelector('[role="status"]');
    const nav = scope === 'side' ? box.parentElement.querySelector('[data-dv-nav]') : null;
    if (!input || !list) return;
    let active = -1;
    let items = [];
    let statusTimer = 0;
    let urlTimer = 0;
    let last = null;

    const open = () => {
      if (!items.length) return close();
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      if (nav) nav.hidden = true;
    };
    function close() {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
      if (nav) nav.hidden = false;
    }
    const say = (text) => {
      window.clearTimeout(statusTimer);
      if (!text) { status.textContent = ''; return; }
      // A short pause, so a screen reader hears the count once typing stops.
      statusTimer = window.setTimeout(() => { status.textContent = text; }, 220);
    };
    const setActive = (i, scroll) => {
      items.forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
      active = i;
      if (i < 0) { input.removeAttribute('aria-activedescendant'); return; }
      input.setAttribute('aria-activedescendant', items[i].id);
      if (scroll) reveal(items[i]);
    };
    // The home's query lives in the address, so a search can be linked.
    const remember = (q) => {
      if (scope !== 'home' || !window.history.replaceState) return;
      window.clearTimeout(urlTimer);
      urlTimer = window.setTimeout(() => {
        const url = new URL(window.location.href);
        if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
        try { window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash); } catch (e) { /* not kept */ }
      }, 300);
    };

    function render() {
      const q = input.value.trim();
      if (q === last) { open(); return; }
      last = q;
      remember(q);
      const { terms, results } = search(q);
      list.textContent = '';
      items = [];
      active = -1;
      if (!q) { close(); say(''); return; }
      const I = index();
      if (!results.length) {
        close();
        const tpl = scope === 'home' ? I.none : I.nonePage;
        say((tpl || '').replace('{query}', q));
        return;
      }
      results.forEach((r, k) => {
        const li = doc.createElement('li');
        li.className = 'dv-search__opt';
        li.id = `${input.id}-o${k}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        const href = ROOT + r.p.u + (r.heading ? '#' + r.heading[1] : '');
        let snip = r.heading
          ? `<span class="dv-search__snip dv-search__snip--head"><span>${highlight(r.heading[0], terms)}</span></span>`
          : `<span class="dv-search__snip">${highlight(r.p.d, terms)}</span>`;
        if (r.also.length) {
          snip += `<span class="dv-search__also">${escapeHTML(I.also || 'Covers')} ${r.also.map((w) => `<mark>${escapeHTML(w)}</mark>`).join(', ')}</span>`;
        }
        li.innerHTML = `<a class="dv-search__link" href="${escapeHTML(href)}" tabindex="-1">`
          + `<span class="dv-search__top"><span class="dv-search__title">${highlight(r.p.t, terms)}</span>`
          + `<span class="dv-search__group">${escapeHTML(r.p.g)}</span></span>${snip}</a>`;
        li.addEventListener('mousemove', () => { if (active !== k) setActive(k, false); });
        list.appendChild(li);
        items.push(li);
      });
      open();
      say(results.length === 1 ? I.one : (I.count || '').replace('{n}', String(results.length)));
    }

    // Open a result as a click would: a link inside the contents drawer then
    // closes the drawer (pv.js), also when it points into this page.
    const go = (i) => {
      const li = items[i];
      const a = li && li.querySelector('a');
      if (!a) return;
      const url = new URL(a.href, window.location.href);
      if (url.pathname === window.location.pathname && url.hash) {
        input.value = '';
        last = null;
        close();
        say('');
        remember('');
      }
      a.click();
    };

    input.addEventListener('input', render);
    input.addEventListener('focus', () => { if (input.value.trim()) render(); });
    input.addEventListener('keydown', (e) => {
      const n = items.length;
      if (e.key === 'ArrowDown') {
        if (!n) return;
        e.preventDefault();
        if (list.hidden) open();
        setActive(active < n - 1 ? active + 1 : 0, true);
      } else if (e.key === 'ArrowUp') {
        if (!n) return;
        e.preventDefault();
        if (list.hidden) open();
        setActive(active > 0 ? active - 1 : n - 1, true);
      } else if (e.key === 'Enter') {
        if (!n || list.hidden) return;
        e.preventDefault();
        go(active >= 0 ? active : 0);
      } else if (e.key === 'Escape') {
        if (!list.hidden) { e.preventDefault(); e.stopPropagation(); close(); }
        else if (input.value) { e.preventDefault(); e.stopPropagation(); input.value = ''; last = null; render(); }
      }
    });
    // Keep the list while the pointer works in it; close it when focus leaves.
    list.addEventListener('mousedown', (e) => e.preventDefault());
    box.addEventListener('focusout', (e) => {
      if (!box.contains(e.relatedTarget)) window.setTimeout(() => { if (!box.contains(doc.activeElement)) close(); }, 0);
    });
    // A click outside, or Escape, closes a list nobody focused (one opened
    // from the address).
    doc.addEventListener('pointerdown', (e) => { if (!list.hidden && !box.contains(e.target)) close(); });
    doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !list.hidden && !box.contains(doc.activeElement)) close(); });
    boxes.push({ box, input, scope, render });
  }

  // Start a search from the address: ?q= on the home, the missing word on 404.
  function prefill() {
    let q = '';
    let scope = '';
    if (body.classList.contains('dv--home')) {
      scope = 'home';
      try { q = new URLSearchParams(window.location.search).get('q') || ''; } catch (e) { q = ''; }
    } else if (body.classList.contains('dv--404')) {
      scope = '404';
      let seg = '';
      try { seg = decodeURIComponent(window.location.pathname); } catch (e) { seg = window.location.pathname; }
      seg = seg.split('/').filter(Boolean).pop() || '';
      q = seg.replace(/\.html?$/i, '').replace(/[-_+.]+/g, ' ').trim();
      if (/^(404|index)$/i.test(q)) q = '';
    }
    const b = boxes.find((x) => x.scope === scope);
    if (!b || !q || q.length > 60) return;
    // The 404 page offers its guess only when the guess finds something.
    if (scope === '404' && !search(q).results.length) return;
    b.input.value = q;
    b.render();
  }

  /* --------------------------------------------------------- "/" key */

  const visible = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

  function focusSearch() {
    const inPage = boxes.find((b) => b.scope !== 'side' && visible(b.input));
    if (inPage) { inPage.input.focus(); inPage.input.select(); return true; }
    const side = boxes.find((b) => b.scope === 'side' && !b.box.closest('dialog') && visible(b.input));
    if (side) { side.input.focus(); side.input.select(); return true; }
    // Narrow screens: open the contents drawer and focus its field.
    const opener = doc.querySelector('[data-pv-drawer-open="dv-nav-drawer"]');
    const dlg = doc.getElementById('dv-nav-drawer');
    if (opener && dlg && visible(opener)) {
      if (!dlg.open) opener.click();
      const inner = boxes.find((b) => dlg.contains(b.box));
      if (inner) window.requestAnimationFrame(() => { inner.input.focus(); inner.input.select(); });
      return true;
    }
    return false;
  }

  doc.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.isComposing) return;
    const slash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey;
    const cmdK = (e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey) && !e.altKey;
    if (!slash && !cmdK) return;
    const t = e.target;
    if (slash && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const siteMenu = doc.getElementById('pv-drawer');
    if (siteMenu && siteMenu.open) return;
    if (focusSearch()) e.preventDefault();
  });

  /* ------------------------------------------------- on this page (spy) */

  function setupSpy() {
    const heads = $$('.dv-body h2[id]');
    const links = $$('.dv-toc a[href^="#"], .dv-toc-inline a[href^="#"], .dv-nav__secs a[href^="#"]');
    if (!heads.length) return;
    const subbar = doc.querySelector('.dv-subbar');
    const sec = subbar && subbar.querySelector('.dv-subbar__sec');
    const secName = subbar && subbar.querySelector('.dv-subbar__secname');
    const names = new Map(heads.map((h) => [h.id, h.textContent.trim()]));
    let current;
    let ticking = false;
    const mark = (id) => {
      if (id === current) return;
      current = id;
      links.forEach((a) => {
        if (id && a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
      if (sec && secName) {
        sec.hidden = !id;
        secName.textContent = id ? names.get(id) : '';
        subbar.classList.toggle('has-sec', !!id);
      }
    };
    const update = () => {
      ticking = false;
      const css = getComputedStyle(doc.documentElement);
      // the room the top bar takes: its height times the large-screen scale (pv.css)
      const bar = (parseFloat(css.getPropertyValue('--pv-topbar-h')) || 64) * (parseFloat(css.getPropertyValue('--k')) || 1);
      const sub = parseFloat(css.getPropertyValue('--dv-subbar-h')) || 0;
      const line = bar + sub + Math.min(window.innerHeight * 0.3, 220);
      let id = null;
      for (const h of heads) {
        if (h.getBoundingClientRect().top <= line) id = h.id;
        else break;
      }
      const end = window.innerHeight + window.scrollY >= doc.documentElement.scrollHeight - 4;
      if (end && window.scrollY > 0) id = heads[heads.length - 1].id;
      mark(id);
    };
    const queue = () => { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    window.addEventListener('hashchange', queue);
    update();
  }

  /* ------------------------------------------------- contents drawer */

  function setupDrawer() {
    const dlg = doc.getElementById('dv-nav-drawer');
    if (!dlg) return;
    // When the sidebar comes back, the drawer has nothing left to show.
    window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
      if (e.matches && dlg.open) dlg.close();
    });
    // Opening it shows where you are in the path (and in the page).
    const opener = doc.querySelector('[data-pv-drawer-open="dv-nav-drawer"]');
    if (opener) opener.addEventListener('click', () => {
      window.requestAnimationFrame(() => {
        const here = dlg.querySelector('.dv-nav__secs [aria-current]') || dlg.querySelector('[aria-current="page"]');
        if (here) reveal(here, 'center');
      });
    });
  }

  /* ------------------------------------------- skeletons: one sweep each */

  function setupScan() {
    const secs = $$('.dv-sec');
    if (!secs.length || !('IntersectionObserver' in window) || reduceMQ.matches) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const s = entry.target;
        io.unobserve(s);
        s.classList.add('is-scanned');
        // The sweep runs once (CSS); then the section rests, with nothing running.
        window.setTimeout(() => s.classList.remove('is-scanned'), 2200);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.25 });
    secs.forEach((s) => io.observe(s));
  }

  /* ------------------------------------------------------ figure loops */

  function setupLoops() {
    const vids = $$('video.dv-loop[data-src]');
    if (!vids.length) return;
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    let pageLoaded = doc.readyState === 'complete';
    const waiting = [];
    window.addEventListener('load', () => { pageLoaded = true; waiting.splice(0).forEach((f) => f()); }, { once: true });

    vids.forEach((v) => {
      const stage = v.closest('.dv-lead__stage');
      // The button is the figure's, beside the stage: drawn over a corner of
      // the picture, or under it on phones.
      const fig = v.closest('figure');
      const btn = fig && fig.querySelector('.dv-loop__btn');
      if (!stage || !btn) return;
      const word = btn.querySelector('.dv-loop__word');
      const what = btn.getAttribute('data-what') || '';
      v.muted = true;
      let wanted = !(reduceMQ.matches || saveData);   // the reader's choice
      let inView = false;
      let loaded = false;
      let failed = false;

      const label = () => {
        const text = wanted ? btn.getAttribute('data-pause') : btn.getAttribute('data-play');
        if (word) word.textContent = text;
        btn.setAttribute('aria-label', what ? `${text} ${what}` : text);
        btn.setAttribute('data-state', wanted ? 'playing' : 'paused');
      };
      const sync = () => {
        if (failed) return;
        if (wanted && inView && !doc.hidden) {
          // The loop waits for the page's own load, so it never delays it.
          if (!pageLoaded) { waiting.push(sync); return; }
          if (!loaded) { v.src = v.getAttribute('data-src'); loaded = true; }
          const p = v.play();
          if (p && p.catch) p.catch(() => { /* blocked: the still stays */ });
        } else if (!v.paused) {
          v.pause();
        }
      };
      v.addEventListener('playing', () => stage.classList.add('is-playing'));
      v.addEventListener('error', () => { failed = true; stage.classList.remove('is-playing'); btn.hidden = true; });
      btn.addEventListener('click', () => { wanted = !wanted; label(); sync(); });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
          entries.forEach((entry) => { inView = entry.isIntersecting; sync(); });
        }, { threshold: 0.35 }).observe(stage);
      } else {
        inView = true;
      }
      doc.addEventListener('visibilitychange', sync);
      reduceMQ.addEventListener('change', (e) => { if (e.matches && wanted) { wanted = false; label(); sync(); } });
      label();
      btn.hidden = false;
      sync();
    });
  }

  /* -------------------------------------------------------------- boot */

  function boot() {
    $$('[data-dv-search]').forEach(setupSearch);
    setupSpy();
    setupDrawer();
    setupScan();
    setupLoops();
    prefill();
    // The sidebar keeps the current page in view.
    const here = doc.querySelector('.dv-side [aria-current="page"]');
    const side = doc.querySelector('.dv-side');
    if (here && side) {
      const r = here.getBoundingClientRect();
      const s = side.getBoundingClientRect();
      if (r.bottom > s.bottom - 24) side.scrollTop += r.bottom - s.bottom + s.height / 3;
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
