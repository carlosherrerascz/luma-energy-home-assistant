# LUMA Energy for Home Assistant

> **Personal project warning:** This integration is built for my own Home Assistant
> setup and is experimental. It may not work for anyone else, may remain broken
> for the foreseeable future, and may never become a generally usable project.
> Use it only if you are comfortable troubleshooting and adapting it yourself.

This repository contains the Home Assistant custom integration and Lovelace card
for a self-hosted LUMA Energy service.

The integration keeps the LUMA API token in Home Assistant's config entry and
performs authenticated requests on the Home Assistant backend. The Lovelace
card never receives the service token. It exposes the read-only period-summary
WebSocket command `luma_energy/period_summary` and status sensors.

## Installation

Install with HACS as a custom repository, or copy `custom_components/luma_energy`
into Home Assistant's `config/custom_components` directory. Add **LUMA Energy**
from Settings → Devices & services and enter the service URL and reader token.

The integration automatically registers its summary card when it loads. Add
`type: custom:luma-energy-card` to a dashboard; no separate JavaScript resource
is required. With no date options, the card shows the latest available bill.
It accepts
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
