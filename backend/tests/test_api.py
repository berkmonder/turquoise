import json
import time

from fastapi.testclient import TestClient

from app.main import app


def events(text: str) -> list[dict]:
    return [json.loads(line[6:]) for line in text.splitlines() if line.startswith("data: ")]


def test_chat_falls_back_to_search_without_a_gpu():
    with TestClient(app) as client:
        response = client.post("/api/chat", json={"message": "What are his skills?"})
        assert response.status_code == 200
        got = events(response.text)
        assert got[0]["type"] == "conversation"
        stages = [e["stage"] for e in got if e["type"] == "stage"]
        assert stages[:2] == ["received", "router"]
        done = got[-1]
        assert done["type"] == "done" and done["served_by"] == "fallback"
        assert done["reason"] == "not_configured"
        text = "".join(e["text"] for e in got if e["type"] == "token")
        assert "Skills" in text

        again = client.post("/api/chat", json={"message": "And his education?",
                                               "conversation_id": got[0]["id"]})
        assert events(again.text)[0]["id"] == got[0]["id"]


def test_visitors_are_limited():
    with TestClient(app) as client:
        codes = [client.post("/api/chat", json={"message": "hi"},
                             headers={"x-forwarded-for": "203.0.113.9"}).status_code
                 for _ in range(12)]
        assert codes.count(429) == 2


def test_contact_is_kept():
    with TestClient(app) as client:
        ok = client.post("/api/contact", json={"name": "Ada", "email": "ada@example.com",
                                               "message": "Let's talk"})
        assert ok.status_code == 201
        bad = client.post("/api/contact", json={"name": "Ada", "email": "not-an-email"})
        assert bad.status_code == 422


def test_points_are_judged_against_the_band():
    with TestClient(app) as client:
        time.sleep(1.2)  # the demo's first forecast
        snapshot = client.get("/api/status").json()
        assert snapshot["gpu"]["llm"]["configured"] is False
        from app.anomaly import routes

        demo = routes.demo
        assert demo is not None
        past = max(s for s in demo.bands if s <= demo.step)
        band = demo.bands[past]
        normal = client.post("/api/anomaly/points", json={"t": past * 0.25, "y": band.expected})
        odd = client.post("/api/anomaly/points",
                          json={"t": past * 0.25, "y": band.expected + 10 * band.sigma})
        assert normal.json()["label"] == "normal"
        assert odd.json()["label"] == "anomaly"

        # A point in the future waits for its moment, then is judged against that moment's last band.
        future = max(demo.bands)
        waiting = client.post("/api/anomaly/points",
                              json={"t": future * 0.25, "y": demo.bands[future].expected})
        assert waiting.json()["label"] == "pending"
        point_id = waiting.json()["id"]
        demo.step = future
        demo.judge_due()
        assert point_id not in demo.pending
        assert [d["label"] for d in demo.detections if d["id"] == point_id] == ["normal"]
        off_chart = client.post("/api/anomaly/points", json={"t": 1.0, "y": 0.0})
        assert off_chart.status_code == 422


def test_api_finds_a_spike():
    import math

    values = [math.sin(i / 5) for i in range(300)]
    values[200] = 4.0
    with TestClient(app) as client:
        result = client.post("/api/v1/anomaly/detect", json={"values": values}).json()
        assert result["served_by"] == "fallback"
        assert 200 in [a["index"] for a in result["anomalies"]]
