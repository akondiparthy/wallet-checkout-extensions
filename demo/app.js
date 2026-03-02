const STATE_FLOW = [
  "INIT",
  "WALLET_READY",
  "EXTENSION_EVALUATION",
  "EXTENSION_RENDER",
  "USER_CONFIRM",
  "AUTHORIZATION",
  "SUCCESS/FAILURE",
  "POST_PURCHASE_EXTENSIONS",
];

const PHASES = {
  PRE_CONFIRMATION: "pre_confirmation",
  FUNDING_SELECTION: "funding_selection",
  PRE_AUTHORIZATION: "pre_authorization",
  POST_PURCHASE: "post_purchase",
  ALL: "all_states",
};

const store = {
  state: "INIT",
  region: "US",
  selectedFunding: "Wallet Balance",
  extensionDelayMs: 80,
  forceAuthFailure: false,
  killSwitches: {
    offer_extension: false,
    payment_logic_extension: false,
    identity_eligibility_extension: false,
    post_purchase_extension: false,
  },
  runId: 0,
  logs: [],
  analyticsEvents: [],
  rendered: {
    pre: [],
    post: [],
  },
};

const extensionRegistry = [
  {
    id: "ext.offer.loyalty",
    type: "offer_extension",
    name: "Wallet Points Offer",
    approved: true,
    timeoutMs: 120,
    allowedRegions: ["US", "EU"],
    phase: PHASES.PRE_CONFIRMATION,
    permissions: ["cart.total_minor", "wallet.points_balance", "offer_selection"],
    payload: {
      headline: "Redeem 500 points for $5.00 off",
      subtext: "Display-only in this simulation. Total cannot be mutated by extension.",
    },
    merchantProposal: {
      attemptMutateTotal: true,
      proposedTotalMinor: 8499,
      customHtml: "<div class='flash-sale'>Only 10 seconds left</div>",
    },
  },
  {
    id: "ext.payment.bnpl_preview",
    type: "payment_logic_extension",
    name: "Installment Preview",
    approved: true,
    timeoutMs: 140,
    allowedRegions: ["US", "EU"],
    phase: PHASES.FUNDING_SELECTION,
    permissions: ["cart.total_minor", "funding_source.type"],
    payload: {
      ruleText: "If card is selected, show estimated 4 x $22.50 installment preview.",
    },
  },
  {
    id: "ext.identity.age_gating",
    type: "identity_eligibility_extension",
    name: "Age & Region Eligibility",
    approved: true,
    timeoutMs: 90,
    allowedRegions: ["US"],
    phase: PHASES.PRE_AUTHORIZATION,
    permissions: ["shipping.country_code", "user.age_over_21.boolean"],
    payload: {
      question: "Confirm this order contains age-restricted items (21+).",
      simulatedUserAnswer: true,
    },
  },
  {
    id: "ext.post.warranty",
    type: "post_purchase_extension",
    name: "Warranty Enrollment",
    approved: true,
    timeoutMs: 150,
    allowedRegions: ["US", "EU"],
    phase: PHASES.POST_PURCHASE,
    permissions: ["order.id", "order.total_minor"],
    payload: {
      headline: "Add 1-year accidental damage coverage for $6.99",
      subtext: "Optional and deferred. Does not change original authorization.",
    },
  },
  {
    id: "ext.analytics.standard",
    type: "analytics_hook",
    name: "Funnel Analytics Hook",
    approved: true,
    timeoutMs: 100,
    allowedRegions: ["US", "EU"],
    phase: PHASES.ALL,
    permissions: ["event.name", "event.phase", "event.timestamp"],
    payload: {
      stream: "wallet_checkout_v1",
    },
  },
];

const elements = {
  startBtn: document.getElementById("start-checkout-btn"),
  resetBtn: document.getElementById("reset-btn"),
  confirmBtn: document.getElementById("confirm-btn"),
  stateTrack: document.getElementById("state-track"),
  extensionSlots: document.getElementById("extension-slots"),
  postPurchaseSlots: document.getElementById("post-purchase-slots"),
  postPurchaseBlock: document.getElementById("post-purchase-block"),
  regionSelect: document.getElementById("region-select"),
  regionBadge: document.getElementById("region-badge"),
  delayInput: document.getElementById("delay-input"),
  authFailToggle: document.getElementById("auth-fail-toggle"),
  fundingOptions: document.getElementById("funding-options"),
  logList: document.getElementById("log-list"),
  confirmationNote: document.getElementById("confirmation-note"),
};

function logEvent(level, area, message) {
  const timestamp = new Date().toLocaleTimeString();
  const entry = { timestamp, level, area, message };
  store.logs.unshift(entry);
  renderLogs();
}

function pushAnalytics(eventName, phase) {
  const event = {
    eventName,
    phase,
    timestamp: Date.now(),
    noPii: true,
  };
  store.analyticsEvents.push(event);
  logEvent("ok", "analytics_hook", `${eventName} (${phase})`);
}

function transitionTo(nextState) {
  store.state = nextState;
  renderStateTrack();
  pushAnalytics("state_transition", nextState);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function policyCheck(extension) {
  if (!extension.approved) {
    return { allowed: false, reason: "not_approved" };
  }

  if (store.killSwitches[extension.type]) {
    return { allowed: false, reason: "kill_switch_active" };
  }

  if (!extension.allowedRegions.includes(store.region)) {
    return { allowed: false, reason: "region_blocked" };
  }

  return { allowed: true };
}

function classifyType(type) {
  if (type === "offer_extension") return "Offer Extension";
  if (type === "payment_logic_extension") return "Payment Logic Extension";
  if (type === "identity_eligibility_extension") return "Identity / Eligibility Extension";
  if (type === "post_purchase_extension") return "Post-Purchase Extension";
  if (type === "analytics_hook") return "Analytics Hook";
  return type;
}

function renderExtensionCard(extension, status, details, intoPostArea = false) {
  const host = intoPostArea ? elements.postPurchaseSlots : elements.extensionSlots;
  const card = document.createElement("article");
  card.className = "extension-card";

  const title = document.createElement("h4");
  title.textContent = `${classifyType(extension.type)}: ${extension.name}`;
  card.appendChild(title);

  const detailLine = document.createElement("p");
  detailLine.textContent = details;
  card.appendChild(detailLine);

  const statusLine = document.createElement("p");
  statusLine.className = `status ${status}`;
  if (status === "ok") statusLine.textContent = "Rendered by wallet";
  if (status === "warn") statusLine.textContent = "Skipped with deterministic fallback";
  if (status === "bad") statusLine.textContent = "Denied by policy";
  card.appendChild(statusLine);

  host.appendChild(card);
}

function renderFundingOptions() {
  elements.fundingOptions.innerHTML = "";
  const options = ["Wallet Balance", "Card", "Bank"];
  options.forEach((name) => {
    const button = document.createElement("button");
    button.className = `funding-option${store.selectedFunding === name ? " active" : ""}`;
    button.textContent = name;
    button.type = "button";
    button.addEventListener("click", () => {
      store.selectedFunding = name;
      renderFundingOptions();
      logEvent("ok", "wallet", `Funding selected: ${name}`);
      pushAnalytics("funding_selected", PHASES.FUNDING_SELECTION);
    });
    elements.fundingOptions.appendChild(button);
  });
}

function renderStateTrack() {
  elements.stateTrack.innerHTML = "";
  const stateIndex = STATE_FLOW.indexOf(store.state);
  STATE_FLOW.forEach((name, index) => {
    const node = document.createElement("div");
    node.className = "state-pill";
    if (index < stateIndex) node.classList.add("done");
    if (index === stateIndex) node.classList.add("active");
    node.textContent = name;
    elements.stateTrack.appendChild(node);
  });
}

function renderLogs() {
  elements.logList.innerHTML = "";
  store.logs.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "log-item";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${entry.timestamp} | ${entry.area}`;
    item.appendChild(meta);

    const message = document.createElement("div");
    message.className = entry.level;
    message.textContent = entry.message;
    item.appendChild(message);
    elements.logList.appendChild(item);
  });
}

function clearExtensionUIs() {
  elements.extensionSlots.innerHTML = "";
  elements.postPurchaseSlots.innerHTML = "";
  elements.postPurchaseBlock.style.display = "none";
}

async function evaluateExtension(extension, targetPhase, opts = {}) {
  if (extension.phase !== targetPhase && extension.phase !== PHASES.ALL) return;

  const policy = policyCheck(extension);
  if (!policy.allowed) {
    logEvent("bad", extension.type, `${extension.id} denied: ${policy.reason}`);
    if (extension.type !== "analytics_hook") {
      renderExtensionCard(extension, "bad", `Denied (${policy.reason})`, opts.intoPostArea);
    }
    pushAnalytics("extension_denied", targetPhase);
    return;
  }

  await sleep(store.extensionDelayMs);

  if (store.extensionDelayMs > extension.timeoutMs) {
    logEvent("warn", extension.type, `${extension.id} timed out (${extension.timeoutMs}ms budget)`);
    if (extension.type !== "analytics_hook") {
      renderExtensionCard(extension, "warn", "Timed out; fallback to wallet default", opts.intoPostArea);
    }
    pushAnalytics("extension_timeout", targetPhase);
    return;
  }

  if (extension.type === "analytics_hook") {
    pushAnalytics("extension_hook_fired", targetPhase);
    return;
  }

  if (extension.type === "offer_extension" && extension.merchantProposal?.attemptMutateTotal) {
    logEvent("warn", extension.type, `${extension.id} attempted total mutation; wallet ignored`);
  }

  if (extension.merchantProposal?.customHtml) {
    logEvent("bad", extension.type, `${extension.id} attempted custom HTML injection; wallet denied`);
  }

  if (extension.type === "payment_logic_extension") {
    const funding = store.selectedFunding;
    const explanation =
      funding === "Card"
        ? "Preview: 4 x $22.50 over 6 weeks (explanatory only)"
        : "No installment preview for selected funding source";
    renderExtensionCard(extension, "ok", explanation);
    logEvent("ok", extension.type, `${extension.id} rendered as explanatory copy`);
    pushAnalytics("extension_rendered", targetPhase);
    return;
  }

  if (extension.type === "identity_eligibility_extension") {
    const eligible = extension.payload.simulatedUserAnswer === true && store.region === "US";
    const detail = eligible
      ? "Eligibility signal returned: true"
      : "Eligibility signal returned: false";
    renderExtensionCard(extension, eligible ? "ok" : "warn", detail);
    logEvent(eligible ? "ok" : "warn", extension.type, `${extension.id} completed`);
    pushAnalytics("extension_rendered", targetPhase);
    return;
  }

  if (extension.type === "post_purchase_extension") {
    renderExtensionCard(extension, "ok", extension.payload.headline, true);
    logEvent("ok", extension.type, `${extension.id} rendered asynchronously`);
    pushAnalytics("extension_rendered", targetPhase);
    return;
  }

  renderExtensionCard(extension, "ok", extension.payload.headline || "Rendered declarative payload");
  logEvent("ok", extension.type, `${extension.id} rendered`);
  pushAnalytics("extension_rendered", targetPhase);
}

async function evaluatePhase(phase, opts = {}) {
  const extensions = extensionRegistry.filter((ext) => ext.phase === phase || ext.phase === PHASES.ALL);
  for (const extension of extensions) {
    // sequential runtime to make logs deterministic for demonstration purposes
    await evaluateExtension(extension, phase, opts);
  }
}

async function startCheckout() {
  const runId = Date.now();
  store.runId = runId;
  clearExtensionUIs();
  elements.confirmBtn.disabled = true;

  transitionTo("INIT");
  logEvent("ok", "wallet", "Checkout initialized");

  await sleep(120);
  if (store.runId !== runId) return;
  transitionTo("WALLET_READY");

  await sleep(120);
  if (store.runId !== runId) return;
  transitionTo("EXTENSION_EVALUATION");
  await evaluatePhase(PHASES.PRE_CONFIRMATION);
  await evaluatePhase(PHASES.FUNDING_SELECTION);

  if (store.runId !== runId) return;
  transitionTo("EXTENSION_RENDER");
  elements.confirmBtn.disabled = false;
  elements.confirmationNote.textContent =
    "Extensions were evaluated. Confirmation remains available even when extensions fail.";

  await sleep(100);
  if (store.runId !== runId) return;
  transitionTo("USER_CONFIRM");
}

async function confirmPurchase() {
  if (store.state !== "USER_CONFIRM") {
    logEvent("warn", "wallet", "Confirm clicked outside USER_CONFIRM state");
    return;
  }

  transitionTo("AUTHORIZATION");
  elements.confirmBtn.disabled = true;
  await evaluatePhase(PHASES.PRE_AUTHORIZATION);

  await sleep(260);
  const authSuccess = !store.forceAuthFailure;
  transitionTo("SUCCESS/FAILURE");
  if (!authSuccess) {
    logEvent("bad", "authorization", "Authorization failed (forced toggle)");
    elements.confirmationNote.textContent = "Authorization failed. Reset and retry.";
    return;
  }

  logEvent("ok", "authorization", "Authorization succeeded");
  transitionTo("POST_PURCHASE_EXTENSIONS");
  elements.postPurchaseBlock.style.display = "block";
  await evaluatePhase(PHASES.POST_PURCHASE, { intoPostArea: true });
  elements.confirmationNote.textContent =
    "Success. Post-purchase extensions ran asynchronously without affecting authorization.";
}

function resetSimulator() {
  store.runId = Date.now();
  store.logs = [];
  store.analyticsEvents = [];
  store.state = "INIT";
  elements.confirmBtn.disabled = true;
  elements.confirmationNote.textContent = "Start checkout to evaluate extensions.";
  clearExtensionUIs();
  renderLogs();
  renderStateTrack();
  renderFundingOptions();
  logEvent("ok", "wallet", "Simulator reset");
}

function bindControls() {
  elements.startBtn.addEventListener("click", () => {
    startCheckout().catch((error) => {
      logEvent("bad", "runtime", `Unhandled start error: ${String(error)}`);
    });
  });

  elements.resetBtn.addEventListener("click", resetSimulator);

  elements.confirmBtn.addEventListener("click", () => {
    confirmPurchase().catch((error) => {
      logEvent("bad", "runtime", `Unhandled confirm error: ${String(error)}`);
    });
  });

  elements.regionSelect.addEventListener("change", (event) => {
    store.region = event.target.value;
    elements.regionBadge.textContent = store.region;
    logEvent("ok", "policy", `Region set to ${store.region}`);
  });

  elements.delayInput.addEventListener("change", (event) => {
    const parsed = Number(event.target.value);
    store.extensionDelayMs = Number.isFinite(parsed) && parsed >= 0 ? parsed : 80;
    event.target.value = String(store.extensionDelayMs);
    logEvent("ok", "policy", `Extension delay set to ${store.extensionDelayMs}ms`);
  });

  elements.authFailToggle.addEventListener("change", (event) => {
    store.forceAuthFailure = event.target.checked;
    logEvent("ok", "policy", `Force auth failure: ${store.forceAuthFailure}`);
  });

  document.querySelectorAll("[data-kill-switch]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const key = event.target.getAttribute("data-kill-switch");
      store.killSwitches[key] = event.target.checked;
      logEvent("warn", "policy", `Kill switch ${key}: ${store.killSwitches[key]}`);
    });
  });
}

function init() {
  bindControls();
  renderFundingOptions();
  renderStateTrack();
  logEvent("ok", "wallet", "Simulator ready");
}

init();
