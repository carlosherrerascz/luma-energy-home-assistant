class LumaEnergyCard extends HTMLElement {
  setConfig(config) {
    this.config = config;
    this._revision = 0;
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
      const revision = ++this._revision;
      if ((!start || !end) && this.config.period_start && this.config.period_end) return;
      if (!this._hass) { this._renderMessage("Waiting for Home Assistant."); return; }
      try {
        const message = {type:"luma_energy/period_summary", basis};
        if (start && end) { message.start = start; message.end = end; }
        const result = await this._hass.callWS(message);
        if (revision === this._revision) this._renderResult(result);
      } catch (error) { if (revision === this._revision) this._renderMessage(`Unable to load LUMA data: ${error.message}`, true); }
    }, 150);
  }

  _renderResult(data) {
    const money = (cents) => cents == null ? "—" : new Intl.NumberFormat(undefined, {style:"currency", currency:"USD"}).format(cents / 100);
    const t = data.totals || {};
    const e = data.energy?.totals_kwh || {};
    const comparisons = Array.isArray(data.bills) ? data.bills : [];
    const sumDifference = (field, source) => {
      const values = comparisons.map((bill) => bill.differences?.[field]?.[source]).filter((value) => value != null);
      return values.length === comparisons.length && values.length ? values.reduce((sum, value) => sum + Number(value), 0) : null;
    };
    const lumaImport = data.basis === "calendar" ? null : sumDifference("import", "luma_kwh");
    const eg4Import = data.basis === "calendar" ? e.import : sumDifference("import", "eg4_kwh");
    const lines = [["Actual charges",money(t.actual_cents)],["Without solar",money(t.without_solar_cents)],["Solar savings",money(t.utility_bill_reduction_cents)],["Loan payment",money(t.loan_cents)],["Savings after loan",money(t.solar_savings_cents)],["LUMA imports",`${lumaImport ?? "—"} kWh`],["EG4 imports",`${eg4Import ?? "—"} kWh`]];
    const body = this.shadowRoot?.getElementById("body");
    if (!body) return;
    body.replaceChildren();
    const period = document.createElement("p");
    period.textContent = data.start ? `${data.start} → ${data.end} · ${data.basis === "calendar" ? "calendar energy" : "latest bill"}` : "No LUMA bills available";
    body.append(period);
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const [label, value] of lines) {
      const metric = document.createElement("div");
      const labelElement = document.createElement("div");
      labelElement.className = "label";
      labelElement.textContent = label;
      const valueElement = document.createElement("div");
      valueElement.className = "value";
      valueElement.textContent = value;
      metric.append(labelElement, valueElement);
      grid.append(metric);
    }
    body.append(grid);
    const note = document.createElement("p");
    note.textContent = data.billing_note || "";
    body.append(note);
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Calculation details";
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify({coverage:data.coverage,bills:data.bills,revision:data.revision}, null, 2);
    details.append(summary, pre);
    body.append(details);
  }
  _renderMessage(message, error = false) {
    const body = this.shadowRoot?.getElementById("body");
    if (!body) return;
    const paragraph = document.createElement("p");
    if (error) paragraph.className = "error";
    paragraph.textContent = message;
    body.replaceChildren(paragraph);
  }
  getCardSize() { return 5; }
}
if (!customElements.get("luma-energy-card")) customElements.define("luma-energy-card", LumaEnergyCard);
