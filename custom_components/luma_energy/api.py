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

    async def latest_summary(self):
        bills = await self._get("/api/bills")
        if not bills:
            return {
                "start": None,
                "end": None,
                "basis": "bill_issue",
                "bills": [],
                "totals": {},
                "coverage": {"bill_count": 0, "months_with_bills": []},
                "billing_note": "No LUMA bills are available yet.",
            }
        latest = max(bills, key=lambda item: item["bill"]["issue_date"])
        comparison = await self._get(f"/api/bills/{latest['id']}/comparison")
        totals = {
            field: comparison.get(field)
            for field in (
                "actual_cents",
                "loan_cents",
                "combined_cents",
                "without_solar_cents",
                "utility_bill_reduction_cents",
                "solar_savings_cents",
            )
        }
        return {
            "start": comparison["start"],
            "end": comparison["end"],
            "basis": "bill_issue",
            "bills": [comparison],
            "totals": totals,
            "coverage": {
                "bill_count": 1,
                "months_with_bills": [comparison["issue_date"][:7]],
            },
            "billing_note": "Latest available LUMA bill; energy totals use its billing coverage dates.",
            "revision": comparison.get("freshness", {}).get("computed_at"),
        }

    async def period_summary(self, start: str, end: str, basis: str):
        if basis not in {"bill_issue", "calendar"}:
            raise ValueError("basis must be bill_issue or calendar")
        return await self._get("/api/period-summary", start=start, end=end, basis=basis)
