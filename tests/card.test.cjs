const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

// Exercise the card's actual rendering without a Home Assistant server.
class Element {
  constructor(tag = "div") { this.tag = tag; this.children = []; this.style = {}; this.dataset = {}; this._text = ""; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(" "); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ""; this.children = children; }
  setAttribute() {}
}
let Card;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../luma-energy-card.js"), "utf8"), {
  HTMLElement: class {},
  customElements: {get: () => undefined, define: (_, implementation) => { Card = implementation; }},
  document: {createElement: (tag) => new Element(tag)},
  Intl, Date, Number, Math, JSON, Array, String,
});
function render(overrides = {}) {
  const body = new Element();
  const card = new Card();
  card.shadowRoot = {getElementById: () => body};
  card._renderResult({
    start: "2026-10-01", end: "2026-11-01", basis: "bill_issue",
    energy: {days: 31, present_days: 23, totals_kwh: {load: "500", pv: "300", import: "250"}},
    totals: {actual_cents: 10000, without_solar_cents: 40000, utility_bill_reduction_cents: 30000,
      loan_cents: 20000, solar_savings_cents: 10000},
    bills: [{issue_date: "2026-10-04", start: "2026-09-04", end: "2026-10-04",
      actual_cents: 10000, without_solar_cents: 40000, solar_savings_cents: 10000,
      energy: {days: 30, present_days: 30}, differences: {import: {luma_kwh: "410", eg4_kwh: "400"}},
      warnings: ["Whole-home load coverage has not been independently verified."]}],
    ...overrides,
  });
  return body;
}
function find(root, className) {
  return [root, ...root.children.flatMap((child) => find(child, className))]
    .filter((element, index, all) => all.indexOf(element) === index && element.className === className);
}

test("financial coverage and imports describe billing dates, separate from calendar coverage", () => {
  const body = render();
  const metrics = find(body, "metric").map((element) => element.textContent);
  assert(metrics.some((text) => text.includes("Bill data coverage") && text.includes("30/30 days")));
  assert(metrics.some((text) => text.includes("EG4 imports (bills)") && text.includes("400 kWh")));
  assert(body.textContent.includes("Billing dates: 2026-09-04 → 2026-10-04"));
  assert(body.textContent.includes("23/31 days recorded; separate from bill coverage"));
  assert(body.textContent.includes("Estimated utility savings"));
  assert(body.textContent.includes("$100.00 estimated after the solar loan"));
  assert(body.textContent.includes("Whole-home load coverage has not been independently verified."));
  assert(!body.textContent.includes("bills covering selected period"));
});

test("calendar view shows calendar imports and overlapping bills as references", () => {
  const body = render({basis: "calendar", totals: {}});
  const metrics = find(body, "metric").map((element) => element.textContent);
  assert(metrics.some((text) => text.includes("Calendar EG4 imports") && text.includes("250 kWh")));
  assert(metrics.some((text) => text.includes("Calendar data coverage") && text.includes("23/31 days")));
  assert(body.textContent.includes("Overlapping bill references"));
  assert.equal(find(body, "hero positive").length, 0);
  assert.equal(find(body, "ytd").length, 0);
});

test("missing bill does not invent savings while scheduled loan remains visible", () => {
  const body = render({bills: [], totals: {loan_cents: 20000}, coverage: {missing_bill_months: ["2026-10"]}});
  assert(body.textContent.includes("Complete period savings are unavailable"));
  assert(body.textContent.includes("No selected bills for: 2026-10"));
  assert(find(body, "metric").some((element) => element.textContent.includes("Monthly loan obligations") && element.textContent.includes("$200.00")));
  assert.equal(find(body, "hero-value")[0].textContent, "—");
});

test("Energy selector converts inclusive month end to the API's exclusive boundary", () => {
  const card = new Card();
  card.config = {};
  let selection;
  card._load = (value) => { selection = value; };
  card._handleSelection({start: "2026-10-01", end: "2026-10-31"});
  assert.equal(selection.start, "2026-10-01");
  assert.equal(selection.end, "2026-11-01");
  assert.equal(selection.basis, "bill_issue");
});

test("HACS card and root card remain identical", () => {
  assert.equal(fs.readFileSync(path.join(__dirname, "../luma-energy-card.js"), "utf8"),
    fs.readFileSync(path.join(__dirname, "../custom_components/luma_energy/luma-energy-card.js"), "utf8"));
});
