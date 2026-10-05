from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback):
    coordinator = hass.data[DOMAIN][entry.entry_id]["coordinator"]
    async_add_entities([
        LumaStatusSensor(coordinator, entry, "sync_state", "Sync state"),
        LumaStatusSensor(coordinator, entry, "last_luma_sync", "Last LUMA sync"),
        LumaStatusSensor(coordinator, entry, "last_eg4_sync", "Last EG4 sync"),
        LumaStatusSensor(coordinator, entry, "revision", "Data revision"),
        LumaSummarySensor(coordinator, entry, "actual_cents", "Latest actual charges", "$"),
        LumaSummarySensor(coordinator, entry, "amount_due_cents", "Latest amount due", "$"),
        LumaSummarySensor(coordinator, entry, "without_solar_cents", "Latest cost without solar", "$"),
        LumaSummarySensor(coordinator, entry, "utility_bill_reduction_cents", "Latest utility reduction", "$"),
        LumaSummarySensor(coordinator, entry, "loan_cents", "Latest loan payment", "$"),
        LumaSummarySensor(coordinator, entry, "combined_cents", "Latest charges plus loan", "$"),
        LumaSummarySensor(coordinator, entry, "solar_savings_cents", "Latest savings after loan", "$"),
        LumaSummarySensor(coordinator, entry, "luma_import_kwh", "Latest LUMA imports", "kWh"),
        LumaSummarySensor(coordinator, entry, "luma_export_kwh", "Latest LUMA exports", "kWh"),
        LumaSummarySensor(coordinator, entry, "import_kwh", "Latest EG4 imports", "kWh"),
        LumaSummarySensor(coordinator, entry, "export_kwh", "Latest EG4 exports", "kWh"),
    ])


class LumaStatusSensor(CoordinatorEntity, SensorEntity):
    _attr_should_poll = False

    def __init__(self, coordinator, entry, key: str, name: str):
        super().__init__(coordinator)
        self._key = key
        self._attr_name = name
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_device_info = {"identifiers": {(DOMAIN, entry.entry_id)}, "name": "LUMA Energy"}

    @property
    def native_value(self):
        return self.coordinator.data.get("status", {}).get(self._key)


class LumaSummarySensor(CoordinatorEntity, SensorEntity):
    _attr_should_poll = False

    def __init__(self, coordinator, entry, key: str, name: str, unit: str):
        super().__init__(coordinator)
        self._key = key
        self._attr_name = name
        self._attr_native_unit_of_measurement = unit
        self._attr_unique_id = f"{entry.entry_id}_latest_{key}"
        self._attr_device_info = {"identifiers": {(DOMAIN, entry.entry_id)}, "name": "LUMA Energy"}

    @property
    def native_value(self):
        comparison = next(iter(self.coordinator.data.get("summary", {}).get("bills") or []), {})
        if self._key.endswith("_cents"):
            value = comparison.get(self._key)
            return None if value is None else value / 100
        if self._key in {"luma_import_kwh", "luma_export_kwh"}:
            field = "import" if self._key == "luma_import_kwh" else "export"
            value = comparison.get("differences", {}).get(field, {}).get("luma_kwh")
            return None if value is None else float(value)
        field = self._key.removesuffix("_kwh")
        value = comparison.get("energy", {}).get("totals_kwh", {}).get(field)
        return None if value is None else float(value)

    @property
    def extra_state_attributes(self):
        summary = self.coordinator.data.get("summary", {})
        comparison = next(iter(summary.get("bills") or []), {})
        return {
            "bill_id": comparison.get("bill_id"),
            "issue_date": comparison.get("issue_date"),
            "billing_start": comparison.get("start"),
            "billing_end": comparison.get("end"),
            "confidence": comparison.get("confidence"),
            "warnings": comparison.get("warnings", []),
            "missing_days": comparison.get("energy", {}).get("missing_days", {}),
        }
