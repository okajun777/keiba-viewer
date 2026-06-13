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
    return response.content.decode("euc-jp")


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
