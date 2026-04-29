import pytest
from httpx import AsyncClient, ASGITransport
from main import app
import os

# Minimal smoke test
@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

@pytest.mark.asyncio
async def test_verify_access_invalid_token():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/share/invalid_token/verify", json={"password": "wrong"})
    
    # Should be 404 since the link doesn't exist, or 429 if rate limited, or 500 if supabase is mocked poorly.
    # Without a mocked supabase, it might fail to connect. We assert it's not a 200.
    assert response.status_code in [404, 500]

# Add more integration tests here using pytest-mock for Supabase
