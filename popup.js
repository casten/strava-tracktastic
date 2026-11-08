const DEFAULTS = { enabled: true, autoDetect: true, step: 50, maxMeters: 5000, paceInMiles: true, restEnabled: true, restPaceSec: 720, recoveryEnabled: true, recoveryPaceSec: 540 };
const $ = (id) => document.getElementById(id);

const fmtPace = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
// Accepts "10", "10:00", "9:30" → seconds; null if invalid.
function parsePace(text) {
  const m = String(text).trim().match(/^(\d{1,2})(?::([0-5]\d))?$/);
  if (!m) return null;
  const sec = Number(m[1]) * 60 + Number(m[2] || 0);
  return sec > 0 ? sec : null;
}

// ---- This activity: show detection status and a per-page on/off switch.
let page = null;

function renderPage() {
  const status = $("pageStatus");
  const auto = page.autoDetect
    ? (page.isTrack ? `Track workout detected (${page.reason}).` : `Not detected as a track workout (${page.reason}).`)
    : "Auto-detect is off, so every activity is converted.";
  $("pageConvert").checked = page.override !== undefined ? page.override : (!page.autoDetect || page.isTrack);
  if (page.override !== undefined) {
    status.textContent = `Set by you for this activity. ${auto} `;
    const reset = document.createElement("span");
    reset.id = "pageReset";
    reset.textContent = "Use auto-detect";
    reset.addEventListener("click", () => setOverride(undefined));
    status.appendChild(reset);
  } else {
    status.textContent = auto;
  }
  $("page").hidden = false;
}

function setOverride(value) {
  chrome.storage.local.get({ overrides: {} }, ({ overrides }) => {
    if (value === undefined) delete overrides[page.activityId];
    else overrides[page.activityId] = value;
    chrome.storage.local.set({ overrides }, () => {
      page.override = value;
      renderPage();
    });
  });
}

$("pageConvert").addEventListener("change", (e) => setOverride(e.target.checked));

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const showNoPage = () => ($("noPage").hidden = false);
  if (!tab) return showNoPage();
  chrome.tabs.sendMessage(tab.id, { type: "stm-status" }, (resp) => {
    if (chrome.runtime.lastError || !resp || !resp.activityId) return showNoPage();
    page = resp;
    renderPage();
  });
});

chrome.storage.sync.get(DEFAULTS, (s) => {
  $("enabled").checked = s.enabled;
  $("autoDetect").checked = s.autoDetect;
  $("step").value = String(s.step);
  $("maxMeters").value = s.maxMeters;
  $("paceInMiles").checked = s.paceInMiles;
  $("restEnabled").checked = s.restEnabled;
  $("restPace").value = fmtPace(s.restPaceSec);
  $("restPace").disabled = !s.restEnabled;
  $("recoveryEnabled").checked = s.recoveryEnabled;
  $("recoveryPace").value = fmtPace(s.recoveryPaceSec);
  $("recoveryPace").disabled = !s.recoveryEnabled;
  updateRecoveryTop(s.restPaceSec);
});

// The recovery band runs up to the rest pace; show that so the range is clear.
function updateRecoveryTop(restSec) {
  $("recoveryTop").textContent = fmtPace(restSec);
}

$("recoveryEnabled").addEventListener("change", (e) => {
  $("recoveryPace").disabled = !e.target.checked;
  chrome.storage.sync.set({ recoveryEnabled: e.target.checked });
});
$("recoveryPace").addEventListener("change", (e) => {
  const sec = parsePace(e.target.value);
  chrome.storage.sync.get(DEFAULTS, (s) => {
    if (sec == null || sec >= s.restPaceSec) {
      e.target.value = fmtPace(s.recoveryPaceSec);
      return;
    }
    e.target.value = fmtPace(sec);
    chrome.storage.sync.set({ recoveryPaceSec: sec });
  });
});

$("enabled").addEventListener("change", (e) => chrome.storage.sync.set({ enabled: e.target.checked }));
$("autoDetect").addEventListener("change", (e) => chrome.storage.sync.set({ autoDetect: e.target.checked }));
$("step").addEventListener("change", (e) => chrome.storage.sync.set({ step: Number(e.target.value) }));
$("maxMeters").addEventListener("change", (e) => {
  const v = Math.max(100, Number(e.target.value) || DEFAULTS.maxMeters);
  e.target.value = v;
  chrome.storage.sync.set({ maxMeters: v });
});
$("paceInMiles").addEventListener("change", (e) => chrome.storage.sync.set({ paceInMiles: e.target.checked }));
$("restEnabled").addEventListener("change", (e) => {
  $("restPace").disabled = !e.target.checked;
  chrome.storage.sync.set({ restEnabled: e.target.checked });
});
$("restPace").addEventListener("change", (e) => {
  const sec = parsePace(e.target.value);
  chrome.storage.sync.get(DEFAULTS, (s) => {
    if (sec == null || sec <= s.recoveryPaceSec) {
      e.target.value = fmtPace(s.restPaceSec);
      return;
    }
    e.target.value = fmtPace(sec);
    updateRecoveryTop(sec);
    chrome.storage.sync.set({ restPaceSec: sec });
  });
});
