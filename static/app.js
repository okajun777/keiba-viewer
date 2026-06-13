const AUTO_REFRESH_MS = 60_000;

const state = {
  dates: [],
  selectedDate: null,
  venues: [],
  selectedVenueIndex: 0,
  selectedRaceNo: null,
  activeView: "shutuba",
  activeOddsBet: "win_place",
  currentShutuba: null,
  currentOdds: null,
};

const dateScroll = document.getElementById("dateScroll");
const venueRow = document.getElementById("venueRow");
const raceRow = document.getElementById("raceRow");
const oddsRow = document.getElementById("oddsRow");
const horseBody = document.getElementById("horseBody");
const oddsHead = document.getElementById("oddsHead");
const oddsBody = document.getElementById("oddsBody");
const shutubaTable = document.getElementById("shutubaTable");
const oddsTable = document.getElementById("oddsTable");
const raceNo = document.getElementById("raceNo");
const raceName = document.getElementById("raceName");
const raceData01 = document.getElementById("raceData01");
const raceData02 = document.getElementById("raceData02");
const oddsMeta = document.getElementById("oddsMeta");
const refreshMeta = document.getElementById("refreshMeta");
const sourceLink = document.getElementById("sourceLink");
const purchaseLink = document.getElementById("purchaseLink");
const statusEl = document.getElementById("status");

document.getElementById("prevDate").addEventListener("click", () => shiftDate(-1));
document.getElementById("nextDate").addEventListener("click", () => shiftDate(1));

document.querySelectorAll(".view-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    if (state.activeView === view) return;
    state.activeView = view;
    updateViewButtons();
    loadCurrentView().catch(handleError);
  });
});

document.querySelectorAll(".odds-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const bet = button.dataset.bet;
    if (state.activeOddsBet === bet) return;
    state.activeOddsBet = bet;
    updateOddsButtons();
    loadOdds().catch(handleError);
  });
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshCurrentData().catch(console.error);
  }
});

boot();

function boot() {
  const initial = readInitialData();
  if (initial) {
    applyPayload(initial);
    return;
  }

  init().catch((error) => {
    renderEmpty("データを読み込めませんでした");
    showStatus(error.message, true);
    console.error(error);
  });
}

function readInitialData() {
  const node = document.getElementById("initial-data");
  if (!node) return null;

  try {
    return JSON.parse(node.textContent);
  } catch (error) {
    console.error("initial-data parse failed", error);
    return null;
  }
}

function applyPayload(payload) {
  state.dates = payload.dates || [];
  state.selectedDate = payload.selectedDate || findClosestDate(state.dates);
  state.venues = payload.venues || [];
  state.selectedVenueIndex = payload.selectedVenueIndex || 0;
  state.selectedRaceNo = payload.selectedRaceNo ?? state.venues[0]?.races?.[0]?.race_no ?? null;
  state.activeView = payload.activeView || "shutuba";
  state.activeOddsBet = payload.activeOddsBet || "win_place";
  state.currentShutuba = payload.shutuba || null;
  state.currentOdds = payload.odds || null;

  renderDates();
  renderVenues();
  renderRaces();
  updateViewButtons();
  updateOddsButtons();

  if (state.currentShutuba) {
    renderRaceHeader(state.currentShutuba);
  }

  if (state.activeView === "odds") {
    if (state.currentOdds) {
      renderOdds(state.currentOdds);
    } else if (state.selectedRaceNo) {
      loadOdds().catch(handleError);
    } else {
      renderOddsUnavailable("レースを選択してください");
    }
  } else if (state.currentShutuba) {
    renderShutuba(state.currentShutuba);
  } else if (state.selectedRaceNo) {
    loadShutuba().catch(handleError);
  } else {
    renderEmpty(state.venues.length ? "レースを選択してください" : "この日は開催がありません");
  }

  startAutoRefresh();
}

async function init() {
  showStatus("読み込み中...");
  try {
    const datesData = await fetchJson("/api/dates");
    state.dates = datesData.dates;
    state.selectedDate = findClosestDate(state.dates);
    renderDates();
    await loadRaces();
    startAutoRefresh();
  } finally {
    hideStatus();
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  } finally {
    window.clearTimeout(timer);
  }
}

function findClosestDate(dates) {
  const now = new Date();
  const today = formatLocalDate(now);
  const exact = dates.find((item) => item.date === today);
  if (exact) return exact.date;

  const future = dates.find((item) => item.date >= today);
  return future ? future.date : dates[dates.length - 1]?.date || today;
}

function formatLocalDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderDates() {
  dateScroll.innerHTML = "";
  state.dates.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip" + (item.date === state.selectedDate ? " active" : "");
    button.textContent = item.label;
    button.addEventListener("click", () => {
      if (state.selectedDate === item.date) return;
      state.selectedDate = item.date;
      renderDates();
      loadRaces().catch(handleError);
    });
    dateScroll.appendChild(button);
  });

  const active = dateScroll.querySelector(".chip.active");
  if (active) {
    active.scrollIntoView({ inline: "center", block: "nearest" });
  }
}

async function shiftDate(direction) {
  const index = state.dates.findIndex((item) => item.date === state.selectedDate);
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= state.dates.length) return;
  state.selectedDate = state.dates[nextIndex].date;
  renderDates();
  await loadRaces();
}

async function loadRaces() {
  showStatus("レース一覧を取得中...");
  try {
    const data = await fetchJson(`/api/races?date=${state.selectedDate}`);
    state.venues = data.venues || [];
    state.selectedVenueIndex = 0;
    state.selectedRaceNo = state.venues[0]?.races?.[0]?.race_no ?? null;
    state.currentShutuba = null;
    state.currentOdds = null;

    renderVenues();
    renderRaces();
    await loadCurrentView();
  } finally {
    hideStatus();
  }
}

function renderVenues() {
  venueRow.innerHTML = "";
  state.venues.forEach((venue, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "venue-btn" + (index === state.selectedVenueIndex ? " active" : "");
    button.textContent = venue.venue_name;
    button.addEventListener("click", () => {
      if (state.selectedVenueIndex === index) return;
      state.selectedVenueIndex = index;
      state.selectedRaceNo = venue.races[0]?.race_no ?? null;
      state.currentShutuba = null;
      state.currentOdds = null;
      renderVenues();
      renderRaces();
      loadCurrentView().catch(handleError);
    });
    venueRow.appendChild(button);
  });
}

function renderRaces() {
  raceRow.innerHTML = "";
  const venue = state.venues[state.selectedVenueIndex];
  if (!venue) return;

  venue.races.forEach((race) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "race-btn" + (race.race_no === state.selectedRaceNo ? " active" : "");
    button.textContent = `${race.race_no}R`;
    button.title = race.summary;
    button.addEventListener("click", () => {
      if (state.selectedRaceNo === race.race_no) return;
      state.selectedRaceNo = race.race_no;
      state.currentShutuba = null;
      state.currentOdds = null;
      renderRaces();
      loadCurrentView().catch(handleError);
    });
    raceRow.appendChild(button);
  });
}

function currentRaceId() {
  const venue = state.venues[state.selectedVenueIndex];
  if (!venue) return null;
  const race = venue.races.find((item) => item.race_no === state.selectedRaceNo);
  return race ? race.race_id : null;
}

async function loadCurrentView() {
  if (!state.selectedRaceNo) {
    renderEmpty("この日は開催がありません");
    return;
  }

  if (state.activeView === "odds") {
    await loadShutuba({ renderTable: false });
    await loadOdds();
    return;
  }

  await loadShutuba();
}

async function loadShutuba(options = { renderTable: true, silent: false }) {
  const raceId = currentRaceId();
  if (!raceId) {
    renderEmpty("レースが見つかりません");
    return;
  }

  if (!options.silent) {
    showStatus("出馬表を取得中...");
  }
  try {
    const data = await fetchJson(buildApiUrl("/api/shutuba", { race_id: raceId }, options.silent));
    state.currentShutuba = data;
    renderRaceHeader(data);
    if (options.renderTable !== false && state.activeView === "shutuba") {
      renderShutuba(data);
    }
  } finally {
    if (!options.silent) {
      hideStatus();
    }
  }
}

async function loadOdds(options = { silent: false }) {
  const raceId = currentRaceId();
  if (!raceId) {
    renderOddsUnavailable("レースが見つかりません");
    return;
  }

  if (!options.silent) {
    showStatus("オッズを取得中...");
  }
  try {
    const data = await fetchJson(
      buildApiUrl("/api/odds", { race_id: raceId, bet: state.activeOddsBet }, options.silent)
    );
    state.currentOdds = data;
    renderOdds(data);
  } finally {
    if (!options.silent) {
      hideStatus();
    }
  }
}

function renderRaceHeader(data) {
  raceNo.textContent = `${data.race_no}R`;
  raceName.textContent = data.race_name || "レース名不明";
  raceData01.textContent = data.race_data01 || "";
  raceData02.textContent = data.race_data02 || "";
  sourceLink.href = data.source_url || "#";
}

function renderShutuba(data) {
  showShutubaTable();
  renderRaceHeader(data);

  if (!data.horses?.length) {
    renderEmpty("出走馬データがありません");
    return;
  }

  horseBody.innerHTML = data.horses
    .map(
      (horse) => `
      <tr>
        <td>
          <span class="waku-badge" style="background:${horse.waku_color};color:${horse.waku_text_color}">
            ${escapeHtml(horse.waku)}
          </span>
        </td>
        <td>${escapeHtml(horse.umaban)}</td>
        <td class="horse-name">${escapeHtml(horse.horse_name)}</td>
        <td>${escapeHtml(horse.sex_age)}</td>
        <td>${escapeHtml(horse.kinryo)}</td>
        <td>${escapeHtml(horse.jockey)}</td>
        <td>${escapeHtml(horse.trainer)}</td>
        <td>${escapeHtml(horse.weight || "-")}</td>
        <td class="${isHotOdds(horse.odds) ? "odds-hot" : ""}">${escapeHtml(formatShutubaOdds(horse.odds))}</td>
        <td>${renderNinki(formatShutubaNinki(horse.ninki))}</td>
      </tr>
    `
    )
    .join("");
}

function renderOdds(data) {
  showOddsTable();
  purchaseLink.href = data.purchase_url || "#";
  purchaseLink.classList.remove("hidden");

  if (data.status !== "ok") {
    renderOddsUnavailable(data.message || "オッズを取得できませんでした");
    oddsMeta.textContent = data.reason ? `状態: ${data.reason}` : "";
    oddsMeta.classList.toggle("hidden", !data.reason);
    return;
  }

  oddsMeta.textContent = data.official_datetime
    ? `最終更新: ${data.official_datetime}`
    : `${data.label} / 上位${data.rows.length}件表示`;
  oddsMeta.classList.remove("hidden");

  if (data.bet_type === "win_place") {
    oddsHead.innerHTML = `
      <tr>
        <th>枠</th>
        <th>番</th>
        <th>馬名</th>
        <th>単勝</th>
        <th>複勝</th>
        <th>人気</th>
      </tr>
    `;
    oddsBody.innerHTML = data.rows
      .map(
        (row) => `
        <tr>
          <td>
            <span class="waku-badge" style="background:${row.waku_color};color:${row.waku_text_color}">
              ${escapeHtml(row.waku)}
            </span>
          </td>
          <td>${escapeHtml(row.umaban)}</td>
          <td class="horse-name">${escapeHtml(row.horse_name)}</td>
          <td class="${isHotOdds(row.tansho_odds) ? "odds-hot" : ""}">${escapeHtml(row.tansho_odds || "-")}</td>
          <td>${escapeHtml(row.fukusho_odds || "-")}</td>
          <td>${renderNinki(row.tansho_ninki || row.fukusho_ninki)}</td>
        </tr>
      `
      )
      .join("");
    return;
  }

  oddsHead.innerHTML = `
    <tr>
      <th>人気</th>
      <th>組み合わせ</th>
      <th>オッズ</th>
    </tr>
  `;
  oddsBody.innerHTML = data.rows
    .map(
      (row) => `
      <tr>
        <td>${renderNinki(row.popularity)}</td>
        <td class="horse-name">${escapeHtml(row.combo)}</td>
        <td class="${isHotOdds(row.odds) ? "odds-hot" : ""}">${escapeHtml(row.odds || "-")}</td>
      </tr>
    `
    )
    .join("");
}

function renderOddsUnavailable(message) {
  showOddsTable();
  oddsHead.innerHTML = `
    <tr>
      <th>オッズ</th>
    </tr>
  `;
  oddsBody.innerHTML = `<tr><td class="empty">${escapeHtml(message)}</td></tr>`;
}

function renderEmpty(message) {
  showShutubaTable();
  raceNo.textContent = "-R";
  raceName.textContent = message;
  raceData01.textContent = "";
  raceData02.textContent = "";
  refreshMeta.classList.add("hidden");
  oddsMeta.classList.add("hidden");
  sourceLink.href = "#";
  purchaseLink.classList.add("hidden");
  horseBody.innerHTML = `<tr><td colspan="10" class="empty">${escapeHtml(message)}</td></tr>`;
}

function showShutubaTable() {
  shutubaTable.classList.remove("hidden");
  oddsTable.classList.add("hidden");
  purchaseLink.classList.add("hidden");
  oddsMeta.classList.add("hidden");
}

function showOddsTable() {
  shutubaTable.classList.add("hidden");
  oddsTable.classList.remove("hidden");
}

function updateViewButtons() {
  document.querySelectorAll(".view-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.activeView);
  });
  oddsRow.classList.toggle("hidden", state.activeView !== "odds");
}

function updateOddsButtons() {
  document.querySelectorAll(".odds-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.bet === state.activeOddsBet);
  });
}

function formatShutubaOdds(value) {
  const text = String(value || "").trim();
  if (!text || text === "---.-" || text === "**" || text === "--") {
    return "-";
  }
  return text;
}

function formatShutubaNinki(value) {
  const text = String(value || "").trim();
  if (!text || text === "**" || text === "--") {
    return "-";
  }
  return text;
}

function isHotOdds(value) {
  if (!value || value === "---.-" || value === "-") return false;
  const number = Number(String(value).split("-")[0]);
  return !Number.isNaN(number) && number > 0 && number <= 10;
}

function renderNinki(value) {
  if (!value || value === "-" || value === "**") {
    return escapeHtml(value || "-");
  }
  const rank = String(value).trim();
  if (["1", "2", "3"].includes(rank)) {
    return `<span class="ninki-${rank}">${escapeHtml(rank)}</span>`;
  }
  return escapeHtml(rank);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function handleError(error) {
  if (state.activeView === "odds") {
    renderOddsUnavailable("オッズを取得できませんでした");
  } else {
    renderEmpty("データを取得できませんでした");
  }
  showStatus(error.message, true);
  console.error(error);
}

let statusTimer = null;
let autoRefreshTimer = null;
let autoRefreshInFlight = false;

function buildApiUrl(path, params, bustCache = false) {
  const search = new URLSearchParams(params);
  if (bustCache) {
    search.set("_", String(Date.now()));
  }
  return `${path}?${search.toString()}`;
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshTimer = window.setInterval(() => {
    if (document.hidden || !state.selectedRaceNo) return;
    refreshCurrentData().catch((error) => {
      console.error("auto refresh failed", error);
    });
  }, AUTO_REFRESH_MS);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    window.clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

async function refreshCurrentData() {
  if (autoRefreshInFlight || !state.selectedRaceNo) return;

  autoRefreshInFlight = true;
  try {
    if (state.activeView === "odds") {
      await loadShutuba({ renderTable: false, silent: true });
      await loadOdds({ silent: true });
    } else {
      await loadShutuba({ renderTable: true, silent: true });
    }
    updateLastRefreshed();
  } finally {
    autoRefreshInFlight = false;
  }
}

function updateLastRefreshed() {
  if (!refreshMeta) return;
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  refreshMeta.textContent = `自動更新 ${hours}:${minutes}`;
  refreshMeta.classList.remove("hidden");
}

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.add("show");
  statusEl.classList.toggle("error", isError);
  clearTimeout(statusTimer);
}

function hideStatus(delay = 500) {
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusEl.classList.remove("show", "error");
  }, delay);
}
