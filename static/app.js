const state = {
  dates: [],
  selectedDate: null,
  venues: [],
  selectedVenueIndex: 0,
  selectedRaceNo: null,
  loading: false,
};

const dateScroll = document.getElementById("dateScroll");
const venueRow = document.getElementById("venueRow");
const raceRow = document.getElementById("raceRow");
const horseBody = document.getElementById("horseBody");
const raceNo = document.getElementById("raceNo");
const raceName = document.getElementById("raceName");
const raceData01 = document.getElementById("raceData01");
const raceData02 = document.getElementById("raceData02");
const sourceLink = document.getElementById("sourceLink");
const statusEl = document.getElementById("status");

document.getElementById("prevDate").addEventListener("click", () => shiftDate(-1));
document.getElementById("nextDate").addEventListener("click", () => shiftDate(1));

let initAttempts = 0;

init();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, retries = 20) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        showStatus(`サーバー起動中... (${attempt}/${retries})`);
        await sleep(4000);
      }
    }
  }

  throw lastError;
}

async function init() {
  showStatus(initAttempts > 0 ? `再読み込み中... (${initAttempts + 1})` : "読み込み中...");
  try {
    const data = await fetchJson("/api/dates");
    state.dates = data.dates;
    state.selectedDate = findClosestDate(state.dates);
    renderDates();
    await loadRaces();
    initAttempts = 0;
  } catch (error) {
    initAttempts += 1;
    if (initAttempts < 8) {
      showStatus(`サーバー起動待ち... (${initAttempts}/8)`, true);
      setTimeout(() => init(), 5000);
      return;
    }
    renderEmpty("データを読み込めませんでした。ページを再読み込みしてください。");
    showStatus("初期化に失敗しました", true);
    console.error(error);
  } finally {
    if (initAttempts === 0) {
      hideStatus(1500);
    }
  }
}

function findClosestDate(dates) {
  const today = new Date().toISOString().slice(0, 10);
  const exact = dates.find((item) => item.date === today);
  if (exact) return exact.date;

  const future = dates.find((item) => item.date >= today);
  return future ? future.date : dates[dates.length - 1].date;
}

function renderDates() {
  dateScroll.innerHTML = "";
  state.dates.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip" + (item.date === state.selectedDate ? " active" : "");
    button.textContent = item.label;
    button.addEventListener("click", async () => {
      if (state.selectedDate === item.date) return;
      state.selectedDate = item.date;
      renderDates();
      await loadRaces();
    });
    dateScroll.appendChild(button);
  });

  const active = dateScroll.querySelector(".chip.active");
  if (active) {
    active.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
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
    const data = await fetchJson(`/api/races?date=${state.selectedDate}`, 3);

    state.venues = data.venues || [];
    state.selectedVenueIndex = 0;
    state.selectedRaceNo = state.venues[0]?.races?.[0]?.race_no ?? null;

    renderVenues();
    renderRaces();

    if (state.selectedRaceNo) {
      await loadShutuba();
    } else {
      renderEmpty("この日は開催がありません");
    }
  } catch (error) {
    renderEmpty("レース一覧を取得できませんでした");
    showStatus(error.message, true);
    console.error(error);
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
    button.addEventListener("click", async () => {
      if (state.selectedVenueIndex === index) return;
      state.selectedVenueIndex = index;
      state.selectedRaceNo = venue.races[0]?.race_no ?? null;
      renderVenues();
      renderRaces();
      if (state.selectedRaceNo) {
        await loadShutuba();
      }
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
    button.addEventListener("click", async () => {
      if (state.selectedRaceNo === race.race_no) return;
      state.selectedRaceNo = race.race_no;
      renderRaces();
      await loadShutuba();
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

async function loadShutuba() {
  const raceId = currentRaceId();
  if (!raceId) {
    renderEmpty("レースが見つかりません");
    return;
  }

  showStatus("出馬表を取得中...");
  try {
    const data = await fetchJson(`/api/shutuba?race_id=${raceId}`, 3);
    renderShutuba(data);
  } catch (error) {
    renderEmpty("出馬表を取得できませんでした");
    showStatus(error.message, true);
    console.error(error);
  } finally {
    hideStatus();
  }
}

function renderShutuba(data) {
  raceNo.textContent = `${data.race_no}R`;
  raceName.textContent = data.race_name || "レース名不明";
  raceData01.textContent = data.race_data01 || "";
  raceData02.textContent = data.race_data02 || "";
  sourceLink.href = data.source_url;

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
        <td>${escapeHtml(horse.odds || "-")}</td>
        <td>${escapeHtml(horse.ninki || "-")}</td>
      </tr>
    `
    )
    .join("");
}

function renderEmpty(message) {
  raceNo.textContent = "-R";
  raceName.textContent = message;
  raceData01.textContent = "";
  raceData02.textContent = "";
  sourceLink.href = "#";
  horseBody.innerHTML = `<tr><td colspan="10" class="empty">${escapeHtml(message)}</td></tr>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

let statusTimer = null;

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
