class LumaEnergyCard extends HTMLElement {
  setConfig(config) {
    this.config = config;
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>:host{display:block}.card{padding:16px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.label{color:var(--secondary-text-color);font-size:.85em}.value{font-size:1.2em}details{margin-top:12px} .error{color:var(--error-color)}</style><ha-card><div class="card"><h2>LUMA Energy</h2><div id="body">Loading…</div></div></ha-card>`;
    this._onPeriod = (event) => this._load(event.detail || {});
    window.addEventListener(config.selector_event || "luma-energy-period-changed", this._onPeriod);
  }

  set hass(hass) { this._hass = hass; if (!this._loaded) { this._loaded = true; this._load(this.config || {}); } }

  disconnectedCallback() { if (this._onPeriod) window.removeEventListener(this.config.selector_event || "luma-energy-period-changed", this._onPeriod); if (this._timer) clearTimeout(this._timer); }

  _load(selection) {
    clearTimeout(this._timer);
    this._timer = setTimeout(async () => {
      const start = selection.period_start || selection.start || this.config.period_start;
      const end = selection.period_end || selection.end || this.config.period_end;
      const basis = selection.basis || this.config.basis || "bill_issue";
      if (!start || !end || !this._hass) { this._render(`<p>Choose a period in the Energy dashboard.</p>`); return; }
      const revision = ++this._revision;
      try {
        const result = await this._hass.callWS({type:"luma_energy/period_summary", start, end, basis});
        if (revision === this._revision) this._renderResult(result);
      } catch (error) { if (revision === this._revision) this._render(`<p class="error">Unable to load LUMA data: ${error.message}</p>`); }
    }, 150);
  }

  _renderResult(data) {
    const money = (cents) => cents == null ? "—" : new Intl.NumberFormat(undefined, {style:"currency", currency:"USD"}).format(cents / 100);
    const t = data.totals || {};
    const e = data.energy?.totals_kwh || {};
    const lines = [["Actual charges",money(t.actual_cents)],["Without solar",money(t.without_solar_cents)],["Solar savings",money(t.utility_bill_reduction_cents)],["Loan payment",money(t.loan_cents)],["Savings after loan",money(t.solar_savings_cents)],["LUMA imports",`${e.import ?? "—"} kWh`],["EG4 imports",`${e.import ?? "—"} kWh`]];
    this._render(`<p>${data.start} → ${data.end} · ${data.basis === "calendar" ? "calendar energy" : "bills issued"}</p><div class="grid">${lines.map(([l,v])=>`<div><div class="label">${l}</div><div class="value">${v}</div></div>`).join("")}</div><p>${data.billing_note || ""}</p><details><summary>Calculation details</summary><pre>${JSON.stringify({coverage:data.coverage,bills:data.bills,revision:data.revision},null,2)}</pre></details>`);
  }
  _render(html) { const body = this.shadowRoot?.getElementById("body"); if (body) body.innerHTML = html; }
  getCardSize() { return 5; }
}
customElements.define("luma-energy-card", LumaEnergyCard);

