import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.auth import get_current_user
from app.config import settings
from app.models import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["places"])

OTM_BASE = "https://api.opentripmap.com/0.1/en/places"

limiter = Limiter(key_func=get_remote_address)


async def _otm_request(path: str, params: dict) -> dict | list:
    """Make a request to the OpenTripMap API and return parsed JSON."""
    if not settings.OPENTRIPMAP_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="OpenTripMap API key not configured",
        )

    params["apikey"] = settings.OPENTRIPMAP_API_KEY
    url = f"{OTM_BASE}{path}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url, params=params)
        except httpx.RequestError as exc:
            logger.error("OpenTripMap request failed: %s", exc)
            raise HTTPException(
                status_code=502,
                detail="Failed to reach OpenTripMap API",
            )

    if resp.status_code != 200:
        logger.warning(
            "OpenTripMap returned %d for %s", resp.status_code, path
        )
        raise HTTPException(
            status_code=502,
            detail=f"OpenTripMap API error (HTTP {resp.status_code})",
        )

    return resp.json()


@router.get("/places/autosuggest")
@limiter.limit("10/second")
async def autosuggest(
    request: Request,
    name: str = Query(..., min_length=3, max_length=200),
    lat: float = Query(...),
    lon: float = Query(...),
    radius: int = Query(default=10000, ge=100, le=50000),
    kinds: str | None = Query(default=None),
    rate: int = Query(default=1, ge=0, le=3),
    limit: int = Query(default=15, ge=1, le=50),
    user: User = Depends(get_current_user),
):
    params = {
        "name": name,
        "lat": lat,
        "lon": lon,
        "radius": radius,
        "rate": str(rate),
        "limit": limit,
        "format": "json",
    }
    if kinds:
        params["kinds"] = kinds

    return await _otm_request("/autosuggest", params)


@router.get("/places/radius")
@limiter.limit("10/second")
async def radius_search(
    request: Request,
    lat: float = Query(...),
    lon: float = Query(...),
    radius: int = Query(default=10000, ge=100, le=50000),
    kinds: str | None = Query(default=None),
    rate: int = Query(default=1, ge=0, le=3),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
):
    params = {
        "lat": lat,
        "lon": lon,
        "radius": radius,
        "rate": str(rate),
        "limit": limit,
        "format": "json",
    }
    if kinds:
        params["kinds"] = kinds

    return await _otm_request("/radius", params)


@router.get("/places/geoname")
@limiter.limit("10/second")
async def geoname(
    request: Request,
    name: str = Query(..., min_length=1, max_length=200),
    user: User = Depends(get_current_user),
):
    params = {"name": name}
    return await _otm_request("/geoname", params)


@router.get("/places/{xid}")
@limiter.limit("10/second")
async def place_detail(
    request: Request,
    xid: str,
    user: User = Depends(get_current_user),
):
    if not xid or len(xid) > 100:
        raise HTTPException(status_code=400, detail="Invalid xid")

    return await _otm_request(f"/xid/{xid}", {})
