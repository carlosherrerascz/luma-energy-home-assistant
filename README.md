# LUMA Energy for Home Assistant

This repository contains the Home Assistant custom integration and Lovelace card
for the self-hosted [LUMA Energy service](https://github.com/carlosherrerascz/luma-energy).

The integration keeps the LUMA API token in Home Assistant's config entry and
performs authenticated requests on the Home Assistant backend. The Lovelace
card never receives the service token. It exposes the read-only period-summary
WebSocket command `luma_energy/period_summary` and status sensors.

## Installation

Install with HACS as a custom repository, or copy `custom_components/luma_energy`
into Home Assistant's `config/custom_components` directory. Add **LUMA Energy**
from Settings → Devices & services and enter the service URL and reader token.

Add the card as a Lovelace resource:

```yaml
url: /local/luma-energy-card.js
type: module
```

Then add `type: custom:luma-energy-card` to a dashboard. The card accepts
`period_start`, `period_end`, and `basis` overrides. When the host dashboard
publishes `luma-energy-period-changed`, it follows that selection automatically:

```js
window.dispatchEvent(new CustomEvent("luma-energy-period-changed", {
  detail: { start: "2026-09-01", end: "2026-10-01", basis: "bill_issue" }
}));
```

## Releases

Commits use Conventional Commits. Merges to `main` run semantic-release, which
creates the `vX.Y.Z` tag, changelog, GitHub release, and a HACS-compatible zip.

