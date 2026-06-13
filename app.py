import os
from datetime import date

from flask import Flask, jsonify, render_template, request

from scraper import (
    build_date_options,
    get_odds,
    get_race_list,
    get_shutuba_with_odds,
)

app = Flask(__name__)


def build_initial_payload() -> dict:
    dates = build_date_options()
    selected_date = _pick_initial_date(dates)
    venues: list[dict] = []
    shutuba = None
    selected_race_no = None

    try:
        venues = get_race_list(selected_date.replace("-", ""))
        if venues and venues[0]["races"]:
            selected_race_no = venues[0]["races"][0]["race_no"]
            race_id = venues[0]["races"][0]["race_id"]
            shutuba = get_shutuba_with_odds(race_id)
            odds = get_odds(race_id, "win_place")
    except Exception:  # noqa: BLE001
        venues = []
        shutuba = None
        odds = None
        selected_race_no = None

    return {
        "dates": dates,
        "selectedDate": selected_date,
        "venues": venues,
        "selectedVenueIndex": 0,
        "selectedRaceNo": selected_race_no,
        "shutuba": shutuba,
        "odds": odds,
        "activeView": "shutuba",
        "activeOddsBet": "win_place",
    }


def _pick_initial_date(dates: list[dict]) -> str:
    today = date.today().isoformat()
    ordered = [item["date"] for item in dates]

    if today in ordered:
        return today

    for item in ordered:
        if item >= today:
            return item

    return ordered[-1] if ordered else today


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/")
def index():
    return render_template("index.html", initial_data=build_initial_payload())


@app.get("/api/dates")
def api_dates():
    center = request.args.get("center")
    center_date = date.fromisoformat(center) if center else date.today()
    return jsonify({"dates": build_date_options(center_date)})


@app.get("/api/races")
def api_races():
    kaisai_date = request.args.get("date")
    if not kaisai_date:
        return jsonify({"error": "date is required"}), 400

    try:
        venues = get_race_list(kaisai_date.replace("-", ""))
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 502

    return jsonify({"date": kaisai_date, "venues": venues})


@app.get("/api/shutuba")
def api_shutuba():
    race_id = request.args.get("race_id")
    if not race_id:
        return jsonify({"error": "race_id is required"}), 400

    try:
        data = get_shutuba_with_odds(race_id)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 502

    return jsonify(data)


@app.get("/api/odds")
def api_odds():
    race_id = request.args.get("race_id")
    bet_type = request.args.get("bet", "win_place")
    if not race_id:
        return jsonify({"error": "race_id is required"}), 400

    try:
        data = get_odds(race_id, bet_type)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 502

    return jsonify(data)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
