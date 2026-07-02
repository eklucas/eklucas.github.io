(function () {
  'use strict';

  // Capture the script tag synchronously so the widget can insert itself
  // right where it was embedded, with no container div required.
  var hostScript = document.currentScript;

  // ---- CONFIG -------------------------------------------------------
  // Everything below reflects current Missouri law (2026) and the
  // methodology decisions documented in README.md. The one block you'll
  // likely revisit is `proposedRates` — update it as your research on
  // the actual repeal-and-replace proposal progresses.
  var CONFIG = {
    standardDeduction: 16100, // MO 2026, single filer
    incomeBrackets: [
      { upTo: 1347, rate: 0 },
      { upTo: 2695, rate: 0.02 },
      { upTo: 4043, rate: 0.025 },
      { upTo: 5391, rate: 0.03 },
      { upTo: 6739, rate: 0.035 },
      { upTo: 8087, rate: 0.04 },
      { upTo: 9435, rate: 0.045 },
      { upTo: Infinity, rate: 0.047 }
    ],
    currentSalesTax: {
      groceries: 0.01225,
      clothing: 0.04225,
      entertainment: 0.04225,
      other: 0.04225
    },
    proposedGroceryRate: 0.01225, // assumes today's grocery break carries forward
    proposedRates: [0.05, 0.07, 0.09, 0.11], // update after further research
    sliders: [
      { key: 'income', label: 'Monthly income', min: 0, max: 20000, step: 100, default: 5400 },
      { key: 'groceries', label: 'Monthly grocery spending', min: 0, max: 2000, step: 25, default: 500 },
      { key: 'clothing', label: 'Monthly clothing spending', min: 0, max: 1000, step: 25, default: 150 },
      { key: 'entertainment', label: 'Monthly entertainment spending', min: 0, max: 1000, step: 25, default: 150 },
      { key: 'other', label: 'Monthly spending on everything else', min: 0, max: 5000, step: 50, default: 1500 }
    ]
  };

  // ---- Tax math -------------------------------------------------------
  function annualIncomeTax(annualIncome) {
    var taxable = Math.max(0, annualIncome - CONFIG.standardDeduction);
    var tax = 0;
    var lower = 0;
    for (var i = 0; i < CONFIG.incomeBrackets.length; i++) {
      var bracket = CONFIG.incomeBrackets[i];
      if (taxable <= lower) break;
      var upper = Math.min(taxable, bracket.upTo);
      tax += (upper - lower) * bracket.rate;
      lower = upper;
      if (bracket.upTo === Infinity) break;
    }
    return tax;
  }

  function calculate(monthly, proposedRate) {
    var annual = {
      income: monthly.income * 12,
      groceries: monthly.groceries * 12,
      clothing: monthly.clothing * 12,
      entertainment: monthly.entertainment * 12,
      other: monthly.other * 12
    };

    var currentIncomeTax = annualIncomeTax(annual.income);
    var currentSalesTax =
      annual.groceries * CONFIG.currentSalesTax.groceries +
      annual.clothing * CONFIG.currentSalesTax.clothing +
      annual.entertainment * CONFIG.currentSalesTax.entertainment +
      annual.other * CONFIG.currentSalesTax.other;

    var proposedSalesTax =
      annual.groceries * CONFIG.proposedGroceryRate +
      (annual.clothing + annual.entertainment + annual.other) * proposedRate;

    var currentTotal = currentIncomeTax + currentSalesTax;
    var proposedTotal = proposedSalesTax;

    return {
      currentIncomeTax: currentIncomeTax,
      currentSalesTax: currentSalesTax,
      currentTotal: currentTotal,
      proposedSalesTax: proposedSalesTax,
      proposedTotal: proposedTotal,
      difference: proposedTotal - currentTotal
    };
  }

  // ---- Formatting -------------------------------------------------------
  var money0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var moneyMonthly = function (annualAmount) { return money0.format(annualAmount / 12); };

  // ---- Markup -------------------------------------------------------
  var STYLE_ID = 'mo-tax-swap-style';
  var STYLE = '' +
    '.mo-tax-swap-widget{--mts-accent:#1c5f4e;--mts-bg:#ffffff;--mts-border:#d8d8d8;--mts-text:#1a1a1a;--mts-muted:#6a6a6a;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--mts-text);' +
    'max-width:480px;padding:20px;border:1px solid var(--mts-border);border-radius:12px;background:var(--mts-bg);box-sizing:border-box}' +
    '.mo-tax-swap-widget *{box-sizing:border-box}' +
    '.mo-tax-swap-field{margin-bottom:16px}' +
    '.mo-tax-swap-field label{display:flex;justify-content:space-between;font-size:14px;font-weight:600;margin-bottom:6px}' +
    '.mo-tax-swap-field output{font-weight:400;color:var(--mts-accent)}' +
    '.mo-tax-swap-widget input[type=range]{width:100%;accent-color:var(--mts-accent)}' +
    '.mo-tax-swap-rate-ticks{display:flex;justify-content:space-between;font-size:12px;color:var(--mts-muted);margin-top:4px}' +
    '.mo-tax-swap-result{margin-top:20px;padding:16px;border-radius:8px;background:#f4f6f5;text-align:center}' +
    '.mo-tax-swap-result-headline{font-size:20px;font-weight:700;line-height:1.3}' +
    '.mo-tax-swap-result-detail{margin-top:10px;font-size:13px;color:var(--mts-muted);line-height:1.5}' +
    '.mo-tax-swap-note{margin-top:14px;font-size:12px;color:var(--mts-muted);line-height:1.5}';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);
  }

  function buildWidget() {
    var root = document.createElement('div');
    root.className = 'mo-tax-swap-widget';

    var state = {};
    var fields = {};

    CONFIG.sliders.forEach(function (s) {
      state[s.key] = s.default;

      var field = document.createElement('div');
      field.className = 'mo-tax-swap-field';

      var label = document.createElement('label');
      var labelText = document.createElement('span');
      labelText.textContent = s.label;
      var out = document.createElement('output');
      out.textContent = money0.format(s.default);
      label.appendChild(labelText);
      label.appendChild(out);

      var input = document.createElement('input');
      input.type = 'range';
      input.min = s.min;
      input.max = s.max;
      input.step = s.step;
      input.value = s.default;

      input.addEventListener('input', function () {
        state[s.key] = Number(input.value);
        out.textContent = money0.format(state[s.key]);
        update();
      });

      field.appendChild(label);
      field.appendChild(input);
      root.appendChild(field);
      fields[s.key] = input;
    });

    // Proposed sales tax rate — stepped slider snapping to researched presets.
    var rateField = document.createElement('div');
    rateField.className = 'mo-tax-swap-field';

    var rateLabel = document.createElement('label');
    var rateLabelText = document.createElement('span');
    rateLabelText.textContent = 'Proposed state sales tax rate';
    var rateOut = document.createElement('output');
    var defaultRateIndex = Math.min(1, CONFIG.proposedRates.length - 1);
    rateOut.textContent = (CONFIG.proposedRates[defaultRateIndex] * 100) + '%';
    rateLabel.appendChild(rateLabelText);
    rateLabel.appendChild(rateOut);

    var rateInput = document.createElement('input');
    rateInput.type = 'range';
    rateInput.min = 0;
    rateInput.max = CONFIG.proposedRates.length - 1;
    rateInput.step = 1;
    rateInput.value = defaultRateIndex;

    var rateTicks = document.createElement('div');
    rateTicks.className = 'mo-tax-swap-rate-ticks';
    CONFIG.proposedRates.forEach(function (r) {
      var tick = document.createElement('span');
      tick.textContent = (r * 100) + '%';
      rateTicks.appendChild(tick);
    });

    var proposedRate = CONFIG.proposedRates[defaultRateIndex];
    rateInput.addEventListener('input', function () {
      proposedRate = CONFIG.proposedRates[Number(rateInput.value)];
      rateOut.textContent = (proposedRate * 100) + '%';
      update();
    });

    rateField.appendChild(rateLabel);
    rateField.appendChild(rateInput);
    rateField.appendChild(rateTicks);
    root.appendChild(rateField);

    // Result
    var result = document.createElement('div');
    result.className = 'mo-tax-swap-result';
    var headline = document.createElement('div');
    headline.className = 'mo-tax-swap-result-headline';
    var detail = document.createElement('div');
    detail.className = 'mo-tax-swap-result-detail';
    result.appendChild(headline);
    result.appendChild(detail);
    root.appendChild(result);

    var note = document.createElement('p');
    note.className = 'mo-tax-swap-note';
    note.textContent = 'Estimate reflects Missouri state-level taxes only (income tax under current law vs. a flat state sales tax under the proposal). It excludes local sales taxes, which add several more percentage points in most areas, and assumes a single tax filer. See README for full methodology.';
    root.appendChild(note);

    function update() {
      var r = calculate(state, proposedRate);
      var diff = r.difference;
      var verb = diff > 0 ? 'more' : diff < 0 ? 'less' : 'the same';
      headline.textContent = diff === 0
        ? 'About the same in state taxes either way'
        : 'About ' + money0.format(Math.abs(diff)) + ' ' + verb + ' per year in state taxes';
      detail.textContent =
        'Today: ' + money0.format(r.currentTotal) + '/yr (' + moneyMonthly(r.currentTotal) + '/mo) — ' +
        money0.format(r.currentIncomeTax) + ' income tax + ' + money0.format(r.currentSalesTax) + ' sales tax. ' +
        'Proposed: ' + money0.format(r.proposedTotal) + '/yr (' + moneyMonthly(r.proposedTotal) + '/mo) — sales tax only.';
    }

    update();
    return root;
  }

  ensureStyle();
  var widget = buildWidget();
  if (hostScript && hostScript.parentNode) {
    hostScript.parentNode.insertBefore(widget, hostScript);
  } else {
    document.currentScript ? document.currentScript.parentNode.insertBefore(widget, document.currentScript) : document.body.appendChild(widget);
  }
})();
