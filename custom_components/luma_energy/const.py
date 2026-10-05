import json
from pathlib import Path


DOMAIN = "luma_energy"
CONF_URL = "url"
CONF_TOKEN = "token"
PLATFORMS = ["sensor"]
DEFAULT_SCAN_INTERVAL = 300
CARD_PATH = "/luma_energy/luma-energy-card.js"

try:
    _VERSION = json.loads(Path(__file__).with_name("manifest.json").read_text())["version"]
except (OSError, KeyError, json.JSONDecodeError):
    _VERSION = "dev"

CARD_URL = f"{CARD_PATH}?v={_VERSION}"
