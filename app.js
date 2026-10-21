/* Nenne - app.js
   Vanilla JavaScript. Sections:
   1. Reference data (wake windows, feeding, caffeine)
   2. Small helpers (time, text, icons, DOM)
   3. Saved state with input sanitising
   4. Kinetic odometer and visual timers (pie dial and draining bar)
   5. Rendering (header, sleep, feeding, caffeine, reference cards)
   6. Actions and events (drawer, accordions, dialogs, buttons)
   7. Start up */

(() => {
  'use strict';

  /* =====================================================================
     1. REFERENCE DATA
     ===================================================================== */

  const STORAGE_KEY = 'nenne.v1';
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  const MAX_BIRTH_YEARS_BACK = 3;
  const FEEDING_PREFERENCES = ['breast', 'formula', 'mixed'];

  // gapMinutes is the typical digestion gap. It is guidance only: feeds are never blocked.
  const FEED_TYPES = {
    breast: { label: 'Nursing', gapMinutes: 150 },
    formula: { label: 'Formula', gapMinutes: 180 }
  };

  const CAFFEINE_CLEAR_MINUTES = 150;   // 2.5 hours
  const DAILY_GUIDE_MG = 200;
  const DAILY_MAX_MG = 300;
  const STEP_MINUTES = 5;               // the -5m / +5m chips
  const MAX_BACKDATE = 12 * HOUR;

  // Age-based wake windows ("active time") and nap schedules
  const WAKE_WINDOWS = [
    { label: 'Newborn (under 1 month)', fromMonth: 0, toMonth: 0, minMinutes: 35, maxMinutes: 60,
      windowText: '35 to 60 minutes', naps: '4 to 5+ irregular naps (20 min to 3 hours)' },
    { label: '1 to 2 months', fromMonth: 1, toMonth: 2, minMinutes: 45, maxMinutes: 90,
      windowText: '45 to 90 minutes', naps: '4 to 5 naps' },
    { label: '3 to 4 months', fromMonth: 3, toMonth: 4, minMinutes: 75, maxMinutes: 120,
      windowText: '75 to 120 minutes (1.25 to 2 hours)', naps: '3 to 4 naps (predictable schedule forms)' },
    { label: '5 to 7 months', fromMonth: 5, toMonth: 7, minMinutes: 120, maxMinutes: 180,
      windowText: '120 to 180 minutes (2 to 3 hours)', naps: '2 to 3 naps (dropping the late catnap)' },
    { label: '8 to 10 months', fromMonth: 8, toMonth: 10, minMinutes: 150, maxMinutes: 210,
      windowText: '150 to 210 minutes (2.5 to 3.5 hours)', naps: '2 stable naps' },
    { label: '11 to 14 months', fromMonth: 11, toMonth: 14, minMinutes: 180, maxMinutes: 240,
      windowText: '180 to 240 minutes (3 to 4 hours)', naps: '2 solid naps' },
    { label: '15 to 24 months', fromMonth: 15, toMonth: 24, minMinutes: 240, maxMinutes: 360,
      windowText: '240 to 360 minutes (4 to 6 hours)', naps: '1 afternoon nap (1.5 to 3 hours)' }
  ];

  // Age-based feeding schedules (minHours / maxHours are null when not a fixed interval)
  const FEEDING_SCHEDULES = [
    { label: '0 to 1 months', fromMonth: 0, toMonth: 1, minHours: 2, maxHours: 3,
      interval: '2 to 3 hours on demand', perDay: '8-12+ times a day', note: 'Frequent feeds' },
    { label: '2 to 3 months', fromMonth: 2, toMonth: 3, minHours: 3, maxHours: 4,
      interval: '3 to 4 hours', perDay: '6-8 times a day', note: 'Self-regulation begins' },
    { label: '4 to 5 months', fromMonth: 4, toMonth: 5, minHours: 4, maxHours: 4,
      interval: '4 hours', perDay: '5-6 times a day', note: 'Stable rhythm forms' },
    { label: '6 to 8 months', fromMonth: 6, toMonth: 8, minHours: 4, maxHours: 4,
      interval: '4 hours', perDay: '5 times a day (2 after solids)', note: '70-80% milk' },
    { label: '9 to 11 months', fromMonth: 9, toMonth: 11, minHours: 4, maxHours: 5,
      interval: '4 to 5 hours', perDay: '4-5 times a day (3 after solids)', note: 'Milk feeds fall as solids grow' },
    { label: '12 to 18 months', fromMonth: 12, toMonth: 18, minHours: null, maxHours: null,
      interval: '', perDay: '1 to 2 times a day', note: 'Comfort and bonding' },
    { label: '19 to 24 months (or above)', fromMonth: 19, toMonth: 999, minHours: null, maxHours: null,
      interval: '', perDay: 'As needed (for comfort). Nutrients from 3 meals and 1-2 snacks.',
      note: 'Emotional support and gradual weaning' }
  ];

  // Caffeine catalogue. "mg" is the amount counted when you log a drink.
  const BEVERAGES = [
    { key: 'coffee', label: 'Coffee', icon: 'local-cafe', loggable: true, mg: 60, product: 'Nescafe Gold Blend',
      serving: '1 cup (2 g)', range: '50 - 90 mg', limit: 'Daily limit: 2 to 3 cups.' },
    { key: 'black', label: 'Black Tea', icon: 'emoji-food-beverage', loggable: true, mg: 40, product: 'Twinings Earl Grey',
      serving: '1 tea bag', range: '31 - 45 mg (up to 70 mg if steeped 5+ min)', limit: 'Daily limit: 3 to 4 cups.' },
    { key: 'green', label: 'Green Tea', icon: 'eco', loggable: true, mg: 25, product: 'Twinings Green Tea with Lemon',
      serving: '1 tea bag', range: '19 - 45 mg', limit: 'Balance with water to stay hydrated.' },
    { key: 'cola', label: 'Cola', icon: 'local-drink', loggable: true, mg: 33, product: 'Coca-Cola Classic',
      serving: '330 ml can', range: '33 mg', limit: 'Limit: 1 can a day because of the sugar.' },
    { key: 'energy', label: 'Energy Drink', icon: 'bolt', loggable: true, mg: 110, product: 'Red Bull (also Monster)',
      serving: '250 ml (Red Bull)', range: '80 mg (Red Bull 250 ml). Other brands average about 110 mg.',
      limit: 'Strongly discouraged while breastfeeding.' },
    { key: 'decaf', label: 'Decaf', icon: 'coffee', loggable: true, mg: 5, product: 'Decaf coffee (standard instant or brewed)',
      serving: '1 cup', range: '2 - 7 mg', limit: 'Safe any time. Decaf is 97% to 99.9% caffeine-free, but not zero.' },
    { key: 'water', label: 'Water', icon: 'water-drop', loggable: false, mg: 0, product: '',
      serving: '', range: '0 mg', limit: 'The best choice for hydration while nursing.' }
  ];
  const LOGGABLE_BEVERAGES = BEVERAGES.filter((b) => b.loggable);

  const SAFETY_GUIDELINES = [
    'Caffeine reaches breastmilk within 15 to 30 minutes and peaks at 1 to 2 hours.',
    'Wait at least 2.5 to 3 hours before the next nursing session.',
    'Keep daily caffeine to 200 mg, and no more than 300 mg.',
    'Energy drinks are strongly discouraged while breastfeeding.',
    'Amounts are estimates. Cup size and brewing time change the caffeine.',
    'Not sure? Ask your doctor or nurse.'
  ];

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  const THEME_COLORS = {
    'day-calm': '#dcebfa', 'day-prepare': '#fce3bf', 'day-soothe': '#dad3f0',
    'night-calm': '#0f1b2e', 'night-prepare': '#33283a', 'night-soothe': '#2a2447'
  };

  /* =====================================================================
     2. HELPERS
     ===================================================================== */

  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const pad = (n) => String(n).padStart(2, '0');
  const formatClock = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  // "1h 05m" or "24m" (rounded up to whole minutes so the display is calm)
  function formatDuration(ms) {
    const total = Math.max(0, Math.ceil(ms / MINUTE));
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return hours > 0 ? `${hours}h ${pad(minutes)}m` : `${minutes}m`;
  }

  // "1 hour 5 minutes" for screen readers and sentences
  function describeDuration(ms) {
    const total = Math.max(0, Math.ceil(ms / MINUTE));
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    const parts = [];
    if (hours) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    if (minutes || !hours) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
    return parts.join(' ');
  }

  function describeAgo(ms) {
    if (ms < MINUTE) return 'just now';
    const total = Math.floor(ms / MINUTE);
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return hours > 0 ? `${hours}h ${pad(minutes)}m ago` : `${minutes}m ago`;
  }

  function describeWhen(ts, now) {
    const then = new Date(ts);
    const today = new Date(now);
    const yesterday = new Date(now - DAY);
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(then, today)) return formatClock(ts);
    if (sameDay(then, yesterday)) return `Yesterday ${formatClock(ts)}`;
    return `${pad(then.getDate())}/${pad(then.getMonth() + 1)} ${formatClock(ts)}`;
  }

  function bandFor(list, months) {
    return list.find((b) => months >= b.fromMonth && months <= b.toMonth)
      || (months < list[0].fromMonth ? list[0] : list[list.length - 1]);
  }

  const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

  // Only write to the DOM when text actually changed (keeps screen readers quiet)
  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
  function setAttr(node, name, value) { if (node.getAttribute(name) !== value) node.setAttribute(name, value); }

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'className') node.className = value;
      else node.setAttribute(key, value);
    }
    children.forEach((child) => node.append(child));
    return node;
  }

  // Google Material icon from the sprite in index.html
  function icon(name, extraClass = '') {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', extraClass ? `icon ${extraClass}` : 'icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.append(use);
    return svg;
  }

  function setIcon(svg, name) {
    const use = svg.firstElementChild;
    if (use && use.getAttribute('href') !== `#i-${name}`) use.setAttribute('href', `#i-${name}`);
  }

  /* =====================================================================
     3. SAVED STATE AND SANITISING
     ===================================================================== */

  function toInt(value, min, max) {
    const n = typeof value === 'number' ? value : Number.parseInt(value, 10);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  }

  function isFutureMonth(year, month, now) {
    const d = new Date(now);
    return year > d.getFullYear() || (year === d.getFullYear() && month > d.getMonth() + 1);
  }

  function cleanTimestamp(value, now, maxAge) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    if (value > now + MINUTE) return null;
    if (value < now - maxAge) return null;
    return Math.round(value);
  }

  function cleanProfile(raw, now) {
    if (!raw || typeof raw !== 'object') return null;
    const thisYear = new Date(now).getFullYear();
    const birthYear = toInt(raw.birthYear, thisYear - MAX_BIRTH_YEARS_BACK, thisYear);
    const birthMonth = toInt(raw.birthMonth, 1, 12);
    if (birthYear === null || birthMonth === null) return null;
    if (isFutureMonth(birthYear, birthMonth, now)) return null;
    const feedingPref = FEEDING_PREFERENCES.includes(raw.feedingPref) ? raw.feedingPref : 'mixed';
    return { birthYear, birthMonth, feedingPref };
  }

  function cleanFeed(raw, now) {
    if (!raw || typeof raw !== 'object') return null;
    if (!Object.prototype.hasOwnProperty.call(FEED_TYPES, raw.type)) return null;
    const ts = cleanTimestamp(raw.ts, now, 30 * DAY);
    return ts === null ? null : { type: raw.type, ts };
  }

  function cleanState(raw, now) {
    const safe = { profile: null, lastWake: null, lastFeed: null, feedHistory: [], caffeineLog: [] };
    if (!raw || typeof raw !== 'object') return safe;

    safe.profile = cleanProfile(raw.profile, now);
    safe.lastWake = cleanTimestamp(raw.lastWake, now, 30 * DAY);
    safe.lastFeed = cleanFeed(raw.lastFeed, now);

    if (Array.isArray(raw.feedHistory)) {
      raw.feedHistory.slice(-10).forEach((item) => {
        const feed = cleanFeed(item, now);
        if (feed) safe.feedHistory.push(feed);
      });
    }

    if (Array.isArray(raw.caffeineLog)) {
      raw.caffeineLog.slice(-50).forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const drink = LOGGABLE_BEVERAGES.find((b) => b.key === entry.key);
        const ts = cleanTimestamp(entry.ts, now, 2 * DAY);
        if (drink && ts !== null) safe.caffeineLog.push({ key: drink.key, ts });
      });
    }
    return safe;
  }

  function loadState() {
    try {
      const text = window.localStorage.getItem(STORAGE_KEY);
      return cleanState(text ? JSON.parse(text) : null, Date.now());
    } catch (error) {
      return cleanState(null, Date.now());
    }
  }

  let state = loadState();
  let storageWorks = true;

  // The time chosen with -5m / Edit time / +5m before a feed is recorded. null means "now".
  const pendingFeed = { breast: null, formula: null };

  function saveState() {
    try {
      state = cleanState(state, Date.now());
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageWorks = true;
    } catch (error) {
      if (storageWorks) {
        storageWorks = false;
        showToast('This device could not save your data. It will be lost when you close the app.');
      }
    }
  }

  function ageInMonths(now) {
    if (!state.profile) return 0; // safe fallback: treat as newborn so nothing shows NaN
    const d = new Date(now);
    const months = (d.getFullYear() - state.profile.birthYear) * 12 + (d.getMonth() + 1 - state.profile.birthMonth);
    return Number.isFinite(months) ? Math.max(0, months) : 0;
  }

  function ageLabel(months) {
    if (!state.profile) return 'Age not set';
    if (months < 1) return 'Newborn';
    if (months < 24) return months === 1 ? '1 Month Old' : `${months} Months Old`;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const yearText = `${years} ${years === 1 ? 'Year' : 'Years'}`;
    const monthText = rest ? ` ${rest} ${rest === 1 ? 'Month' : 'Months'}` : '';
    return `${yearText}${monthText} Old`;
  }

  // Keep feeds in time order. The newest one is "last feed"; the rest are history for Undo.
  function setFeeds(list) {
    const sorted = list.slice().sort((a, b) => a.ts - b.ts).slice(-10);
    state.lastFeed = sorted.length ? sorted[sorted.length - 1] : null;
    state.feedHistory = sorted.slice(0, -1);
  }
  function allFeeds() {
    return state.feedHistory.concat(state.lastFeed ? [state.lastFeed] : []);
  }

  /* =====================================================================
     4. KINETIC ODOMETER AND VISUAL TIMERS
     ===================================================================== */

  function createOdometer(container) {
    let shape = '';
    let cells = [];

    function build(text) {
      container.textContent = '';
      cells = [];
      [...text].forEach((char) => {
        if (/\d/.test(char)) {
          const strip = el('span', { className: 'odo-strip' });
          for (let i = 0; i <= 9; i += 1) strip.append(el('span', {}, [String(i)]));
          const wrap = el('span', { className: 'odo-digit' }, [strip]);
          container.append(wrap);
          cells.push({ wrap, strip, value: null });
        } else {
          container.append(el('span', { className: 'odo-sep' }, [char === ' ' ? ' ' : char]));
        }
      });
    }

    return {
      update(text) {
        const nextShape = [...text].map((c) => (/\d/.test(c) ? 'd' : c)).join('');
        if (nextShape !== shape) { shape = nextShape; build(text); }
        const digits = [...text].filter((c) => /\d/.test(c)).map(Number);
        digits.forEach((digit, index) => {
          const cell = cells[index];
          if (!cell || cell.value === digit) return;
          const jump = cell.value === null || Math.abs(digit - cell.value) > 1;
          if (jump) {
            // Big jump (for example 0 to 9): fade instead of spinning through every digit
            cell.strip.style.transition = 'none';
            cell.strip.style.transform = `translateY(${-digit}em)`;
            void cell.strip.offsetHeight;
            cell.strip.style.transition = '';
            if (cell.value !== null) {
              cell.wrap.classList.remove('odo-fade');
              void cell.wrap.offsetWidth;
              cell.wrap.classList.add('odo-fade');
            }
          } else {
            cell.strip.style.transform = `translateY(${-digit}em)`;
          }
          cell.value = digit;
        });
      }
    };
  }

  // Pie dial: the coloured wedge shrinks clockwise as time passes. Bar: shrinks to the left.
  // fraction is "time left" from 1 (full) to 0 (empty). tone "wait" uses the amber colour.
  function setTimer(dial, drain, fraction, tone) {
    const f = clamp01(fraction);
    dial.style.setProperty('--sweep', `${(f * 360).toFixed(1)}deg`);
    const width = `${(f * 100).toFixed(1)}%`;
    if (drain.style.width !== width) drain.style.width = width;
    const wanted = tone || '';
    if ((dial.dataset.state || '') !== wanted) {
      if (wanted) dial.dataset.state = wanted; else delete dial.dataset.state;
    }
    const track = drain.parentElement;
    if ((track.dataset.state || '') !== wanted) {
      if (wanted) track.dataset.state = wanted; else delete track.dataset.state;
    }
  }

  /* =====================================================================
     5. RENDERING
     ===================================================================== */

  let sleepOdometer = null;
  let feedOdometer = null;
  let caffeineOdometer = null;
  let lastReferenceMonths = null;
  let referenceMode = 'current'; // 'current' or 'all'
  let toastTimer = 0;

  function themeFor(now) {
    const hour = new Date(now).getHours();
    return hour >= 6 && hour < 19 ? 'day' : 'night';
  }

  function applyTheme(now, phase) {
    const theme = themeFor(now);
    if (root.dataset.theme !== theme) root.dataset.theme = theme;
    if (root.dataset.phase !== phase) root.dataset.phase = phase;
    const meta = document.querySelector('meta[name="theme-color"]');
    const color = THEME_COLORS[`${theme}-${phase}`];
    if (meta && color && meta.getAttribute('content') !== color) meta.setAttribute('content', color);
  }

  function renderHeader(now) {
    setText($('clock'), formatClock(now));
    setAttr($('clock'), 'datetime', new Date(now).toISOString());
    setText($('ageBadge'), ageLabel(ageInMonths(now)));
  }

  function renderSleep(now) {
    const months = ageInMonths(now);
    const band = bandFor(WAKE_WINDOWS, months);
    const wake = state.lastWake === null ? now : state.lastWake;
    const start = wake + band.minMinutes * MINUTE;
    const end = wake + band.maxMinutes * MINUTE;

    setText($('napWindow'), `${formatClock(start)} - ${formatClock(end)}`);
    setText($('napMeta'), `Woke at ${formatClock(wake)}. Active time (wake window) at this age: ${band.windowText}.`);

    const toStart = start - now;
    let label;
    let remaining;
    let fraction;
    if (toStart > 0) {
      label = 'Next nap in';
      remaining = toStart;
      fraction = toStart / (start - wake);
    } else if (now < end) {
      label = 'Best nap time ends in';
      remaining = end - now;
      fraction = (end - now) / (end - start);
    } else {
      label = 'Past the best nap time by';
      remaining = now - end;
      fraction = 0;
    }

    let phase = 'soothe';
    if (toStart > 30 * MINUTE) phase = 'calm';
    else if (toStart > 15 * MINUTE) phase = 'prepare';

    setText($('countdownLabel'), label);
    sleepOdometer.update(formatDuration(remaining));
    const spoken = `${label} ${describeDuration(remaining)}`;
    setText($('countdownSr'), spoken);
    setAttr($('sleepDial'), 'aria-label', spoken);
    setTimer($('sleepDial'), $('sleepDrain'), fraction, '');

    applyTheme(now, phase);
  }

  /* ----- Caffeine status is shared by the feeding and caffeine cards ----- */
  function caffeineStatus(now) {
    const recent = state.caffeineLog.filter((entry) => now - entry.ts < DAY);
    const totalMg = recent.reduce((sum, entry) => {
      const drink = LOGGABLE_BEVERAGES.find((b) => b.key === entry.key);
      return sum + (drink ? drink.mg : 0);
    }, 0);
    const last = recent.length ? recent[recent.length - 1] : null;
    if (!last) return { last: null, drink: null, waiting: false, clearAt: 0, left: 0, totalMg };
    const drink = LOGGABLE_BEVERAGES.find((b) => b.key === last.key) || null;
    const clearAt = last.ts + CAFFEINE_CLEAR_MINUTES * MINUTE;
    return { last, drink, waiting: now < clearAt, clearAt, left: Math.max(0, clearAt - now), totalMg };
  }

  function setBanner(tone, tag, text, iconName) {
    const banner = $('feedBanner');
    if (banner.dataset.tone !== tone) banner.dataset.tone = tone;
    setText($('feedBannerTag'), tag);
    setText($('feedBannerText'), text);
    setIcon($('feedBannerIcon'), iconName);
  }

  function renderPending() {
    [['breast', 'nursing'], ['formula', 'formula']].forEach(([type, id]) => {
      const ts = pendingFeed[type];
      setText($(`${id}At`), ts === null ? 'Now' : formatClock(ts));
      $(`${id}Later`).disabled = ts === null;
    });
  }

  function renderFeeding(now) {
    const pref = state.profile ? state.profile.feedingPref : 'mixed';
    const nursingBtn = $('nursingButton');
    const formulaBtn = $('formulaButton');
    // The default feeding type is the filled button; the other is outlined.
    nursingBtn.classList.toggle('btn-primary', pref !== 'formula');
    nursingBtn.classList.toggle('btn-secondary', pref === 'formula');
    formulaBtn.classList.toggle('btn-primary', pref !== 'breast');
    formulaBtn.classList.toggle('btn-secondary', pref === 'breast');

    renderPending();

    const sched = bandFor(FEEDING_SCHEDULES, ageInMonths(now));
    const last = state.lastFeed;
    const rhythm = sched.interval ? `${sched.interval}, ${sched.perDay}` : sched.perDay;
    let guide = `Usual rhythm at this age: ${rhythm}.`;

    $('editFeedButton').hidden = !last;
    $('feedTimer').hidden = !last;

    if (!last) {
      setText($('lastFeed'), 'No feeds recorded yet.');
      setBanner('idle', 'Not started', 'Record a feed to start the next-feed timer.', 'schedule');
    } else {
      const type = FEED_TYPES[last.type];
      const elapsed = now - last.ts;
      const gap = type.gapMinutes * MINUTE;
      const waiting = elapsed < gap;
      const left = Math.max(0, gap - elapsed);
      setText($('lastFeed'), `${type.label} at ${describeWhen(last.ts, now)} (${describeAgo(elapsed)})`);

      if (waiting) {
        setBanner('wait', 'Digesting', 'Still hungry? You can nurse or give formula again at any time.', 'hourglass-top');
        feedOdometer.update(formatDuration(left));
        const spoken = `Next nursing or formula feed in ${describeDuration(left)}`;
        setText($('feedCountdownSr'), spoken);
        setAttr($('feedDial'), 'aria-label', spoken);
      } else {
        setBanner('ready', 'Ready', 'The digestion gap is met. Baby can feed when ready.', 'check-circle');
        setText($('feedCountdownSr'), 'Ready for the next feed');
        setAttr($('feedDial'), 'aria-label', 'Ready for the next feed');
      }
      $('feedCountdown').hidden = !waiting;
      $('feedReady').hidden = waiting;
      setText($('feedTimerLabel'), 'Next nursing or formula feed in');
      setTimer($('feedDial'), $('feedDrain'), waiting ? left / gap : 0, waiting ? 'wait' : '');

      if (sched.minHours !== null) {
        const a = formatClock(last.ts + sched.minHours * HOUR);
        const b = formatClock(last.ts + sched.maxHours * HOUR);
        guide += a === b ? ` Next one around ${a}.` : ` Next one around ${a} - ${b}.`;
      }
    }
    setText($('feedGuide'), guide);

    // Caffeine caution: nursing is still allowed, but the parent is reminded
    const caf = caffeineStatus(now);
    const caution = $('feedCaution');
    caution.hidden = !caf.waiting;
    if (caf.waiting) {
      setText($('feedCautionText'), `Caffeine is still clearing. Safe to nurse from ${formatClock(caf.clearAt)} (${formatDuration(caf.left)} left).`);
    }
  }

  function renderCaffeine(now) {
    const caf = caffeineStatus(now);
    let message = 'No caffeine logged in the last 24 hours. Safe to nurse.';
    let spoken = 'Safe to nurse now';

    if (caf.last) {
      const name = caf.drink ? caf.drink.label : 'Drink';
      if (caf.waiting) {
        message = `${name} at ${formatClock(caf.last.ts)}. Safe to nurse from ${formatClock(caf.clearAt)}.`;
        spoken = `Safe to nurse in ${describeDuration(caf.left)}`;
      } else {
        message = `${name} at ${formatClock(caf.last.ts)}. Safe to nurse since ${formatClock(caf.clearAt)}.`;
      }
    }

    if (caf.waiting) caffeineOdometer.update(formatDuration(caf.left));
    $('caffeineCountdown').hidden = !caf.waiting;
    $('caffeineSafe').hidden = caf.waiting;
    setText($('caffeineCountdownSr'), spoken);
    setAttr($('caffeineDial'), 'aria-label', spoken);
    setTimer($('caffeineDial'), $('caffeineDrain'),
      caf.waiting ? caf.left / (CAFFEINE_CLEAR_MINUTES * MINUTE) : 0, caf.waiting ? 'wait' : '');
    setText($('meterText'), message);

    let daily = `Last 24 hours: ${caf.totalMg} mg (guide ${DAILY_GUIDE_MG} mg, maximum ${DAILY_MAX_MG} mg).`;
    if (caf.totalMg > DAILY_MAX_MG) daily += ' Above the daily maximum.';
    else if (caf.totalMg > DAILY_GUIDE_MG) daily += ' Above the 200 mg guide.';
    setText($('dailyTotal'), daily);
  }

  function renderBeverageHint() {
    const checked = document.querySelector('input[name="beverage"]:checked');
    const drink = BEVERAGES.find((b) => checked && b.key === checked.value);
    if (!drink) return;
    setText($('beverageHint'), `Counted as about ${drink.mg} mg. ${drink.limit}`);
  }

  function renderBeverageChoices() {
    const wrap = $('beverageChoices');
    wrap.textContent = '';
    LOGGABLE_BEVERAGES.forEach((drink, index) => {
      const input = el('input', { type: 'radio', name: 'beverage', value: drink.key });
      if (index === 0) input.checked = true;
      const face = el('span', { className: 'choice-face' }, [icon(drink.icon), el('span', {}, [drink.label])]);
      wrap.append(el('label', { className: 'choice' }, [input, face]));
    });
    renderBeverageHint();
  }

  function makeModeToggle(containerId) {
    const wrap = el('div', { className: 'segmented', role: 'group', 'aria-label': 'Choose what to show' });
    [['current', 'Current age'], ['all', 'All ages']].forEach(([mode, label]) => {
      const button = el('button', { type: 'button', 'data-mode': mode, 'aria-pressed': String(referenceMode === mode) }, [label]);
      button.addEventListener('click', () => {
        referenceMode = mode;
        renderReference(ageInMonths(Date.now()));
        const again = document.querySelector(`#${containerId} [data-mode="${mode}"]`);
        if (again) again.focus();
      });
      wrap.append(button);
    });
    return wrap;
  }

  function makeAgeCard(title, lines, isCurrent) {
    const head = el('h4', {}, [title]);
    if (isCurrent) head.append(' ', el('span', { className: 'now-badge' }, ['Current age']));
    const paragraphs = lines.map(([text, muted]) => el('p', muted ? { className: 'muted' } : {}, [text]));
    return el('div', { className: isCurrent ? 'ref-item is-current' : 'ref-item' }, [head].concat(paragraphs));
  }

  function renderReference(months) {
    const wakeBand = bandFor(WAKE_WINDOWS, months);
    const feedBand = bandFor(FEEDING_SCHEDULES, months);
    const showAll = referenceMode === 'all';

    const wake = $('wakeReference');
    wake.textContent = '';
    wake.append(makeModeToggle('wakeReference'));
    WAKE_WINDOWS.filter((b) => showAll || b === wakeBand).forEach((b) => {
      wake.append(makeAgeCard(b.label, [[`Active time (wake window): ${b.windowText}`], [`Naps: ${b.naps}`]], b === wakeBand));
    });
    wake.append(el('p', { className: 'muted' }, ['Typical ranges. Watch for tired cues and trust what you see.']));

    const feeding = $('feedingReference');
    feeding.textContent = '';
    feeding.append(makeModeToggle('feedingReference'));
    FEEDING_SCHEDULES.filter((b) => showAll || b === feedBand).forEach((b) => {
      feeding.append(makeAgeCard(b.label, [
        [`Gap: ${b.interval || 'No fixed gap'}`],
        [`Feeds a day: ${b.perDay}`],
        [b.note, true]
      ], b === feedBand));
    });
    feeding.append(
      el('div', { className: 'ref-item' }, [
        el('h4', {}, ['Formula milk']),
        el('p', {}, ['Takes longer to digest. Leave about 3 hours before the next feed.'])
      ]),
      el('div', { className: 'ref-item' }, [
        el('h4', {}, ['Breastmilk (nursing)']),
        el('p', {}, ['Digests faster, about 2 to 3 hours. Can be fed earlier when baby shows hunger cues.'])
      ]),
      el('div', { className: 'ref-item' }, [
        el('h4', {}, ['Still hungry?']),
        el('p', {}, ['Nursing and formula can follow each other. Baby may want more milk, or more of the other kind. Mind your caffeine first.'])
      ]),
      el('div', { className: 'ref-item' }, [
        el('h4', {}, ['Daily rhythm']),
        el('p', {}, ['Wake, Feed, Play, Sleep.'])
      ])
    );
  }

  function renderCaffeineReference() {
    const wrap = $('caffeineReference');
    wrap.textContent = '';
    BEVERAGES.forEach((drink) => {
      const head = el('h4', { className: 'title-icon' }, [icon(drink.icon, 'icon--small'), el('span', {}, [drink.label])]);
      const lines = [head];
      if (drink.product) lines.push(el('p', {}, [`${drink.product}${drink.serving ? ` (${drink.serving})` : ''}`]));
      lines.push(el('p', {}, [`Caffeine: ${drink.range}`]));
      if (drink.loggable) lines.push(el('p', { className: 'muted' }, [`Counted as about ${drink.mg} mg when logged.`]));
      lines.push(el('p', { className: 'muted' }, [drink.limit]));
      wrap.append(el('div', { className: 'ref-item' }, lines));
    });
    wrap.append(el('h4', {}, ['Safety guidelines']), el('ul', { className: 'bullet-list' }, SAFETY_GUIDELINES.map((t) => el('li', {}, [t]))));
  }

  function renderInfoPopover() {
    const pop = $('infoPopover');
    pop.textContent = '';
    const rows = LOGGABLE_BEVERAGES.map((drink) => {
      const name = drink.product ? `${drink.label} (${drink.product}${drink.serving ? `, ${drink.serving}` : ''})` : drink.label;
      return el('li', {}, [el('span', {}, [name]), el('span', {}, [drink.range])]);
    });
    pop.append(
      el('h3', {}, ['Caffeine by drink']),
      el('ul', { className: 'ref-list' }, rows),
      el('h3', {}, ['Safety guidelines']),
      el('ul', { className: 'bullet-list' }, SAFETY_GUIDELINES.map((t) => el('li', {}, [t])))
    );
  }

  function render() {
    const now = Date.now();
    renderHeader(now);
    renderSleep(now);
    renderFeeding(now);
    renderCaffeine(now);
    const months = ageInMonths(now);
    if (months !== lastReferenceMonths) { lastReferenceMonths = months; renderReference(months); }
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 4200);
  }

  /* =====================================================================
     6. ACTIONS AND EVENTS
     ===================================================================== */

  /* ----- Dialog helpers ----- */
  function openDialog(dialog) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
  function closeDialog(dialog) {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function askConfirm({ title, message, confirmLabel }) {
    return new Promise((resolve) => {
      const dialog = $('confirmDialog');
      setText($('confirmTitle'), title);
      setText($('confirmMessage'), message);
      setText($('confirmYes'), confirmLabel);
      dialog.returnValue = '';
      const onClose = () => {
        dialog.removeEventListener('close', onClose);
        resolve(dialog.returnValue === 'confirm');
      };
      dialog.addEventListener('close', onClose);
      openDialog(dialog);
    });
  }

  /* ----- Drawer ----- */
  const drawer = $('drawer');
  const scrim = $('scrim');
  const menuButton = $('menuButton');
  const pageParts = () => [$('appHeader'), $('main')];

  function openDrawer() {
    drawer.inert = false;
    drawer.classList.add('is-open');
    scrim.classList.add('is-open');
    document.body.classList.add('no-scroll');
    pageParts().forEach((part) => { part.inert = true; });
    menuButton.setAttribute('aria-expanded', 'true');
    $('drawerClose').focus();
  }

  function closeDrawer(returnFocus = true) {
    drawer.classList.remove('is-open');
    scrim.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    pageParts().forEach((part) => { part.inert = false; });
    drawer.inert = true;
    menuButton.setAttribute('aria-expanded', 'false');
    if (returnFocus) menuButton.focus();
  }

  /* ----- Accordions: one open at a time; the open heading stays pinned while its content scrolls ----- */
  function setupAccordions() {
    const triggers = Array.from(document.querySelectorAll('.accordion-trigger'));
    const setOpen = (trigger, open) => {
      trigger.setAttribute('aria-expanded', String(open));
      $(trigger.getAttribute('aria-controls')).classList.toggle('is-open', open);
    };
    triggers.forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const willOpen = trigger.getAttribute('aria-expanded') !== 'true';
        triggers.forEach((other) => setOpen(other, other === trigger && willOpen));
        if (willOpen) {
          const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          window.setTimeout(() => {
            const box = trigger.closest('.accordion');
            if (box && box.scrollIntoView) box.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
          }, 320);
        }
      });
    });
  }

  /* ----- Info popover ----- */
  function setInfoOpen(open) {
    $('infoPopover').classList.toggle('is-open', open);
    $('infoButton').setAttribute('aria-expanded', String(open));
  }

  /* ----- Profile dialog ----- */
  function populateYears() {
    const select = $('birthYear');
    const thisYear = new Date().getFullYear();
    select.textContent = '';
    select.append(el('option', { value: '' }, ['Select year']));
    for (let year = thisYear; year >= thisYear - MAX_BIRTH_YEARS_BACK; year -= 1) {
      select.append(el('option', { value: String(year) }, [String(year)]));
    }
  }

  function populateMonths() {
    const select = $('birthMonth');
    const kept = select.value;
    const now = new Date();
    const yearChosen = toInt($('birthYear').value, 1900, 3000);
    select.textContent = '';
    select.append(el('option', { value: '' }, ['Select month']));
    MONTH_NAMES.forEach((name, index) => {
      const option = el('option', { value: String(index + 1) }, [name]);
      if (yearChosen === now.getFullYear() && index > now.getMonth()) option.disabled = true; // no future months
      select.append(option);
    });
    const keptOption = Array.from(select.options).find((o) => o.value === kept && !o.disabled);
    select.value = keptOption ? kept : '';
  }

  function openProfile(firstLaunch) {
    populateYears();
    $('birthYear').value = state.profile ? String(state.profile.birthYear) : '';
    populateMonths();
    $('birthMonth').value = state.profile ? String(state.profile.birthMonth) : '';
    const pref = state.profile ? state.profile.feedingPref : 'mixed';
    document.querySelectorAll('input[name="feedingPref"]').forEach((input) => { input.checked = input.value === pref; });
    setText($('profileError'), '');
    setText($('profileTitle'), firstLaunch ? 'Welcome to Nenne' : 'Baby profile and settings');
    setText($('profileSave'), firstLaunch ? 'Save and start' : 'Save');
    $('profileCancel').hidden = firstLaunch;
    openDialog($('profileDialog'));
  }

  function handleProfileSubmit(event) {
    event.preventDefault();
    const now = Date.now();
    const checked = document.querySelector('input[name="feedingPref"]:checked');
    const profile = cleanProfile({
      birthYear: $('birthYear').value,
      birthMonth: $('birthMonth').value,
      feedingPref: checked ? checked.value : 'mixed'
    }, now);

    if (!profile) {
      const year = toInt($('birthYear').value, 1900, 3000);
      const month = toInt($('birthMonth').value, 1, 12);
      let message = 'Please choose your baby’s birth year and month.';
      if (year !== null && month !== null && isFutureMonth(year, month, now)) message = 'The birth month cannot be in the future.';
      setText($('profileError'), message);
      (year === null ? $('birthYear') : $('birthMonth')).focus();
      return;
    }

    state.profile = profile;
    if (state.lastWake === null) state.lastWake = now;
    saveState();
    lastReferenceMonths = null;
    closeDialog($('profileDialog'));
    render();
    showToast('Profile saved.');
  }

  /* ----- Baby woke up ----- */
  function resetWake() {
    state.lastWake = Date.now();
    saveState();
    render();
    showToast(`Wake time set to ${formatClock(state.lastWake)}.`);
  }

  function nudgeWake(minutes) {
    const now = Date.now();
    const base = state.lastWake === null ? now : state.lastWake;
    state.lastWake = Math.min(now, Math.max(now - MAX_BACKDATE, base + minutes * MINUTE));
    saveState();
    render();
  }

  /* ----- Feeding: choose a time with -5m / Edit time / +5m, then record ----- */
  function nudgePending(type, minutes) {
    const now = Date.now();
    const base = pendingFeed[type] === null ? now : pendingFeed[type];
    const next = base + minutes * MINUTE;
    if (next >= now - 30 * 1000) pendingFeed[type] = null;               // back to "Now"
    else pendingFeed[type] = Math.max(now - MAX_BACKDATE, next);
    renderPending();
  }

  function recordFeed(type) {
    const now = Date.now();
    const ts = pendingFeed[type] === null ? now : Math.min(now, pendingFeed[type]);
    const caf = caffeineStatus(now);

    // Nursing and formula can follow each other at any time, so nothing is blocked here.
    setFeeds(allFeeds().concat([{ type, ts }]));
    pendingFeed[type] = null;
    saveState();
    render();

    let message = `${FEED_TYPES[type].label} recorded at ${formatClock(ts)}.`;
    if (type === 'breast' && caf.waiting) message += ` Caution: caffeine clears at ${formatClock(caf.clearAt)}.`;
    showToast(message);
  }

  /* ----- Edit time dialog: last feed, wake time, or the time of the next feed ----- */
  let editTarget = null; // { kind: 'feed' | 'wake' | 'pending', type }

  function populateTimeSelects() {
    const hour = $('editHour');
    const minute = $('editMinute');
    if (hour.options.length) return;
    for (let h = 0; h < 24; h += 1) hour.append(el('option', { value: String(h) }, [pad(h)]));
    for (let m = 0; m < 60; m += 1) minute.append(el('option', { value: String(m) }, [pad(m)]));
  }

  function openEdit(kind, type) {
    const now = Date.now();
    let ts;
    let title;
    if (kind === 'feed') {
      if (!state.lastFeed) return;
      ts = state.lastFeed.ts;
      title = 'Edit last feed';
    } else if (kind === 'wake') {
      ts = state.lastWake === null ? now : state.lastWake;
      title = 'Edit wake time';
    } else {
      ts = pendingFeed[type] === null ? now : pendingFeed[type];
      title = type === 'breast' ? 'Time of nursing' : 'Time of formula feed';
    }
    editTarget = { kind, type };
    populateTimeSelects();
    const d = new Date(ts);
    $('editHour').value = String(d.getHours());
    $('editMinute').value = String(d.getMinutes());
    setText($('editTitle'), title);
    $('editTypeGroup').hidden = kind !== 'feed';
    $('editDelete').hidden = kind !== 'feed';
    if (kind === 'feed') {
      document.querySelectorAll('input[name="editType"]').forEach((input) => { input.checked = input.value === state.lastFeed.type; });
    }
    setText($('editError'), '');
    openDialog($('editDialog'));
  }

  function handleEditSubmit(event) {
    event.preventDefault();
    if (!editTarget) return;
    const now = Date.now();
    const hour = toInt($('editHour').value, 0, 23);
    const minute = toInt($('editMinute').value, 0, 59);
    if (hour === null || minute === null) { setText($('editError'), 'Please choose a time.'); return; }

    const d = new Date(now);
    d.setHours(hour, minute, 0, 0);
    let ts = d.getTime();
    if (ts > now) ts -= DAY; // a time later than now means yesterday, so it is never in the future
    if (now - ts > MAX_BACKDATE && editTarget.kind !== 'feed') {
      setText($('editError'), 'Please choose a time within the last 12 hours.');
      return;
    }

    if (editTarget.kind === 'wake') {
      state.lastWake = ts;
    } else if (editTarget.kind === 'pending') {
      pendingFeed[editTarget.type] = now - ts < MINUTE ? null : ts;
    } else {
      const checked = document.querySelector('input[name="editType"]:checked');
      const type = checked && Object.prototype.hasOwnProperty.call(FEED_TYPES, checked.value) ? checked.value : null;
      if (!type || !state.lastFeed) { setText($('editError'), 'Please choose a feed type.'); return; }
      setFeeds(state.feedHistory.concat([{ type, ts }]));
    }
    saveState();
    closeDialog($('editDialog'));
    render();
    showToast('Saved.');
  }

  async function undoLastFeed() {
    closeDialog($('editDialog'));
    const sure = await askConfirm({
      title: 'Remove this feed?',
      message: 'This removes the most recent feed. The feed before it becomes the last feed.',
      confirmLabel: 'Remove feed'
    });
    if (!sure) return;
    setFeeds(state.feedHistory);
    saveState();
    render();
    showToast('Last feed removed.');
  }

  /* ----- Caffeine ----- */
  function logBeverage() {
    const checked = document.querySelector('input[name="beverage"]:checked');
    const drink = LOGGABLE_BEVERAGES.find((b) => checked && b.key === checked.value);
    if (!drink) { showToast('Please choose a drink first.'); return; }
    const now = Date.now();
    state.caffeineLog.push({ key: drink.key, ts: now });
    saveState();
    render();
    showToast(`${drink.label} logged at ${formatClock(now)}.`);
  }

  async function clearAllData() {
    const sure = await askConfirm({
      title: 'Clear all data?',
      message: 'This removes your baby profile, feeds, wake time and caffeine log from this device. It cannot be undone.',
      confirmLabel: 'Clear all data'
    });
    if (!sure) return;
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (error) { /* ignore */ }
    state = cleanState(null, Date.now());
    state.lastWake = Date.now();
    pendingFeed.breast = null;
    pendingFeed.formula = null;
    lastReferenceMonths = null;
    closeDrawer(false);
    render();
    openProfile(true);
  }

  function wireEvents() {
    menuButton.addEventListener('click', openDrawer);
    $('drawerClose').addEventListener('click', () => closeDrawer());
    scrim.addEventListener('click', () => closeDrawer());
    $('settingsButton').addEventListener('click', () => { closeDrawer(false); openProfile(false); });
    $('clearDataButton').addEventListener('click', clearAllData);

    $('wakeButton').addEventListener('click', resetWake);
    $('wakeEarlier').addEventListener('click', () => nudgeWake(-STEP_MINUTES));
    $('wakeLater').addEventListener('click', () => nudgeWake(STEP_MINUTES));
    $('editWakeButton').addEventListener('click', () => openEdit('wake'));

    $('nursingButton').addEventListener('click', () => recordFeed('breast'));
    $('nursingEarlier').addEventListener('click', () => nudgePending('breast', -STEP_MINUTES));
    $('nursingLater').addEventListener('click', () => nudgePending('breast', STEP_MINUTES));
    $('nursingEdit').addEventListener('click', () => openEdit('pending', 'breast'));
    $('formulaButton').addEventListener('click', () => recordFeed('formula'));
    $('formulaEarlier').addEventListener('click', () => nudgePending('formula', -STEP_MINUTES));
    $('formulaLater').addEventListener('click', () => nudgePending('formula', STEP_MINUTES));
    $('formulaEdit').addEventListener('click', () => openEdit('pending', 'formula'));
    $('editFeedButton').addEventListener('click', () => openEdit('feed'));

    $('editForm').addEventListener('submit', handleEditSubmit);
    $('editCancel').addEventListener('click', () => closeDialog($('editDialog')));
    $('editDelete').addEventListener('click', undoLastFeed);

    $('logBeverageButton').addEventListener('click', logBeverage);
    $('beverageChoices').addEventListener('change', renderBeverageHint);

    $('infoButton').addEventListener('click', (event) => {
      event.stopPropagation();
      setInfoOpen($('infoButton').getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('click', (event) => {
      if (!$('infoPopover').contains(event.target)) setInfoOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (drawer.classList.contains('is-open')) closeDrawer();
      else if ($('infoPopover').classList.contains('is-open')) { setInfoOpen(false); $('infoButton').focus(); }
    });

    $('birthYear').addEventListener('change', populateMonths);
    $('profileForm').addEventListener('submit', handleProfileSubmit);
    $('profileCancel').addEventListener('click', () => closeDialog($('profileDialog')));
    $('profileDialog').addEventListener('cancel', (event) => { if (!state.profile) event.preventDefault(); });

    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  }

  /* =====================================================================
     7. START UP
     ===================================================================== */

  function init() {
    sleepOdometer = createOdometer($('countdown'));
    feedOdometer = createOdometer($('feedCountdown'));
    caffeineOdometer = createOdometer($('caffeineCountdown'));
    renderBeverageChoices();
    renderInfoPopover();
    renderCaffeineReference();
    setupAccordions();
    wireEvents();

    const now = Date.now();
    // Safe fallback: never leave the wake timer empty or very old
    if (state.lastWake === null || now - state.lastWake > MAX_BACKDATE) { state.lastWake = now; saveState(); }

    render();
    window.setInterval(render, 1000);

    if (!state.profile) openProfile(true);

    const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && secure) {
      window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
    }
  }

  init();
})();
