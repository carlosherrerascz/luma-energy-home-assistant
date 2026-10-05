from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_URL
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import LumaApi
from .const import CONF_TOKEN, DOMAIN


class LumaConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input:
            url = user_input[CONF_URL].rstrip("/")
            try:
                status = await LumaApi(
                    async_get_clientsession(self.hass), url, user_input[CONF_TOKEN]
                ).status()
            except Exception:
                errors["base"] = "cannot_connect"
            else:
                await self.async_set_unique_id(status.get("account_alias", url))
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title=f"LUMA Energy ({status.get('account_alias', 'home')})", data={
                    CONF_URL: url,
                    CONF_TOKEN: user_input[CONF_TOKEN],
                })
        schema = vol.Schema({
            vol.Required(CONF_URL, default="http://127.0.0.1:8092"): str,
            vol.Required(CONF_TOKEN): str,
        })
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)
