import os
from unittest.mock import Mock

import pytest
from httpx import AsyncClient, ASGITransport

os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role")
os.environ.setdefault("JWT_SECRET", "test-secret")

from main import app

# Minimal smoke test
@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

@pytest.mark.asyncio
async def test_verify_access_invalid_token(monkeypatch):
    # Mock Supabase response for non-existent token
    import app.routers.share as share_router

    mock_supabase = Mock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    monkeypatch.setattr(share_router, "supabase", mock_supabase)
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/share/invalid_token/verify", json={"password": "wrong"})
    
    # Now it should be a clean 404
    assert response.status_code == 404
    assert response.json()["detail"] == "Link not found"

# Add more integration tests here using pytest-mock for Supabase
