from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from homeassistant.helpers import aiohttp_client
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
import voluptuous as vol

from .api import LumaApi
from .const import CONF_TOKEN, CONF_URL, DOMAIN, PLATFORMS


@websocket_api.websocket_command({
    "type": "luma_energy/period_summary",
    "start": str,
    "end": str,
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
        result = await api.period_summary(msg["start"], msg["end"], msg.get("basis", "bill_issue"))
    except Exception as err:
        connection.send_error(msg["id"], "api_error", str(err))
        return
    connection.send_result(msg["id"], result)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    api = LumaApi(aiohttp_client.async_get_clientsession(hass), entry.data[CONF_URL], entry.data[CONF_TOKEN])
    coordinator = DataUpdateCoordinator(
        hass,
        logger=__import__("logging").getLogger(__name__),
        name="LUMA Energy",
        update_method=api.status,
        update_interval=__import__("datetime").timedelta(minutes=5),
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
