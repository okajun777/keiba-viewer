"""netkeiba scraper helpers."""

from __future__ import annotations

import re
import time
from datetime import date, timedelta
from functools import wraps

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}

VENUE_CODES = {
    "01": "札幌",
    "02": "函館",
    "03": "福島",
    "04": "新潟",
    "05": "東京",
    "06": "中山",
    "07": "中京",
    "08": "京都",
    "09": "阪神",
    "10": "小倉",
}

WAKU_COLORS = {
    "1": "#ffffff",
    "2": "#222222",
    "3": "#e53935",
    "4": "#1e88e5",
    "5": "#fdd835",
    "6": "#43a047",
    "7": "#fb8c00",
    "8": "#ec407a",
}

WAKU_TEXT_COLORS = {
    "1": "#222222",
    "2": "#ffffff",
    "3": "#ffffff",
    "4": "#ffffff",
    "5": "#222222",
    "6": "#ffffff",
    "7": "#ffffff",
    "8": "#ffffff",
}

WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"]

ODDS_BET_TYPES = {
    "win_place": {"api_type": 1, "label": "単勝・複勝"},
    "umaren": {"api_type": 4, "label": "馬連"},
    "wide": {"api_type": 5, "label": "ワイド"},
    "umatan": {"api_type": 6, "label": "馬単"},
    "sanrenpuku": {"api_type": 7, "label": "3連複"},
    "sanrentan": {"api_type": 8, "label": "3連単"},
}

_CACHE: dict[tuple, tuple[float, object]] = {}


def cached(ttl_seconds: int):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = (func.__name__, args, tuple(sorted(kwargs.items())))
            now = time.time()
            cached_value = _CACHE.get(key)
            if cached_value and now < cached_value[0]:
                return cached_value[1]

            value = func(*args, **kwargs)
            _CACHE[key] = (now + ttl_seconds, value)
            return value

        return wrapper

    return decorator


def fetch_html(url: str) -> str:
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    raw = response.content
    for encoding in ("euc-jp", "cp932", "utf-8"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("euc-jp", errors="replace")


def build_date_options(center: date | None = None, span: int = 14) -> list[dict]:
    center = center or date.today()
    start = center - timedelta(days=span)
    end = center + timedelta(days=span)
    options: list[dict] = []
    current = start
    while current <= end:
        options.append(
            {
                "date": current.isoformat(),
                "label": f"{current.month}/{current.day}({WEEKDAYS[current.weekday()]})",
            }
        )
        current += timedelta(days=1)
    return options


def parse_race_list(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    venues: list[dict] = []

    for block in soup.select("dl.RaceList_DataList"):
        title_el = block.select_one("dt")
        if not title_el:
            continue

        venue_title = title_el.get_text(" ", strip=True)
        venue_name = _extract_venue_name(venue_title)
        races: list[dict] = []

        for item in block.select("dd li"):
            link = item.select_one("a")
            if not link:
                continue
            href = link.get("href", "")
            match = re.search(r"race_id=(\d{12})", href)
            if not match:
                continue

            race_id = match.group(1)
            text = link.get_text(" ", strip=True)
            race_no = int(race_id[-2:])
            races.append(
                {
                    "race_id": race_id,
                    "race_no": race_no,
                    "label": f"{race_no}R",
                    "summary": text,
                }
            )

        if races:
            venue_code = races[0]["race_id"][4:6]
            venue_name = VENUE_CODES.get(venue_code, _extract_venue_name(venue_title))
            venues.append(
                {
                    "venue_name": venue_name,
                    "venue_title": venue_title,
                    "races": races,
                }
            )

    return venues


def _extract_venue_name(title: str) -> str:
    for name in VENUE_CODES.values():
        if name in title:
            return name
    return title


def _clean_text(value: str) -> str:
    return " ".join(value.replace("\n", " ").split())


def parse_shutuba(html: str, race_id: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    race_name_el = soup.select_one(".RaceName")
    race_data01_el = soup.select_one(".RaceData01")
    race_data02_el = soup.select_one(".RaceData02")

    horses: list[dict] = []
    for row in soup.select("tr.HorseList"):
        cells = row.select("td")
        if len(cells) < 8:
            continue

        horse_link = cells[3].select_one("a")
        horse_name = (
            horse_link.get_text(strip=True)
            if horse_link
            else cells[3].get_text(strip=True)
        )

        waku = cells[0].get_text(strip=True)
        horses.append(
            {
                "waku": waku,
                "waku_color": WAKU_COLORS.get(waku, "#cccccc"),
                "waku_text_color": WAKU_TEXT_COLORS.get(waku, "#222222"),
                "umaban": cells[1].get_text(strip=True),
                "horse_name": horse_name,
                "sex_age": cells[4].get_text(strip=True),
                "kinryo": cells[5].get_text(strip=True),
                "jockey": cells[6].get_text(strip=True),
                "trainer": cells[7].get_text(strip=True),
                "weight": cells[8].get_text(strip=True) if len(cells) > 8 else "",
                "odds": cells[9].get_text(strip=True) if len(cells) > 9 else "",
                "ninki": cells[10].get_text(strip=True) if len(cells) > 10 else "",
            }
        )

    venue_code = race_id[4:6]
    return {
        "race_id": race_id,
        "race_no": int(race_id[-2:]),
        "venue_name": VENUE_CODES.get(venue_code, ""),
        "race_name": race_name_el.get_text(strip=True) if race_name_el else "",
        "race_data01": _clean_text(race_data01_el.get_text(" ", strip=True) if race_data01_el else ""),
        "race_data02": _clean_text(race_data02_el.get_text(" ", strip=True) if race_data02_el else ""),
        "horses": horses,
        "source_url": f"https://race.netkeiba.com/race/shutuba.html?race_id={race_id}",
    }


@cached(300)
def get_race_list(kaisai_date: str) -> list[dict]:
    url = (
        "https://race.netkeiba.com/top/race_list_sub.html"
        f"?kaisai_date={kaisai_date}"
    )
    return parse_race_list(fetch_html(url))


@cached(60)
def get_shutuba(race_id: str) -> dict:
    url = f"https://race.netkeiba.com/race/shutuba.html?race_id={race_id}"
    return parse_shutuba(fetch_html(url), race_id)


def _parse_odds_value(value: str) -> str:
    return value.replace(",", "").strip()


def _decode_combo(key: str) -> list[int]:
    return [int(key[i : i + 2]) for i in range(0, len(key), 2)]


def _fetch_odds_raw(race_id: str, api_type: int) -> dict:
    url = (
        "https://race.netkeiba.com/api/api_get_jra_odds.html"
        f"?race_id={race_id}&type={api_type}"
    )
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    return response.json()


def parse_win_place_odds(data: dict, horses: list[dict]) -> dict:
    horse_map = {horse["umaban"]: horse for horse in horses}
    odds_block = data.get("odds", {})
    tansho = odds_block.get("1", {})
    fukusho = odds_block.get("2", {})

    rows: list[dict] = []
    for umaban, horse in sorted(horse_map.items(), key=lambda item: int(item[0])):
        key = str(umaban).zfill(2)
        tansho_info = tansho.get(key, [])
        fukusho_info = fukusho.get(key, [])
        tansho_odds = _parse_odds_value(tansho_info[0]) if len(tansho_info) > 0 else ""
        fukusho_min = _parse_odds_value(fukusho_info[0]) if len(fukusho_info) > 0 else ""
        fukusho_max = _parse_odds_value(fukusho_info[1]) if len(fukusho_info) > 1 else ""
        tansho_ninki = tansho_info[2] if len(tansho_info) > 2 else ""
        fukusho_ninki = fukusho_info[2] if len(fukusho_info) > 2 else ""
        fukusho_text = (
            f"{fukusho_min}-{fukusho_max}"
            if fukusho_min and fukusho_max and fukusho_min != fukusho_max
            else fukusho_min or fukusho_max
        )
        rows.append(
            {
                "waku": horse["waku"],
                "waku_color": horse["waku_color"],
                "waku_text_color": horse["waku_text_color"],
                "umaban": umaban,
                "horse_name": horse["horse_name"],
                "tansho_odds": tansho_odds,
                "fukusho_odds": fukusho_text,
                "tansho_ninki": tansho_ninki,
                "fukusho_ninki": fukusho_ninki,
            }
        )

    return {"bet_type": "win_place", "label": "単勝・複勝", "rows": rows}


def parse_combo_odds(data: dict, bet_type: str, label: str) -> dict:
    odds_block = data.get("odds", {})
    target_key = str(ODDS_BET_TYPES[bet_type]["api_type"])
    entries = odds_block.get(target_key, {})

    rows: list[dict] = []
    for combo_key, values in entries.items():
        odds_value = _parse_odds_value(values[0]) if values else ""
        odds_max = _parse_odds_value(values[1]) if len(values) > 1 else ""
        popularity = values[2] if len(values) > 2 else ""
        numbers = _decode_combo(combo_key)
        if bet_type == "wide" and odds_max and odds_max != odds_value:
            odds_text = f"{odds_value}-{odds_max}"
        else:
            odds_text = odds_value
        rows.append(
            {
                "combo": "-".join(str(number) for number in numbers),
                "numbers": numbers,
                "odds": odds_text,
                "popularity": popularity,
            }
        )

    rows.sort(
        key=lambda row: (
            int(row["popularity"]) if str(row["popularity"]).isdigit() else 9999,
            row["combo"],
        )
    )

    return {
        "bet_type": bet_type,
        "label": label,
        "rows": rows[:80],
        "total": len(rows),
    }


@cached(30)
def get_odds(race_id: str, bet_type: str = "win_place") -> dict:
    if bet_type not in ODDS_BET_TYPES:
        raise ValueError(f"Unsupported bet type: {bet_type}")

    api_type = ODDS_BET_TYPES[bet_type]["api_type"]
    label = ODDS_BET_TYPES[bet_type]["label"]
    raw = _fetch_odds_raw(race_id, api_type)
    status = raw.get("status", "")
    payload = raw.get("data") or {}

    if status != "result" or not payload:
        return {
            "race_id": race_id,
            "bet_type": bet_type,
            "label": label,
            "status": "unavailable",
            "message": "オッズは発売開始後に表示されます",
            "reason": raw.get("reason", ""),
            "source_url": (
                f"https://race.netkeiba.com/odds/index.html?race_id={race_id}"
            ),
            "purchase_url": (
                f"https://race.netkeiba.com/odds/index.html?race_id={race_id}"
            ),
            "rows": [],
        }

    if bet_type == "win_place":
        shutuba = get_shutuba(race_id)
        parsed = parse_win_place_odds(payload, shutuba["horses"])
    else:
        parsed = parse_combo_odds(payload, bet_type, label)

    parsed.update(
        {
            "race_id": race_id,
            "status": "ok",
            "official_datetime": payload.get("official_datetime", ""),
            "source_url": (
                f"https://race.netkeiba.com/odds/index.html?race_id={race_id}"
            ),
            "purchase_url": (
                f"https://race.netkeiba.com/odds/index.html?race_id={race_id}"
            ),
        }
    )
    return parsed
