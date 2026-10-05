from __future__ import annotations

from aiohttp import ClientSession


class LumaApi:
    def __init__(self, session: ClientSession, url: str, token: str) -> None:
        self._session = session
        self._url = url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {token}"}

    async def _get(self, path: str, **params):
        async with self._session.get(f"{self._url}{path}", headers=self._headers, params=params) as response:
            response.raise_for_status()
            return await response.json()

    async def status(self):
        return await self._get("/api/status")

    async def period_summary(self, start: str, end: str, basis: str):
        if basis not in {"bill_issue", "calendar"}:
            raise ValueError("basis must be bill_issue or calendar")
        return await self._get("/api/period-summary", start=start, end=end, basis=basis)
