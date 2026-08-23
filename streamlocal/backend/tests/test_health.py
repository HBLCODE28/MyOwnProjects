from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint_returns_200() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    payload = response.json()

    assert payload["backend"]["status"] == "ok"
    assert payload["database"]["status"] == "ok"
    assert payload["status"] in {"ok", "degraded"}
    assert "ffmpeg" in payload
    assert payload["app_data_dir"]


def test_root_endpoint_identifies_streamlocal() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["name"] == "StreamLocal"
