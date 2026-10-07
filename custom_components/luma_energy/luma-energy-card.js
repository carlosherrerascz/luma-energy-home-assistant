class LumaEnergyCard extends HTMLElement {
  setConfig(config) {
    this.config = config;
    this._revision = 0;
    this._collectionUnsubscribes = [];
    this._collectionRetry = null;
    this._lastSelection = null;
    this._connected = false;
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --luma-green: #38c793;
          --luma-green-dark: #0b7656;
          --luma-purple: #9074ff;
          --luma-gold: #f2b84b;
          --luma-blue: #5aa9ff;
        }
        ha-card { overflow: hidden; }
        .card { padding: 18px; }
        .title-row { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
        .eyebrow { color:var(--secondary-text-color); font-size:.72rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }
        h2 { font-size:1.45rem; margin:3px 0 0; }
        .title-icon { --mdc-icon-size:30px; color:var(--luma-gold); background:color-mix(in srgb, var(--luma-gold) 16%, transparent); border-radius:50%; padding:10px; }
        .period { display:flex; flex-wrap:wrap; gap:7px; margin:0 0 12px; }
        .pill { background:var(--secondary-background-color); border:1px solid var(--divider-color); border-radius:999px; color:var(--secondary-text-color); font-size:.78rem; padding:5px 9px; }
        .hero { border-radius:22px; color:white; margin-bottom:12px; overflow:hidden; padding:20px; position:relative; }
        .hero::after { background:radial-gradient(circle,rgba(255,255,255,.22),transparent 66%); content:""; height:190px; position:absolute; right:-60px; top:-95px; width:190px; }
        .hero.positive { background:linear-gradient(135deg,var(--luma-green-dark),var(--luma-green)); }
        .hero.negative { background:linear-gradient(135deg,#8f3041,#e45d70); }
        .hero.neutral { background:linear-gradient(135deg,#405066,#6f8098); }
        .hero-label { font-size:.82rem; font-weight:650; opacity:.84; }
        .hero-value { font-size:clamp(2.1rem,10vw,3.5rem); font-weight:750; letter-spacing:-.045em; line-height:1.04; margin:5px 0; }
        .hero-sub { font-size:.82rem; opacity:.86; }
        .metrics { display:grid; gap:9px; grid-template-columns:repeat(2,minmax(0,1fr)); }
        .metric { background:var(--secondary-background-color); border:1px solid color-mix(in srgb,var(--divider-color) 76%,transparent); border-radius:16px; min-width:0; padding:12px; }
        .metric-head { align-items:center; color:var(--secondary-text-color); display:flex; font-size:.75rem; gap:6px; min-width:0; }
        .metric-head ha-icon { --mdc-icon-size:17px; flex:none; }
        .metric[data-tone="green"] .metric-head ha-icon { color:var(--luma-green); }
        .metric[data-tone="purple"] .metric-head ha-icon { color:var(--luma-purple); }
        .metric[data-tone="gold"] .metric-head ha-icon { color:var(--luma-gold); }
        .metric[data-tone="blue"] .metric-head ha-icon { color:var(--luma-blue); }
        .metric-value { font-size:1.12rem; font-weight:700; margin-top:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .section { margin-top:18px; }
        .section-title { align-items:center; display:flex; font-size:1rem; justify-content:space-between; margin:0 0 10px; }
        .trend { display:grid; gap:10px; }
        .trend-row { align-items:center; display:grid; gap:8px; grid-template-columns:62px minmax(0,1fr) auto; }
        .trend-label,.trend-value { color:var(--secondary-text-color); font-size:.74rem; }
        .trend-value { color:var(--primary-text-color); font-weight:650; }
        .trend-track { background:color-mix(in srgb,var(--luma-green) 13%,var(--secondary-background-color)); border-radius:999px; height:10px; overflow:hidden; }
        .trend-bar { background:linear-gradient(90deg,var(--luma-green-dark),var(--luma-green)); border-radius:inherit; height:100%; min-width:4px; }
        .trend-bar.negative { background:linear-gradient(90deg,#96394a,#e45d70); }
        details { border-top:1px solid var(--divider-color); margin-top:16px; padding-top:12px; }
        summary { cursor:pointer; font-weight:650; }
        .bill-list { display:grid; gap:10px; margin-top:12px; }
        .bill { background:var(--secondary-background-color); border:1px solid var(--divider-color); border-radius:16px; padding:13px; }
        .bill-head { align-items:flex-start; display:flex; gap:8px; justify-content:space-between; }
        .bill-title { font-weight:700; }
        .bill-coverage { color:var(--secondary-text-color); font-size:.75rem; margin-top:2px; }
        .confidence { background:color-mix(in srgb,var(--luma-blue) 15%,transparent); border-radius:999px; color:var(--luma-blue); font-size:.68rem; font-weight:700; padding:4px 7px; text-transform:capitalize; }
        .bill-grid { display:grid; gap:8px; grid-template-columns:repeat(2,minmax(0,1fr)); margin-top:12px; }
        .bill-label { color:var(--secondary-text-color); font-size:.68rem; }
        .bill-value { font-size:.88rem; font-weight:650; margin-top:2px; }
        .imports { color:var(--secondary-text-color); display:flex; flex-wrap:wrap; font-size:.72rem; gap:8px 14px; margin-top:11px; }
        .note { color:var(--secondary-text-color); font-size:.78rem; line-height:1.45; margin:14px 2px 0; }
        .calculation pre { background:var(--secondary-background-color); border-radius:12px; font-size:.68rem; max-height:260px; overflow:auto; padding:10px; white-space:pre-wrap; }
        .message { color:var(--secondary-text-color); margin:8px 0 2px; }
        .error { color:var(--error-color); }
        @media (min-width:700px) {
          .metrics { grid-template-columns:repeat(3,minmax(0,1fr)); }
          .bill-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }
        }
      </style>
      <ha-card>
        <div class="card">
          <div class="title-row">
            <div><div class="eyebrow">LUMA + LuxPower</div><h2>Energy report</h2></div>
            <ha-icon class="title-icon" icon="mdi:solar-power-variant"></ha-icon>
          </div>
          <div id="body" class="message">Loading…</div>
        </div>
      </ha-card>`;
    this._onPeriod = (event) => this._load(event.detail || {});
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
    if (!this.config.period_start || !this.config.period_end) this._subscribeToEnergyCollection();
  }

  connectedCallback() {
    this._connected = true;
    window.removeEventListener(this.config.selector_event || "luma-energy-period-changed", this._onPeriod);
    window.addEventListener(this.config.selector_event || "luma-energy-period-changed", this._onPeriod);
    if (this._hass && (!this.config.period_start || !this.config.period_end)) this._subscribeToEnergyCollection();
  }

  disconnectedCallback() {
    this._connected = false;
    if (this._onPeriod) window.removeEventListener(this.config.selector_event || "luma-energy-period-changed", this._onPeriod);
    if (this._timer) clearTimeout(this._timer);
    if (this._collectionRetry) {
      clearTimeout(this._collectionRetry);
      this._collectionRetry = null;
    }
    for (const unsubscribe of this._collectionUnsubscribes) unsubscribe();
    this._collectionUnsubscribes = [];
  }

  _subscribeToEnergyCollection() {
    if (!this._connected || this._collectionUnsubscribes.length || !this._hass?.connection) return;
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
      this._collectionRetry = null;
      const current = collection.state?.start && collection.state?.end
        ? collection.state
        : collection.start && collection.end
          ? { start: collection.start, end: collection.end }
          : null;
      if (current) this._handleSelection(current);
    }
    if (!subscribed) {
      if (this._collectionRetry) clearTimeout(this._collectionRetry);
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
    const savings = t.utility_bill_reduction_cents ?? (
      t.without_solar_cents != null && t.actual_cents != null
        ? Number(t.without_solar_cents) - Number(t.actual_cents)
        : null
    );
    const metrics = [
      {label:"Actual bill", value:money(t.actual_cents), icon:"mdi:receipt-text-outline", tone:"purple"},
      {label:"Without solar", value:money(t.without_solar_cents), icon:"mdi:transmission-tower-import", tone:"gold"},
      {label:"Loan payment", value:money(t.loan_cents), icon:"mdi:bank-outline", tone:"blue"},
      {label:"LUMA imports", value:kwh(sumImports("luma_kwh")), icon:"mdi:meter-electric-outline", tone:"purple"},
      {label:"EG4 imports", value:kwh(sumImports("eg4_kwh")), icon:"mdi:solar-power", tone:"green"},
      {label:"Data coverage", value:energy.days == null ? "—" : `${energy.present_days || 0}/${energy.days} days`, icon:"mdi:calendar-check-outline", tone:"blue"},
    ];
    const body = this.shadowRoot?.getElementById("body");
    if (!body) return;
    body.className = "";
    body.replaceChildren();
    const period = document.createElement("div");
    period.className = "period";
    for (const text of [periodLabel, basisLabel]) {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = text;
      period.append(pill);
    }
    body.append(period);

    const hero = document.createElement("section");
    hero.className = `hero ${savings == null ? "neutral" : Number(savings) >= 0 ? "positive" : "negative"}`;
    const heroLabel = document.createElement("div");
    heroLabel.className = "hero-label";
    heroLabel.textContent = savings == null
      ? "Solar savings"
      : Number(savings) >= 0 ? "Saved with solar" : "Solar impact";
    const heroValue = document.createElement("div");
    heroValue.className = "hero-value";
    heroValue.textContent = money(savings);
    const heroSub = document.createElement("div");
    heroSub.className = "hero-sub";
    heroSub.textContent = t.solar_savings_cents == null
      ? "Loan-adjusted savings unavailable"
      : `${money(t.solar_savings_cents)} after the solar loan`;
    hero.append(heroLabel, heroValue, heroSub);
    body.append(hero);

    const grid = document.createElement("section");
    grid.className = "metrics";
    for (const item of metrics) {
      const metric = document.createElement("div");
      metric.className = "metric";
      metric.dataset.tone = item.tone;
      const head = document.createElement("div");
      head.className = "metric-head";
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", item.icon);
      const labelElement = document.createElement("span");
      labelElement.textContent = item.label;
      head.append(icon, labelElement);
      const valueElement = document.createElement("div");
      valueElement.className = "metric-value";
      valueElement.textContent = item.value;
      metric.append(head, valueElement);
      grid.append(metric);
    }
    body.append(grid);

    if (comparisons.length > 1) {
      const section = document.createElement("section");
      section.className = "section";
      const heading = document.createElement("h3");
      heading.className = "section-title";
      heading.textContent = "Savings over time";
      section.append(heading);
      const trend = document.createElement("div");
      trend.className = "trend";
      const points = comparisons.map((bill) => ({
        label: (bill.issue_date || "Bill").slice(0, 7),
        value: Number(
          bill.utility_bill_reduction_cents ??
          (bill.without_solar_cents != null && bill.actual_cents != null
            ? Number(bill.without_solar_cents) - Number(bill.actual_cents)
            : bill.solar_savings_cents || 0)
        ),
      }));
      const maximum = Math.max(...points.map((point) => Math.abs(point.value)), 1);
      for (const point of points) {
        const row = document.createElement("div");
        row.className = "trend-row";
        const label = document.createElement("span");
        label.className = "trend-label";
        label.textContent = point.label;
        const track = document.createElement("div");
        track.className = "trend-track";
        const bar = document.createElement("div");
        bar.className = `trend-bar${point.value < 0 ? " negative" : ""}`;
        bar.style.width = `${Math.max(3, Math.abs(point.value) / maximum * 100)}%`;
        track.append(bar);
        const value = document.createElement("span");
        value.className = "trend-value";
        value.textContent = money(point.value);
        row.append(label, track, value);
        trend.append(row);
      }
      section.append(trend);
      body.append(section);
    }

    if (comparisons.length) {
      const history = document.createElement("details");
      history.className = "bill-history";
      history.open = comparisons.length <= 2;
      const historySummary = document.createElement("summary");
      historySummary.textContent = `Bill history (${comparisons.length})`;
      history.append(historySummary);
      const bills = document.createElement("div");
      bills.className = "bill-list";
      for (const bill of comparisons) {
        const billCard = document.createElement("article");
        billCard.className = "bill";
        const billHead = document.createElement("div");
        billHead.className = "bill-head";
        const billIdentity = document.createElement("div");
        const billTitle = document.createElement("div");
        billTitle.className = "bill-title";
        billTitle.textContent = bill.issue_date || "LUMA bill";
        const coverage = document.createElement("div");
        coverage.className = "bill-coverage";
        coverage.textContent = `${bill.start || "—"} → ${bill.end || "—"}`;
        billIdentity.append(billTitle, coverage);
        const confidence = document.createElement("span");
        confidence.className = "confidence";
        confidence.textContent = bill.confidence || "unknown";
        billHead.append(billIdentity, confidence);
        billCard.append(billHead);

        const billGrid = document.createElement("div");
        billGrid.className = "bill-grid";
        const billSavings = bill.utility_bill_reduction_cents ?? (
          bill.without_solar_cents != null && bill.actual_cents != null
            ? Number(bill.without_solar_cents) - Number(bill.actual_cents)
            : null
        );
        for (const [label, value] of [
          ["Actual", money(bill.actual_cents)],
          ["Without solar", money(bill.without_solar_cents)],
          ["Solar saved", money(billSavings)],
          ["After loan", money(bill.solar_savings_cents)],
        ]) {
          const item = document.createElement("div");
          const itemLabel = document.createElement("div");
          itemLabel.className = "bill-label";
          itemLabel.textContent = label;
          const itemValue = document.createElement("div");
          itemValue.className = "bill-value";
          itemValue.textContent = value;
          item.append(itemLabel, itemValue);
          billGrid.append(item);
        }
        billCard.append(billGrid);
        const imports = document.createElement("div");
        imports.className = "imports";
        const lumaImport = document.createElement("span");
        lumaImport.textContent = `LUMA ${kwh(bill.differences?.import?.luma_kwh)}`;
        const eg4Import = document.createElement("span");
        eg4Import.textContent = `EG4 ${kwh(bill.differences?.import?.eg4_kwh)}`;
        imports.append(lumaImport, eg4Import);
        billCard.append(imports);
        bills.append(billCard);
      }
      history.append(bills);
      body.append(history);
    }
    const note = document.createElement("p");
    note.className = "note";
    const missingDays = Object.values(data.energy?.missing_days || {}).reduce((max, value) => Math.max(max, Number(value) || 0), 0);
    note.textContent = data.billing_note || (comparisons.length ? "" : "No LUMA bills cover this selection; energy totals are shown for the selected period.");
    if (missingDays) note.textContent += `${note.textContent ? " " : ""}Energy coverage is incomplete: ${missingDays} day${missingDays === 1 ? "" : "s"} are missing.`;
    if (note.textContent) body.append(note);
    const details = document.createElement("details");
    details.className = "calculation";
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
    body.className = "message";
    paragraph.className = error ? "error" : "";
    paragraph.textContent = message;
    body.replaceChildren(paragraph);
  }
  getCardSize() { return 5; }
}
if (!customElements.get("luma-energy-card")) customElements.define("luma-energy-card", LumaEnergyCard);
