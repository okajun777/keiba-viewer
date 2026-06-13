import os
from datetime import date

from flask import Flask, jsonify, render_template, request

from scraper import build_date_options, get_race_list, get_shutuba

app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/")
def index():
    return render_template("index.html")

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
        data = get_shutuba(race_id)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 502

    return jsonify(data)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)