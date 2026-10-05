class LumaEnergyCard extends HTMLElement {
  setConfig(config) {
    this.config = config;
    this._revision = 0;
    this._collectionUnsubscribes = [];
    this._collectionRetry = null;
    this._lastSelection = null;
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>:host{display:block}.card{padding:16px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.label{color:var(--secondary-text-color);font-size:.85em}.value{font-size:1.2em}table{border-collapse:collapse;margin-top:16px;width:100%}th,td{border-bottom:1px solid var(--divider-color);padding:6px 4px;text-align:left}th{color:var(--secondary-text-color);font-size:.85em}details{margin-top:12px}.error{color:var(--error-color)}</style><ha-card><div class="card"><h2>LUMA Energy</h2><div id="body">Loading…</div></div></ha-card>`;
    this._onPeriod = (event) => this._load(event.detail || {});
    window.addEventListener(config.selector_event || "luma-energy-period-changed", this._onPeriod);
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._loaded) {
      this._loaded = true;
      if (this.config.period_start && this.config.period_end) {
        this._load(this.config);
      } else {
        this._renderMessage("Waiting for the Energy Dashboard period.");
        this._subscribeToEnergyCollection();
      }
    }
  }

  disconnectedCallback() {
    if (this._onPeriod) window.removeEventListener(this.config.selector_event || "luma-energy-period-changed", this._onPeriod);
    if (this._timer) clearTimeout(this._timer);
    if (this._collectionRetry) clearTimeout(this._collectionRetry);
    for (const unsubscribe of this._collectionUnsubscribes) unsubscribe();
    this._collectionUnsubscribes = [];
  }

  _subscribeToEnergyCollection() {
    if (this._collectionUnsubscribes.length || !this._hass?.connection) return;
    const configuredKey = this.config.collection_key || "energy_dashboard";
    const candidateKeys = this._hass.panelUrl && configuredKey === "energy_dashboard" ? [`energy_${this._hass.panelUrl}`, configuredKey] : [configuredKey];
    if (this._hass.panelUrl && !candidateKeys.includes(`energy_${this._hass.panelUrl}`)) candidateKeys.push(`energy_${this._hass.panelUrl}`);
    candidateKeys.push("energy");
    const collectionKey = candidateKeys.find((key, index) => {
      const collection = this._hass.connection[`_${key}`];
      return candidateKeys.indexOf(key) === index && typeof collection?.subscribe === "function";
    });
    const collection = collectionKey ? this._hass.connection[`_${collectionKey}`] : null;
    let subscribed = false;
    if (collection && typeof collection.subscribe === "function") {
      subscribed = true;
      this._collectionUnsubscribes.push(collection.subscribe((data) => this._handleSelection(data)));
    }
    if (!subscribed) {
      this._collectionRetry = setTimeout(() => this._subscribeToEnergyCollection(), 500);
    }
  }

  _handleSelection(data) {
    if (!data?.start || !data?.end) return;
    const start = this._formatDate(data.start);
    // The Energy selector's end date is inclusive; the LUMA API uses [start, end).
    const end = this._shiftDate(this._formatDate(data.end), 1);
    const selection = `${start}|${end}`;
    if (selection === this._lastSelection) return;
    this._lastSelection = selection;
    this._load({ start, end, basis: this.config.basis || "bill_issue" });
  }

  _formatDate(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    const pad = (part) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  _shiftDate(value, days) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    const pad = (part) => String(part).padStart(2, "0");
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }

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
    const energy = data.energy || {};
    const comparisons = Array.isArray(data.bills) ? data.bills : [];
    const kwh = (value) => value == null ? "—" : `${Number(value).toLocaleString(undefined, {maximumFractionDigits: 2})} kWh`;
    const inclusiveEnd = data.end ? this._shiftDate(data.end, -1) : null;
    const periodLabel = data.start && inclusiveEnd ? `${data.start} → ${inclusiveEnd}` : "Selected period unavailable";
    const basisLabel = data.basis === "calendar" ? "calendar energy" : "bills covering selected period";
    const sumImports = (source) => comparisons.length ? comparisons.reduce((sum, bill) => sum + Number(bill.differences?.import?.[source] || 0), 0) : null;
    const lines = [["Actual charges",money(t.actual_cents)],["Without solar",money(t.without_solar_cents)],["Solar savings",money(t.utility_bill_reduction_cents)],["Loan payment",money(t.loan_cents)],["Savings after loan",money(t.solar_savings_cents)],["LUMA imports",kwh(sumImports("luma_kwh"))],["EG4 imports",kwh(sumImports("eg4_kwh"))],["Energy coverage",energy.days == null ? "—" : `${energy.present_days || 0}/${energy.days} days`]];
    const body = this.shadowRoot?.getElementById("body");
    if (!body) return;
    body.replaceChildren();
    const period = document.createElement("p");
    period.textContent = `${periodLabel} · ${basisLabel}`;
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
    if (comparisons.length) {
      const heading = document.createElement("h3");
      heading.textContent = "Bill history";
      body.append(heading);
      const table = document.createElement("table");
      const header = document.createElement("tr");
      for (const label of ["Issued", "Coverage", "LUMA import", "EG4 import", "Actual", "After loan", "Confidence"]) {
        const cell = document.createElement("th");
        cell.textContent = label;
        header.append(cell);
      }
      const thead = document.createElement("thead");
      thead.append(header);
      table.append(thead);
      const rows = document.createElement("tbody");
      for (const bill of comparisons) {
        const row = document.createElement("tr");
        for (const value of [bill.issue_date || "—", `${bill.start || "—"} → ${bill.end || "—"}`, kwh(bill.differences?.import?.luma_kwh), kwh(bill.differences?.import?.eg4_kwh), money(bill.actual_cents), money(bill.solar_savings_cents), bill.confidence || "—"]) {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        }
        rows.append(row);
      }
      table.append(rows);
      body.append(table);
    }
    const note = document.createElement("p");
    const missingDays = Object.values(data.energy?.missing_days || {}).reduce((max, value) => Math.max(max, Number(value) || 0), 0);
    note.textContent = data.billing_note || (comparisons.length ? "" : "No LUMA bills cover this selection; energy totals are shown for the selected period.");
    if (missingDays) note.textContent += `${note.textContent ? " " : ""}Energy coverage is incomplete: ${missingDays} day${missingDays === 1 ? "" : "s"} are missing.`;
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
