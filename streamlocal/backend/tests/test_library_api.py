from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

def test_reject_missing_library_folder():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/library/sources",
            json={"path": r"Z:\this\folder\does\not\exist", "source_type": "automatic"},
        )
        assert response.status_code == 400

def test_media_endpoint_returns_list():
    with TestClient(app) as client:
        response = client.get("/api/v1/media")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
