from __future__ import annotations

from homeassistant.components import websocket_api
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.components.lovelace.const import (
    CONF_RESOURCE_TYPE_WS,
    LOVELACE_DATA,
    MODE_STORAGE,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import aiohttp_client
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from datetime import timedelta
from pathlib import Path
import logging
import voluptuous as vol

from .api import LumaApi
from .const import CARD_PATH, CARD_URL, CONF_TOKEN, CONF_URL, DOMAIN, PLATFORMS

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    domain_data = hass.data.setdefault(DOMAIN, {})
    if not domain_data.get("card_registered"):
        card_path = Path(__file__).with_name("luma-energy-card.js")
        await hass.http.async_register_static_paths([
            StaticPathConfig(CARD_PATH, str(card_path), cache_headers=True)
        ])
        await _async_register_card(hass)
        domain_data["card_registered"] = True
    return True


async def _async_register_card(hass: HomeAssistant) -> None:
    """Register the card as a Lovelace resource without user configuration."""
    lovelace = hass.data.get(LOVELACE_DATA)
    if lovelace is None or lovelace.resource_mode != MODE_STORAGE:
        # YAML resource mode cannot be changed at runtime. Loading the module
        # through the frontend keeps the card configuration-free in that mode.
        add_extra_js_url(hass, CARD_URL)
        return

    resources = lovelace.resources
    await resources.async_get_info()
    existing = next(
        (
            item
            for item in resources.async_items()
            if item.get("url", "").split("?", 1)[0] == CARD_PATH
        ),
        None,
    )
    resource = {CONF_RESOURCE_TYPE_WS: "module", "url": CARD_URL}
    if existing is None:
        await resources.async_create_item(resource)
    elif existing.get("url") != CARD_URL or existing.get("type") != "module":
        await resources.async_update_item(existing["id"], resource)


@websocket_api.websocket_command({
    "type": "luma_energy/period_summary",
    vol.Optional("start"): str,
    vol.Optional("end"): str,
    vol.Optional("basis", default="bill_issue"): vol.In(["bill_issue", "calendar"]),
})
@websocket_api.async_response
async def websocket_period_summary(hass, connection, msg):
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], "not_configured", "LUMA Energy is not configured")
        return
    api = hass.data[DOMAIN][entries[0].entry_id]["api"]
    try:
        if msg.get("start") and msg.get("end"):
            result = await api.period_summary(msg["start"], msg["end"], msg.get("basis", "bill_issue"))
        elif not msg.get("start") and not msg.get("end"):
            result = await api.latest_summary()
        else:
            connection.send_error(msg["id"], "invalid_period", "start and end must be provided together")
            return
    except Exception as err:
        connection.send_error(msg["id"], "api_error", str(err))
        return
    connection.send_result(msg["id"], result)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    api = LumaApi(aiohttp_client.async_get_clientsession(hass), entry.data[CONF_URL], entry.data[CONF_TOKEN])
    coordinator = DataUpdateCoordinator(
        hass,
        logger=_LOGGER,
        name="LUMA Energy",
        update_method=lambda: _coordinator_data(api),
        update_interval=timedelta(minutes=5),
    )
    await coordinator.async_config_entry_first_refresh()
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = {"api": api, "coordinator": coordinator}

    if not hass.data[DOMAIN].get("websocket_registered"):
        websocket_api.async_register_command(hass, websocket_period_summary)
        hass.data[DOMAIN]["websocket_registered"] = True
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return unloaded


async def _coordinator_data(api: LumaApi):
    return {"status": await api.status(), "summary": await api.latest_summary()}
