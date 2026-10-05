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
        return self.coordinator.data.get(self._key)
