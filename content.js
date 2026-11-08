// Tracktastic for Strava — rewrites km/mi distances to meters rounded to the nearest step (default 50 m).
// Made by Casten Riepling (https://www.linkedin.com/in/casten/) w/ help from Claude.
// Source: https://github.com/casten/strava-tracktastic
(() => {
  const UNIT_TO_M = { km: 1000, mi: 1609.344 };
  const DEFAULTS = { enabled: true, autoDetect: true, step: 50, maxMeters: 5000, paceInMiles: true, restEnabled: true, restPaceSec: 720, recoveryEnabled: true, recoveryPaceSec: 540 };
  let settings = { ...DEFAULTS };

  // A number like 0.40, 1.2, 0,40 (comma decimal) — not part of a pace like 4:30.
  const NUM = "(\\d{1,3}(?:[.,]\\d{1,3})?)";
  // Inline form: "0.40 km" / "0.25mi" in a single text node. Excludes "km/h", "/km", "kms".
  const INLINE_RE = new RegExp(`(?<![\\d:.,/])${NUM}\\s?(km|mi)(?![\\w/])`, "g");
  // Number at the end of a text node, used when the unit sits in its own element: 0.40<abbr>km</abbr>
  const TRAILING_NUM_RE = new RegExp(`(?<![\\d:.,/])${NUM}(\\s*)$`);

  // Pace like "4:02 /km" in one text node, and a pace ("4:02") at the end of a text node
  // when "/km" sits in its own element.
  const INLINE_PACE_RE = /(?<![\d:])(\d{1,2}):(\d{2})(\s?)\/km(?![\w/])/g;
  const TRAILING_PACE_RE = /(?<![\d:])(\d{1,2}):(\d{2})(\s*)$/;
  const KM_PER_MI = 1.609344;

  // Converts a per-km pace to a per-mile pace string, e.g. 4:02 -> 6:30.
  function kmPaceToMile(min, sec) {
    const total = Math.round((Number(min) * 60 + Number(sec)) * KM_PER_MI);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function handleInlinePace(textNode) {
    const original = textNode.nodeValue;
    const updated = original.replace(INLINE_PACE_RE, (w, m, s, sp) => `${kmPaceToMile(m, s)}${sp}/mi`);
    if (updated !== original) textNode.nodeValue = updated;
  }

  function handlePaceUnitElement(textNode) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    walker.currentNode = textNode;
    let prev = walker.previousNode();
    while (prev && !prev.nodeValue.trim()) prev = walker.previousNode();
    if (!prev || shouldSkip(prev)) return;
    const match = prev.nodeValue.match(TRAILING_PACE_RE);
    if (!match) return;
    prev.nodeValue = prev.nodeValue.slice(0, match.index) + kmPaceToMile(match[1], match[2]) + match[3];
    textNode.nodeValue = textNode.nodeValue.replace("/km", "/mi");
    const el = textNode.parentElement;
    if (el && el.hasAttribute("title")) el.setAttribute("title", "per mile");
  }

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION"]);

  function parseNum(s) {
    s = s.trim();
    s = /^\d+,\d+$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  // Returns rounded meters, or null if the value should be left alone.
  function roundMeters(value, unit) {
    const meters = value * UNIT_TO_M[unit];
    if (!(meters > 0) || meters > settings.maxMeters) return null;
    return Math.max(settings.step, Math.round(meters / settings.step) * settings.step);
  }

  const fmt = (m) => m.toLocaleString("en-US");

  function shouldSkip(node) {
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (SKIP_TAGS.has(el.tagName) || el.isContentEditable) return true;
    }
    return false;
  }

  // Case 1: the unit is the entire text of its own element, e.g. <abbr class="unit" title="kilometers">km</abbr>
  function handleUnitElement(textNode, unit) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    walker.currentNode = textNode;
    let prev = walker.previousNode();
    while (prev && !prev.nodeValue.trim()) prev = walker.previousNode();
    if (!prev || shouldSkip(prev)) return;

    const match = prev.nodeValue.match(TRAILING_NUM_RE);
    if (!match) return;
    const rounded = roundMeters(parseNum(match[1]), unit);
    if (rounded == null) return;

    prev.nodeValue = prev.nodeValue.slice(0, match.index) + fmt(rounded) + match[2];
    textNode.nodeValue = textNode.nodeValue.replace(unit, "m");
    const el = textNode.parentElement;
    if (el && el.hasAttribute("title")) el.setAttribute("title", "meters");
    markDistance(prev.parentElement, rounded);
  }

  // Remember which table cell holds a converted distance, so the Rest pass can find it.
  const CELL_SEL = "td, th, [role=cell], [role=gridcell]";
  function markDistance(el, meters) {
    if (!el) return;
    const cell = el.closest(CELL_SEL) || el;
    cell.dataset.stmDistance = String(meters);
  }

  // Case 2: number and unit in the same text node.
  function handleInline(textNode) {
    const original = textNode.nodeValue;
    INLINE_RE.lastIndex = 0;
    if (!INLINE_RE.test(original)) return;
    INLINE_RE.lastIndex = 0;
    let last = null;
    const updated = original.replace(INLINE_RE, (whole, num, unit) => {
      const rounded = roundMeters(parseNum(num), unit);
      if (rounded == null) return whole;
      last = rounded;
      return `${fmt(rounded)} m`;
    });
    if (updated !== original) {
      textNode.nodeValue = updated;
      markDistance(textNode.parentElement, last);
    }
  }

  // ---- Rest laps: a lap slower than the chosen min/mile pace shows "Rest" instead of its distance.
  const ROW_SEL = "tr, [role=row]";
  const ROW_PACE_RE = /(?<![\d:])(\d{1,2}):(\d{2})\s*\/\s*(mi|km)\b/;
  const BARE_PACE_RE = /(?<![\d:])(\d{1,2}):(\d{2})(?![\d:])/;

  // Seconds per mile for a row, or null if no pace is found.
  function rowPaceSecPerMile(row) {
    // Check cell by cell: the whole row's text runs cells together ("1:205:20/mi").
    for (const cell of row.children) {
      const m = cell.textContent.match(ROW_PACE_RE);
      if (m) {
        const sec = Number(m[1]) * 60 + Number(m[2]);
        return m[3] === "km" ? sec * KM_PER_MI : sec;
      }
    }
    // Pace cells without a unit: use the column whose header says "Pace" (not "GAP").
    const table = row.closest("table");
    if (!table) return null;
    const headers = [...table.querySelectorAll("thead th")];
    const idx = headers.findIndex((th) => /pace/i.test(th.textContent) && !/gap|grade/i.test(th.textContent));
    if (idx < 0 || !row.children[idx]) return null;
    const cellText = row.children[idx].textContent;
    const b = cellText.match(BARE_PACE_RE);
    if (!b) return null;
    const sec = Number(b[1]) * 60 + Number(b[2]);
    return /\/\s*km|km/i.test(headers[idx].textContent) ? sec * KM_PER_MI : sec;
  }

  // Which label a lap gets from its pace: "Rest" (slowest), "Active recovery" (middle band), or none.
  function labelForPace(pace) {
    if (settings.restEnabled && pace > settings.restPaceSec) {
      return { text: "Rest", tip: "rest", opacity: "0.6" };
    }
    const recoveryTop = settings.restEnabled ? settings.restPaceSec : Infinity;
    if (settings.recoveryEnabled && pace > settings.recoveryPaceSec && pace <= recoveryTop) {
      return { text: "Active recovery", tip: "active recovery", opacity: "0.8" };
    }
    return null;
  }

  function applyRest(row) {
    if (row.closest("thead")) return;
    const cells = row.querySelectorAll("[data-stm-distance]:not([data-stm-rest])");
    if (!cells.length) return;
    const pace = rowPaceSecPerMile(row);
    if (pace == null) return;
    const label = labelForPace(pace);
    if (!label) return;
    cells.forEach((cell) => {
      cell.dataset.stmRest = "1";
      cell.title = `${fmt(Number(cell.dataset.stmDistance))} m (${label.tip})`;
      cell.textContent = label.text;
      cell.style.fontStyle = "italic";
    });
    row.style.opacity = label.opacity;
  }

  function processRests(root) {
    if (!settings.restEnabled && !settings.recoveryEnabled) return;
    const el = root.nodeType === Node.TEXT_NODE ? root.parentElement : root;
    if (!el || !el.querySelectorAll) return;
    const rows = new Set(el.querySelectorAll(ROW_SEL));
    const own = el.closest && el.closest(ROW_SEL);
    if (own) rows.add(own);
    rows.forEach(applyRest);
  }

  function processTextNode(node) {
    if (!node.nodeValue || shouldSkip(node)) return;
    const trimmed = node.nodeValue.trim();
    // Pace stays in min/mile: /mi pace is never touched, and /km pace is converted.
    if (settings.paceInMiles && trimmed === "/km") return handlePaceUnitElement(node);
    if (settings.paceInMiles && /\d:\d{2}\s?\/km/.test(trimmed)) handleInlinePace(node);
    if (trimmed === "km" || trimmed === "mi") {
      handleUnitElement(node, trimmed);
    } else if (/\d/.test(trimmed) && /(km|mi)/.test(trimmed)) {
      handleInline(node);
    }
  }

  function processRoot(root) {
    if (!settings.enabled || !root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      processTextNode(root);
    } else if (root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(processTextNode);
    } else return;
    processRests(root);
  }

  // ---- Track workout detection.
  // Strava doesn't reliably label track sessions, so look at the laps: several fast laps close to
  // standard track distances plus at least one slower recovery lap. A title like "8x400" also counts.
  const TRACK_DISTANCES = [100, 150, 200, 300, 400, 500, 600, 800, 1000, 1200, 1500, 1600, 1609.344, 2000, 3000, 3200, 3218.688];
  const nearTrack = (m) => TRACK_DISTANCES.some((d) => Math.abs(m - d) <= Math.max(15, d * 0.04));
  const CELL_DIST_RE = /^(\d{1,3}(?:[.,]\d{1,3})?)\s*(km|mi)$/;
  const TITLE_RE = /\btrack\b|\b\d+\s*[x×]\s*\d+|\bintervals?\b|\brepeats?\b|\breps\b/i;

  // Reads laps from every table on the page, grouped by table: [{ dist (m), pace (s/mi) }].
  function readLapTables() {
    const tables = new Map();
    document.querySelectorAll(ROW_SEL).forEach((row) => {
      if (row.closest("thead")) return;
      let dist = null;
      for (const cell of row.children) {
        const m = cell.textContent.trim().match(CELL_DIST_RE);
        if (m) { dist = parseNum(m[1]) * UNIT_TO_M[m[2]]; break; }
      }
      if (dist == null) return;
      const pace = rowPaceSecPerMile(row);
      if (pace == null) return;
      const key = row.closest("table, [role=table], [role=grid]") || row.parentElement;
      if (!tables.has(key)) tables.set(key, []);
      tables.get(key).push({ dist, pace });
    });
    return [...tables.values()];
  }

  // Splits tables (every row 1 mi or 1 km) aren't laps; skip them.
  function isSplitsTable(laps) {
    const whole = laps.filter((l) => Math.abs(l.dist - 1000) < 15 || Math.abs(l.dist - 1609.344) < 20);
    return laps.length >= 2 && whole.length >= (laps.length - 1) * 0.8;
  }

  function detectTrack() {
    const title = document.title.replace(/\|.*$/, "").trim();
    for (const laps of readLapTables()) {
      if (isSplitsTable(laps)) continue;
      const fast = laps.filter((l) => l.pace <= settings.recoveryPaceSec);
      const reps = fast.filter((l) => nearTrack(l.dist));
      const slow = laps.length - fast.length;
      if (reps.length >= 3 && slow >= 1 && reps.length >= fast.length * 0.7) {
        return { isTrack: true, reason: `${reps.length} fast laps at track distances` };
      }
    }
    if (TITLE_RE.test(title)) return { isTrack: true, reason: `title "${title}"` };
    return { isTrack: false, reason: "no track-style laps found" };
  }

  // ---- Deciding whether this page gets converted.
  const activityId = (location.pathname.match(/\/activities\/(\d+)/) || [])[1];
  let override; // true / false set from the popup for this activity, or undefined for automatic
  let detection = { isTrack: false, reason: "looking for laps" };
  let active = false;

  function shouldConvert() {
    if (!settings.enabled) return false;
    if (override !== undefined) return override;
    if (!settings.autoDetect) return true;
    return detection.isTrack;
  }

  function evaluate() {
    if (active) return;
    if (settings.enabled && settings.autoDetect && override === undefined) detection = detectTrack();
    if (shouldConvert()) {
      active = true;
      processRoot(document.body);
    }
  }

  // Strava renders parts of the page (laps table, charts) after load, so watch for changes:
  // keep checking for a track workout until one is found, then convert new content as it appears.
  let pending = new Set();
  let scheduled = false;
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "characterData") pending.add(m.target);
      m.addedNodes.forEach((n) => pending.add(n));
    }
    if (!scheduled && pending.size) {
      scheduled = true;
      requestAnimationFrame(() => {
        const batch = pending;
        pending = new Set();
        scheduled = false;
        if (active) batch.forEach((n) => n.isConnected && processRoot(n));
        else evaluate();
      });
    }
  });

  // The popup asks for this page's status.
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (msg && msg.type === "stm-status") {
      reply({ activityId, isTrack: detection.isTrack, reason: detection.reason, override, active, autoDetect: settings.autoDetect, enabled: settings.enabled });
    }
  });

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = { ...DEFAULTS, ...stored };
    chrome.storage.local.get({ overrides: {} }, ({ overrides }) => {
      override = activityId ? overrides[activityId] : undefined;
      evaluate();
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
  });

  // Changing settings reloads the page so the original values come back cleanly.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") return location.reload();
    if (area === "local" && changes.overrides && activityId) {
      const before = (changes.overrides.oldValue || {})[activityId];
      const after = (changes.overrides.newValue || {})[activityId];
      if (before !== after) location.reload();
    }
  });
})();
