"use strict";

const $ = (selector) => document.querySelector(selector);
const ICONS = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  scan: '<path d="M4 8V4h4m8 0h4v4M4 16v4h4m8 0h4v-4M7 12h10"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8l10-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  book: '<path d="M12 5v15m0-15C8 2 3 4 3 4v14s5-2 9 2c4-4 9-2 9-2V4s-5-2-9 1Z"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  shield: '<path d="M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
  text: '<path d="M4 5h16M12 5v15M8 20h8"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  crosshair: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  mixed: '<path d="m7 4 10 16M7 20 17 4M3 12h4m10 0h4"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 4m0 4v.1"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  settings: '<path d="m9 3-1 3-3 1v4l-2 1 2 1v4l3 1 1 3h6l1-3 3-1v-4l2-1-2-1V7l-3-1-1-3H9Z"/><circle cx="12" cy="12" r="3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
  edit: '<path d="m15 3 6 6-12 12H3v-6L15 3Zm-3 3 6 6M3 21h18"/>',
};

function icon(name) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  node.setAttribute("viewBox", "0 0 24 24");
  node.setAttribute("class", "icon");
  node.setAttribute("aria-hidden", "true");
  // Only fixed local icon definitions enter innerHTML. User/source text always uses textContent.
  node.innerHTML = ICONS[name] || ICONS.info;
  return node;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") node.textContent = value;
    else if (key === "class") node.className = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else if (value != null) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child != null) node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

document.querySelectorAll("[data-icon]").forEach((node) => node.append(icon(node.dataset.icon)));
const STORAGE_KEY = "prooflens.workspace.v2";
let savedWorkspace = {};
try { savedWorkspace = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { /* Browser storage may be unavailable. */ }
if (!savedWorkspace || typeof savedWorkspace !== "object" || Array.isArray(savedWorkspace)) savedWorkspace = {};
const PAGES = ["check", "ask", "sources", "history", "settings"];
const state = {
  mode: savedWorkspace.mode === "demo" ? "demo" : "live",
  page: PAGES.includes(savedWorkspace.page) ? savedWorkspace.page : "check",
  inputKind: ["text", "image", "audio"].includes(savedWorkspace.inputKind) ? savedWorkspace.inputKind : "text",
  sourceTab: ["website", "upload", "note"].includes(savedWorkspace.sourceTab) ? savedWorkspace.sourceTab : "website",
  sidebarClosed: typeof savedWorkspace.sidebarClosed === "boolean" ? savedWorkspace.sidebarClosed : window.innerWidth < 981,
  drafts: savedWorkspace.drafts && typeof savedWorkspace.drafts === "object" ? savedWorkspace.drafts : {},
  lastChecks: savedWorkspace.lastChecks && typeof savedWorkspace.lastChecks === "object" ? savedWorkspace.lastChecks : {},
  lastAnswerId: typeof savedWorkspace.lastAnswerId === "string" ? savedWorkspace.lastAnswerId : null,
  samples: [], documents: [], status: null, busy: false, askBusy: false, result: null, recorder: null, recordTimer: null,
};
let readyToPersist = false;
let toastTimer;

function captureDraft() {
  state.drafts[state.mode] = { message: $("#message").value, organization: $("#organization").value,
    date: $("#message-date").value, searchWeb: $("#search-web").checked };
}

function restoreDraft() {
  const draft = state.drafts[state.mode] || {};
  $("#message").value = typeof draft.message === "string" ? draft.message.slice(0, 6000) : "";
  $("#organization").value = typeof draft.organization === "string" ? draft.organization.slice(0, 180) : "";
  $("#message-date").value = typeof draft.date === "string" ? draft.date : "";
  $("#search-web").checked = draft.searchWeb !== false;
  updateCount();
}

function persistWorkspace() {
  if (!readyToPersist) return;
  captureDraft();
  const forms = {};
  // Explicit field allowlist. Credentials and full AI responses NEVER enter browser storage.
  for (const id of ["question", "note-title", "note-text", "source-name", "source-domain", "notice-url", "publication-date", "document-filter"]) forms[id] = $("#" + id).value;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, mode: state.mode, page: state.page,
      inputKind: state.inputKind, sourceTab: state.sourceTab, sidebarClosed: state.sidebarClosed,
      drafts: state.drafts, forms, lastChecks: state.lastChecks, lastAnswerId: state.lastAnswerId }));
    $("#draft-state").replaceChildren(icon("check"), document.createTextNode("Saved on this device"));
  } catch {
    $("#draft-state").textContent = "Draft saving unavailable";
  }
}

function setSidebar(closed, remember = true) {
  state.sidebarClosed = closed;
  document.body.classList.toggle("sidebar-closed", closed);
  $("#sidebar").inert = closed;
  $("#open-sidebar").setAttribute("aria-expanded", String(!closed));
  $("#sidebar-backdrop").hidden = closed || window.innerWidth > 980;
  if (closed && $("#sidebar").contains(document.activeElement)) $("#open-sidebar").focus();
  if (remember) persistWorkspace();
}
$("#open-sidebar").addEventListener("click", () => setSidebar(!state.sidebarClosed));
$("#close-sidebar").addEventListener("click", () => setSidebar(true));
$("#sidebar-backdrop").addEventListener("click", () => setSidebar(true));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("#document-dialog").open) setSidebar(true);
});
window.addEventListener("resize", () => setSidebar(state.sidebarClosed, false));

function toast(message, error = false) {
  clearTimeout(toastTimer);
  const node = $("#toast");
  node.textContent = message;
  node.classList.toggle("error", error);
  node.hidden = false;
  toastTimer = setTimeout(() => { node.hidden = true; }, error ? 14000 : 8000);
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 360000);
  const headers = { "X-ProofLens": "1", ...(options.headers || {}) };
  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  try {
    const response = await fetch(path, { ...options, body, headers, signal: controller.signal });
    const data = await response.json();
    if (!response.ok) {
      let detail = data.detail || "The request could not be completed.";
      if (Array.isArray(detail)) detail = detail.map((item) => item.msg).join(" ");
      throw new Error(detail);
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("This check took too long. Try a shorter message or import the direct notice first.");
    if (error instanceof TypeError) throw new Error("Cannot reach ProofLens. Keep its terminal running, then refresh this page.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function formatDate(value) {
  if (!value) return "Unknown";
  const parsed = new Date(value.length === 10 ? value + "T12:00:00" : value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function safeWebsite(value) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

function badge(status) {
  const names = { supported: "Supports", contradicted: "Contradicts", mixed: "Mixed", insufficient: "Not enough" };
  return el("span", { class: "status-pill result-" + status, text: names[status] || status });
}

function empty(title, description) {
  return el("div", { class: "empty-state" }, [icon("layers"), el("h3", { text: title }), el("p", { text: description })]);
}

function showError(selector, message) {
  const panel = $(selector);
  panel.replaceChildren(el("strong", { text: "This request could not be completed" }),
    el("p", { text: message }), el("button", { type: "button", class: "button secondary", text: "Open connection settings", onclick: () => showPage("settings") }));
  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
}

function useLiveWorkspace() {
  if (state.mode === "live") return;
  captureDraft(); state.mode = "live"; $("#mode").value = "live";
  restoreDraft(); state.result = null; $("#result").replaceChildren();
  renderMode(); persistWorkspace();
}

function clearVisibleReports() {
  delete state.lastChecks.live; state.lastAnswerId = null;
  if (state.result?.mode === "live") { state.result = null; $("#result").replaceChildren(); }
  $("#ask-result").replaceChildren(); persistWorkspace();
}

async function refreshStatus() {
  state.status = await api("/api/status");
  $("#api-state").replaceChildren(document.createTextNode(state.status.api_ready ? "AI key saved" : "Set up AI in Settings"), el("small", { text: "Local workspace · autosaved" }));
  $("#connection-dot").classList.toggle("offline", !state.status.api_ready);
  $("#doc-count").textContent = String(state.status.documents[state.mode] || 0).padStart(2, "0");
  $("#domain-count").textContent = String(state.status.source_count).padStart(2, "0");
  $("#nav-doc-count").textContent = state.status.documents.live || 0;
  renderMode();
}

function renderMode() {
  const notice = $("#mode-notice");
  notice.classList.toggle("live", state.mode === "live");
  notice.classList.toggle("setup", state.mode === "live" && !state.status?.api_ready);
  if (state.mode === "demo") {
    notice.replaceChildren(icon("spark"), el("span", {}, [el("strong", { text: "You’re in the sample lab. " }), "Four fictional examples use real keyword search and prepared teaching annotations. They do not describe real events."]));
  } else {
    notice.replaceChildren(icon("shield"), el("span", {}, [
      el("strong", { text: state.status?.api_ready ? "Your sources · live AI. " : "One setup step before live checks. " }),
      state.status?.api_ready ? "Your saved sources are ready for evidence checks. " : "Save your API key in Settings. ",
      el("button", { type: "button", text: state.status?.api_ready ? "Manage sources" : "Open Settings", onclick: () => showPage(state.status?.api_ready ? "sources" : "settings") }),
    ]));
  }
  $("#samples-area").hidden = state.mode !== "demo";
  $("#web-search-label").hidden = state.mode !== "live";
  $("#document-list-title").textContent = state.mode === "demo" ? "Fictional sample documents" : "Your saved information";
  $("#collection-note").textContent = state.mode === "demo" ? "Choose My workspace at the top to see your own documents." : "Saved on this computer, ready when you return.";
  $("#history-label").textContent = state.mode === "demo" ? "Fictional sample checks" : "Message checks";
  $("#answers-history-area").hidden = state.mode === "demo";
}

async function showPage(name) {
  if (!PAGES.includes(name)) name = "check";
  if (name === "ask") useLiveWorkspace();
  const titles = { check: "Check a message", ask: "Ask your library", sources: "Evidence sources", history: "History", settings: "Settings" };
  state.page = name;
  document.body.dataset.page = name;
  document.querySelectorAll(".page").forEach((node) => { node.hidden = node.id !== "page-" + name; node.classList.toggle("active", !node.hidden); });
  document.querySelectorAll(".nav-item").forEach((node) => {
    node.classList.toggle("active", node.dataset.page === name);
    if (node.dataset.page === name) node.setAttribute("aria-current", "page"); else node.removeAttribute("aria-current");
  });
  document.querySelectorAll(".mobile-nav [data-go]").forEach((node) => {
    if (node.dataset.go === name) node.setAttribute("aria-current", "page"); else node.removeAttribute("aria-current");
  });
  $("#page-title").textContent = titles[name];
  document.title = "ProofLens · " + titles[name];
  if (window.innerWidth <= 980) setSidebar(true, false);
  persistWorkspace();
  window.scrollTo({ top: 0, behavior: "instant" });
  try {
    if (name === "sources") await loadSources();
    if (name === "history") await loadHistory();
    if (name === "settings") await loadSettings();
  } catch (error) { toast(error.message, true); }
}

document.querySelectorAll(".nav-item").forEach((node) => node.addEventListener("click", () => showPage(node.dataset.page)));
document.querySelectorAll("[data-go]").forEach((node) => node.addEventListener("click", () => showPage(node.dataset.go)));
$("#mode").addEventListener("change", async () => {
  captureDraft();
  state.mode = $("#mode").value;
  state.result = null;
  $("#result").replaceChildren();
  $("#check-error").hidden = true;
  restoreDraft(); persistWorkspace();
  renderMode();
  try {
    await refreshStatus();
    if (state.page === "sources") await loadSources();
    if (state.page === "history") await loadHistory();
  } catch (error) { toast(error.message, true); }
});

function setInputTab(kind) {
  if (!["text", "image", "audio"].includes(kind)) return;
  state.inputKind = kind;
  $(".input-tabs").dataset.tab = kind;
  document.querySelectorAll(".input-tab").forEach((node) => {
    const active = node.dataset.input === kind;
    node.classList.toggle("active", active);
    node.setAttribute("aria-selected", String(active));
    node.setAttribute("tabindex", active ? "0" : "-1");
  });
  $("#text-input").hidden = kind !== "text";
  $("#image-input").hidden = kind !== "image";
  $("#audio-input").hidden = kind !== "audio";
  persistWorkspace();
}
document.querySelectorAll(".input-tab").forEach((node) => node.addEventListener("click", () => setInputTab(node.dataset.input)));
function updateCount() { $("#character-count").textContent = $("#message").value.length + " / 6000"; }
$("#message").addEventListener("input", updateCount);
$("#clear-draft").addEventListener("click", () => {
  if (!confirm("Clear this message draft? Saved sources and reports stay in your workspace.")) return;
  $("#message").value = ""; $("#organization").value = ""; $("#message-date").value = "";
  $("#review-note").hidden = true; updateCount(); persistWorkspace();
});

function renderSamples() {
  const container = $("#samples");
  container.replaceChildren();
  state.samples.forEach((sample, index) => {
    container.append(el("button", { type: "button", class: "sample-card", onclick: () => {
      if (state.busy) return;
      $("#message").value = sample.message;
      $("#organization").value = "Aster Demo University";
      $("#message-date").value = sample.message_date;
      setInputTab("text"); updateCount(); persistWorkspace(); runCheck();
    } }, [el("span", { class: "sample-index", text: String(index + 1).padStart(2, "0") }), el("span", {}, [el("strong", { text: sample.label }), el("small", { text: "Check this example ↗" })])]));
  });
}

async function runCheck(event) {
  event?.preventDefault();
  if (state.busy || !$("#check-form").reportValidity()) return;
  state.busy = true;
  state.result = null;
  persistWorkspace();
  $("#check-error").hidden = true;
  $("#check-button").disabled = true;
  $("#mode").disabled = true;
  $("#result").replaceChildren();
  $("#checking").hidden = false;
  $("#checking").scrollIntoView({ behavior: "smooth", block: "center" });
  const started = Date.now();
  $("#elapsed").textContent = "Starting…";
  const timer = setInterval(() => { $("#elapsed").textContent = Math.floor((Date.now() - started) / 1000) + " seconds elapsed"; }, 1000);
  try {
    const result = await api("/api/check", { method: "POST", body: {
      message: $("#message").value.trim(), mode: state.mode,
      organization: $("#organization").value.trim(), message_date: $("#message-date").value || null,
      search_web: $("#search-web").checked,
    } });
    renderResult(result);
    await refreshStatus();
  } catch (error) { showError("#check-error", error.message); }
  finally {
    clearInterval(timer); state.busy = false;
    $("#check-button").disabled = false; $("#mode").disabled = false; $("#checking").hidden = true;
    if (state.result) $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
$("#check-form").addEventListener("submit", runCheck);

function renderEvidence(item) {
  const relationNames = { supports: "SUPPORTING PASSAGE", contradicts: "CONTRADICTING PASSAGE", context: "REFERENCE / CONTEXT ONLY" };
  const links = el("div", { class: "evidence-links" }, [el("button", { type: "button", class: "link-button", text: "View saved source", onclick: () => openDocument(item.document_id, item.quote) })]);
  const website = safeWebsite(item.source_url);
  if (website) links.append(el("a", { class: "link-button", href: website, target: "_blank", rel: "noopener noreferrer", text: "Original website ↗" }));
  const card = el("article", { class: "evidence-card" }, [
    el("div", { class: "evidence-heading" }, [el("span", { text: relationNames[item.relation] || "CONTEXT" }), icon("book")]),
    el("h4", { text: item.title }),
    el("div", { class: "evidence-date", text: item.source_name + " · Page " + item.page }),
    el("div", { class: "evidence-date", text: "Published: " + formatDate(item.published_on) + " · Saved: " + formatDate(item.retrieved_at) }),
    el("blockquote", { text: item.quote }), el("p", { text: item.explanation }),
  ]);
  if (item.limitations?.length) card.append(el("ul", { class: "limitations" }, item.limitations.map((text) => el("li", { text }))));
  card.append(links);
  return card;
}

function renderResult(result) {
  state.result = result;
  state.lastChecks[result.mode] = result.id;
  persistWorkspace();
  const names = { supported: "check", contradicted: "close", mixed: "mixed", insufficient: "question" };
  const wrap = el("div", { class: "result-wrap" });
  wrap.append(el("div", { class: "result-banner result-" + result.verdict }, [
    el("div", { class: "result-icon" }, [icon(names[result.verdict])]),
    el("div", {}, [el("div", { class: "result-kicker", text: result.mode === "demo" ? "FICTIONAL SAMPLE RESULT" : "BASED ON THE EVIDENCE CHECKED" }), el("h2", { text: result.label }), el("p", { text: result.scope_note })]),
  ]));
  wrap.append(el("div", { class: "result-meta" }, [
    el("span", { text: result.claims.length + " claim(s) checked" }),
    el("span", { text: result.retrieved_count + " passages retrieved" }),
    el("span", { text: (result.elapsed_ms / 1000).toFixed(1) + "s processing" }),
    el("a", { href: "/api/history/" + result.id + "/export", class: "button secondary export-button", download: "", text: "Download report ↓" }),
  ]));
  for (const [index, claim] of result.claims.entries()) {
    const card = el("article", { class: "card claim-card" }, [
      el("div", { class: "claim-top" }, [el("h3", { text: (index + 1) + ". " + claim.text }), badge(claim.status)]),
      el("div", { class: "claim-context", text: [claim.institution, claim.event_date ? "Event date: " + formatDate(claim.event_date) : "Event date not established"].filter(Boolean).join(" · ") }),
      el("p", { class: "claim-description", text: claim.explanation }),
    ]);
    if (claim.missing_context?.length) card.append(el("div", { class: "missing-context" }, [el("strong", { text: "A detail to clarify" }), el("ul", {}, claim.missing_context.map((text) => el("li", { text })))]));
    if (claim.evidence.length) card.append(el("div", { class: "evidence-list" }, claim.evidence.map(renderEvidence)));
    else card.append(el("p", { class: "small muted", text: "No admissible matching passage was found in the checked collection." }));
    wrap.append(card);
  }
  if (result.warnings.length) wrap.append(el("details", { class: "warnings", open: "" }, [el("summary", { text: "What could affect this result (" + result.warnings.length + ")" }), el("ul", {}, result.warnings.map((text) => el("li", { text })))]));
  wrap.append(el("details", { class: "pipeline" }, [el("summary", { text: "How this check ran" }), el("ol", {}, result.pipeline.map((text) => el("li", { text }))), el("div", { class: "engine-detail", text: result.engine + (result.searched_domains.length ? " · Approved domains: " + result.searched_domains.join(", ") : "") })]));
  $("#result").replaceChildren(wrap);
}

async function openDocument(id, quote = "") {
  try {
    const doc = await api("/api/documents/" + encodeURIComponent(id));
    $("#dialog-title").textContent = doc.title;
    $("#dialog-meta").textContent = "Published: " + formatDate(doc.published_on) + " · Saved: " + formatDate(doc.retrieved_at) + " · " + (doc.url || "Local reference / sample");
    const pre = $("#dialog-content");
    pre.replaceChildren();
    const index = quote ? doc.content.indexOf(quote) : -1;
    if (index >= 0) pre.append(document.createTextNode(doc.content.slice(0, index)), el("mark", { text: quote }), document.createTextNode(doc.content.slice(index + quote.length)));
    else pre.textContent = doc.content;
    if (!$("#document-dialog").open) $("#document-dialog").showModal();
  } catch (error) { toast(error.message, true); }
}
$("#close-dialog").addEventListener("click", () => $("#document-dialog").close());
$("#document-dialog").addEventListener("click", (event) => { if (event.target === $("#document-dialog")) $("#document-dialog").close(); });

async function loadSources() {
  const mode = state.mode;
  const [sources, documents] = await Promise.all([api("/api/sources"), api("/api/documents?mode=" + mode)]);
  if (mode !== state.mode) return;
  const list = $("#source-list"); list.replaceChildren();
  $("#url-source").replaceChildren(el("option", { value: "", text: sources.length ? "Choose an approved website" : "First add a website" }));
  for (const source of sources) {
    $("#url-source").append(el("option", { value: source.id, text: source.name + " · " + source.domain }));
    list.append(el("div", { class: "source-row" }, [el("div", {}, [el("strong", { text: source.name }), el("small", { text: source.domain })]), el("button", { type: "button", class: "icon-button", "aria-label": "Remove " + source.name, onclick: async () => {
      if (!confirm("Remove this website and its imported documents? Saved live reports and library answers will also be cleared because they contain source quotes.")) return;
      try { await api("/api/sources/" + source.id, { method: "DELETE" }); clearVisibleReports(); await loadSources(); await refreshStatus(); toast("Website and its saved evidence removed."); }
      catch (error) { toast(error.message, true); }
    } }, [icon("trash")])]));
  }
  state.documents = documents;
  renderDocuments();
}

function renderDocuments() {
  const filter = $("#document-filter").value.trim().toLocaleLowerCase();
  const documents = state.documents.filter((doc) => (doc.title + " " + (doc.source_name || "")).toLocaleLowerCase().includes(filter));
  const docs = $("#document-list"); docs.replaceChildren();
  if (!documents.length) docs.append(empty(filter ? "No matching document" : "Your collection starts here", filter ? "Try another title or organization name." : "Import a website, upload a document or save a note. Your information will stay saved."));
  for (const doc of documents) {
    const actions = el("div", { class: "document-actions" }, [el("button", { type: "button", class: "link-button", text: "Read source ↗", onclick: () => openDocument(doc.id) })]);
    if (doc.collection !== "demo") actions.append(el("button", { type: "button", class: "icon-button", "aria-label": "Remove " + doc.title, onclick: async () => {
      if (!confirm("Delete this saved document? Saved live reports and library answers will also be cleared because they contain document quotes.")) return;
      try { await api("/api/documents/" + doc.id, { method: "DELETE" }); clearVisibleReports(); await loadSources(); await refreshStatus(); toast("Document removed."); }
      catch (error) { toast(error.message, true); }
    } }, [icon("trash")]));
    docs.append(el("article", { class: "document-row" }, [el("div", {}, [el("div", { class: "origin-tag", text: doc.origin === "demo" ? "FICTIONAL SAMPLE" : doc.origin === "web" ? "APPROVED WEBSITE SNAPSHOT" : doc.origin === "note" ? "YOUR SAVED NOTE" : "YOUR UPLOADED REFERENCE" }), el("h3", { text: doc.title }), el("p", { text: (doc.published_on ? "Published: " + formatDate(doc.published_on) + " · " : "") + "Saved: " + formatDate(doc.retrieved_at) + " · " + doc.chunk_count + " searchable passages" })]), actions]));
  }
}

async function formTask(form, task) {
  const button = form.querySelector('button[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  const oldChildren = Array.from(button.childNodes);
  button.textContent = "Working…";
  try { await task(); }
  catch (error) { toast(error.message, true); }
  finally { button.disabled = false; button.replaceChildren(...oldChildren); }
}

$("#source-form").addEventListener("submit", (event) => {
  event.preventDefault();
  formTask(event.currentTarget, async () => {
    await api("/api/sources", { method: "POST", body: { name: $("#source-name").value.trim(), domain: $("#source-domain").value.trim() } });
    $("#source-form").reset(); persistWorkspace(); await loadSources(); await refreshStatus(); toast("Website saved. You can now import its notices.");
  });
});

$("#url-form").addEventListener("submit", (event) => {
  event.preventDefault();
  formTask(event.currentTarget, async () => {
    const result = await api("/api/documents/url", { method: "POST", body: { source_id: $("#url-source").value, url: $("#notice-url").value.trim(), published_on: $("#publication-date").value || null, follow_links: $("#follow-links").checked } });
    useLiveWorkspace();
    await loadSources(); await refreshStatus();
    toast(result.imported.length + " document(s) saved. Ready to search in Ask your library." + (result.warnings.length ? " " + result.warnings.join(" ") : ""));
  });
});

$("#reference-file").addEventListener("change", async (event) => {
  const file = event.target.files[0]; if (!file) return;
  const form = new FormData(); form.append("file", file);
  event.target.disabled = true;
  try {
    const result = await api("/api/documents/upload", { method: "POST", body: form });
    useLiveWorkspace();
    toast(result.note); await loadSources(); await refreshStatus();
  } catch (error) { toast(error.message, true); }
  finally { event.target.value = ""; event.target.disabled = false; }
});

async function loadHistory() {
  const rows = await api("/api/history?mode=" + state.mode);
  const list = $("#history-list"); list.replaceChildren();
  if (!rows.length) list.append(empty("No checks yet", "Check a message. Its evidence report will be saved here automatically."));
  for (const row of rows) list.append(el("article", { class: "history-row" }, [el("div", {}, [badge(row.verdict), el("h3", { text: row.message }), el("p", { text: formatDate(row.created_at) + (row.mode === "demo" ? " · Fictional sample lab" : " · Live evidence check") })]), el("button", { type: "button", class: "button secondary", text: "Open ↗", onclick: async () => {
    try {
      const result = await api("/api/history/" + row.id);
      $("#message").value = result.message; $("#message-date").value = result.message_date || "";
      $("#organization").value = result.organization || ""; updateCount();
      await showPage("check"); renderResult(result); $("#result").scrollIntoView({ behavior: "smooth" });
    } catch (error) { toast(error.message, true); }
  } })]));
  if (state.mode === "live") await loadAnswerHistory();
}
$("#clear-history").addEventListener("click", async () => {
  if (!confirm("Delete all check history for the selected mode?")) return;
  try { await api("/api/history?mode=" + state.mode, { method: "DELETE" }); delete state.lastChecks[state.mode]; state.result = null; $("#result").replaceChildren(); persistWorkspace(); await loadHistory(); toast("Check history cleared."); }
  catch (error) { toast(error.message, true); }
});

async function extractFile(file, kind) {
  if (!file || state.busy) return;
  if (file.size > 15 * 1024 * 1024) { toast("Please choose a file under 15 MB.", true); return; }
  const form = new FormData(); form.append("file", file); form.append("kind", kind);
  const status = $("#extract-state"); status.hidden = false; status.textContent = "Reading your " + (kind === "image" ? "screenshot" : "voice message") + "…";
  $("#check-button").disabled = true; state.busy = true;
  try {
    const result = await api("/api/extract", { method: "POST", body: form });
    $("#message").value = result.text.slice(0, 6000); updateCount(); persistWorkspace(); $("#review-note").hidden = false;
    status.textContent = "Text extracted. Review it below, then check the evidence.";
    $("#message").focus();
  } catch (error) { status.textContent = error.message; toast(error.message, true); }
  finally { state.busy = false; $("#check-button").disabled = false; }
}
$("#image-file").addEventListener("change", (event) => { extractFile(event.target.files[0], "image"); event.target.value = ""; });
$("#audio-file").addEventListener("change", (event) => { extractFile(event.target.files[0], "audio"); event.target.value = ""; });
for (const name of ["dragover", "dragleave", "drop"]) $("#image-drop").addEventListener(name, (event) => {
  event.preventDefault(); $("#image-drop").classList.toggle("drag", name === "dragover");
  if (name === "drop") extractFile(event.dataTransfer.files[0], "image");
});

$("#record").addEventListener("click", async () => {
  if (state.recorder?.state === "recording") { state.recorder.stop(); return; }
  if (!state.status?.api_ready) { toast("Open Settings and save an API key to use voice transcription.", true); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast("Recording is not supported here. Upload a voice file instead.", true); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks = [];
    state.recorder = recorder;
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      clearTimeout(state.recordTimer); stream.getTracks().forEach((track) => track.stop());
      $("#record").classList.remove("recording"); $("#record").replaceChildren(icon("mic"), document.createTextNode("Record a message"));
      $("#record-state").textContent = "";
      const type = recorder.mimeType || "audio/webm";
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      extractFile(new File(chunks, "recording." + ext, { type }), "audio");
    };
    recorder.onerror = () => { stream.getTracks().forEach((track) => track.stop()); toast("The recording failed. Try uploading a voice file.", true); };
    recorder.start();
    $("#record").classList.add("recording"); $("#record").textContent = "Stop recording";
    $("#record-state").textContent = " Recording · stops after 60 seconds";
    state.recordTimer = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 60000);
  } catch (error) { toast("Microphone access was not available. You can upload a voice file instead.", true); }
});
window.addEventListener("pagehide", () => {
  persistWorkspace();
  if (state.recorder?.state === "recording") state.recorder.stream.getTracks().forEach((track) => track.stop());
});

function setSourceTab(kind) {
  if (!["website", "upload", "note"].includes(kind)) return;
  state.sourceTab = kind;
  $(".source-tabs").dataset.tab = kind;
  document.querySelectorAll(".source-tab").forEach((node) => {
    const active = node.dataset.sourceTab === kind;
    node.classList.toggle("active", active);
    node.setAttribute("aria-selected", String(active));
    node.setAttribute("tabindex", active ? "0" : "-1");
  });
  for (const type of ["website", "upload", "note"]) $("#source-" + type).hidden = type !== kind;
  persistWorkspace();
}
document.querySelectorAll(".source-tab").forEach((node) => node.addEventListener("click", () => setSourceTab(node.dataset.sourceTab)));

// Sliding controls also work with a keyboard and a left/right touch gesture.
document.querySelectorAll(".sliding-tabs").forEach((bar) => {
  function move(index) {
    const buttons = [...bar.querySelectorAll('[role="tab"]')];
    const target = buttons[(index + buttons.length) % buttons.length];
    target.click(); target.focus({ preventScroll: true });
  }
  bar.addEventListener("keydown", (event) => {
    const buttons = [...bar.querySelectorAll('[role="tab"]')];
    const index = buttons.indexOf(document.activeElement);
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    move(event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : index + (event.key === "ArrowRight" ? 1 : -1));
  });
  let start = null;
  bar.addEventListener("touchstart", (event) => { const touch = event.touches[0]; start = { x: touch.clientX, y: touch.clientY }; }, { passive: true });
  bar.addEventListener("touchend", (event) => {
    if (!start) return;
    const touch = event.changedTouches[0], dx = touch.clientX - start.x, dy = touch.clientY - start.y; start = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 2) return;
    const buttons = [...bar.querySelectorAll('[role="tab"]')];
    move(buttons.findIndex((button) => button.getAttribute("aria-selected") === "true") + (dx < 0 ? 1 : -1));
  }, { passive: true });
});

$("#document-filter").addEventListener("input", renderDocuments);
$("#note-form").addEventListener("submit", (event) => {
  event.preventDefault();
  formTask(event.currentTarget, async () => {
    const result = await api("/api/documents/note", { method: "POST", body: { title: $("#note-title").value.trim(), text: $("#note-text").value.trim() } });
    useLiveWorkspace(); $("#note-form").reset(); persistWorkspace();
    await loadSources(); await refreshStatus();
    toast(result.duplicate ? "This note is already saved." : "Note saved. You can ask questions about it in Ask your library.");
  });
});

function renderAnswer(answer) {
  state.lastAnswerId = answer.id; persistWorkspace();
  const wrap = el("div", { class: "answer-wrap" }, [el("div", { class: "answer-intro" }, [
    el("h2", { text: answer.question }), el("p", { text: answer.scope_note }),
    el("p", { text: answer.retrieved_count + " passages retrieved · " + (answer.retrieval_method === "hybrid" ? "Word + meaning search" : "Word search") }),
  ])]);
  for (const point of answer.points) {
    const card = el("article", { class: "card answer-point" }, [el("p", { text: point.text })]);
    for (const cite of point.citations) {
      const details = el("details", { class: "answer-citation" }, [
        el("summary", { text: cite.title + " · Page " + cite.page }),
        el("p", { class: "small", text: cite.origin === "web" ? "Saved website passage · Published: " + formatDate(cite.published_on) : "Your saved reference · Not independently verified" }),
        el("blockquote", { text: cite.quote }),
        el("button", { class: "link-button", type: "button", text: "Read saved source ↗", onclick: () => openDocument(cite.document_id, cite.quote) }),
      ]);
      const website = safeWebsite(cite.source_url);
      if (website) details.append(el("a", { class: "link-button", href: website, target: "_blank", rel: "noopener noreferrer", text: "Original website ↗" }));
      card.append(details);
    }
    wrap.append(card);
  }
  if (!answer.points.length) wrap.append(empty("Your saved information does not answer this yet", answer.missing_information));
  else if (answer.missing_information) wrap.append(el("p", { class: "scope-hint", text: answer.missing_information }));
  if (answer.warnings.length) wrap.append(el("details", { class: "warnings" }, [el("summary", { text: "Notes about this answer" }), el("ul", {}, answer.warnings.map((text) => el("li", { text })))]));
  $("#ask-result").replaceChildren(wrap);
}

$("#ask-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.askBusy) return;
  state.askBusy = true; persistWorkspace();
  $("#ask-button").disabled = true; $("#ask-error").hidden = true;
  $("#ask-result").replaceChildren(); $("#ask-loading").hidden = false;
  try { renderAnswer(await api("/api/ask", { method: "POST", body: { question: $("#question").value.trim() } })); }
  catch (error) { showError("#ask-error", error.message); }
  finally { state.askBusy = false; $("#ask-button").disabled = false; $("#ask-loading").hidden = true; }
});

async function loadAnswerHistory() {
  const answers = await api("/api/answers");
  const list = $("#answers-history"); list.replaceChildren();
  if (!answers.length) list.append(empty("Your library answers will appear here", "Save some information, then ask a question in Ask your library."));
  for (const answer of answers) list.append(el("article", { class: "history-row" }, [el("div", {}, [
    el("div", { class: "origin-tag", text: answer.points.length ? "ANSWER WITH SOURCE QUOTES" : "MORE INFORMATION NEEDED" }),
    el("h3", { text: answer.question }), el("p", { text: formatDate(answer.created_at) + " · Saved library answer" }),
  ]), el("button", { type: "button", class: "button secondary", text: "Open ↗", onclick: async () => {
    $("#question").value = answer.question; await showPage("ask"); renderAnswer(answer);
    $("#ask-result").scrollIntoView({ behavior: "smooth", block: "start" });
  } })]));
}
$("#clear-answers").addEventListener("click", async () => {
  if (!confirm("Clear saved library answers? Your notes and documents will stay saved.")) return;
  try { await api("/api/answers", { method: "DELETE" }); state.lastAnswerId = null; $("#ask-result").replaceChildren(); persistWorkspace(); await loadAnswerHistory(); toast("Library answer history cleared."); }
  catch (error) { toast(error.message, true); }
});

async function loadSettings() {
  const settings = await api("/api/settings");
  $("#ai-provider").value = settings.provider || "ollama";
  $("#ai-model").value = settings.model;
  $("#embedding-model").value = settings.embedding_model;
  $("#transcription-model").value = settings.transcription_model;
  $("#settings-status").textContent = settings.provider === "ollama" ? "Free local" : (settings.api_ready ? "Key saved" : "Needs setup");
  toggleProviderFields();
  $("#api-key").placeholder = settings.api_ready ? "Key saved · leave empty to keep it" : "Paste your API key here";
  $("#key-field-note").textContent = settings.api_ready ? "saved privately" : "private";
}

function toggleProviderFields() {
  const local = $("#ai-provider")?.value === "ollama";
  const wrap = $("#api-key-wrap"); if (wrap) wrap.hidden = local;
  if (local) {
    if ($("#ai-model").value.startsWith("gpt-")) $("#ai-model").value = "gemma3:4b";
    if ($("#embedding-model").value.startsWith("text-embedding")) $("#embedding-model").value = "nomic-embed-text";
  }
}
$("#ai-provider")?.addEventListener("change", toggleProviderFields);
$("#settings-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if ($("#test-connection").disabled) return;
  formTask(event.currentTarget, async () => {
    const output = $("#connection-result");
    try {
      const result = await api("/api/settings", { method: "POST", body: {
        provider: $("#ai-provider").value, api_key: $("#api-key").value.trim() || null, model: $("#ai-model").value.trim(),
        embedding_model: $("#embedding-model").value.trim(), transcription_model: $("#transcription-model").value.trim(),
      } });
      $("#api-key").value = ""; output.textContent = result.note; output.hidden = false;
      await refreshStatus(); await loadSettings(); toast("Connection saved. No restart needed.");
    } catch (error) { output.textContent = error.message; output.hidden = false; throw error; }
  });
});
$("#test-connection").addEventListener("click", async () => {
  const button = $("#test-connection"), save = $("#settings-form").querySelector('button[type="submit"]');
  if (save.disabled) return;
  const output = $("#connection-result");
  button.disabled = true; save.disabled = true; output.hidden = false; output.textContent = "Testing the saved text model and meaning search…";
  try { const result = await api("/api/settings/test", { method: "POST" }); output.textContent = result.note; }
  catch (error) { output.textContent = error.message; }
  finally { button.disabled = false; save.disabled = false; }
});

let saveTimer;
for (const id of ["message", "organization", "message-date", "search-web", "question", "note-title", "note-text", "source-name", "source-domain", "notice-url", "publication-date", "document-filter"]) {
  $("#" + id).addEventListener("input", () => { clearTimeout(saveTimer); saveTimer = setTimeout(persistWorkspace, 180); });
  $("#" + id).addEventListener("change", persistWorkspace);
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") persistWorkspace(); });

async function init() {
  $("#mode").value = state.mode;
  restoreDraft(); setInputTab(state.inputKind); setSourceTab(state.sourceTab); setSidebar(state.sidebarClosed, false);
  const forms = savedWorkspace.forms && typeof savedWorkspace.forms === "object" ? savedWorkspace.forms : {};
  for (const id of ["question", "note-title", "note-text", "source-name", "source-domain", "notice-url", "publication-date", "document-filter"]) {
    if (typeof forms[id] === "string") $("#" + id).value = forms[id].slice(0, id === "note-text" ? 120000 : 3000);
  }
  readyToPersist = true;
  try {
    const [, samples] = await Promise.all([refreshStatus(), api("/api/samples")]); state.samples = samples; renderSamples();
    await showPage(state.page);
    const lastId = state.lastChecks[state.mode];
    if (typeof lastId === "string") {
      try { const result = await api("/api/history/" + encodeURIComponent(lastId)); if (result.message === $("#message").value.trim()) renderResult(result); }
      catch { delete state.lastChecks[state.mode]; }
    }
    if (state.lastAnswerId) {
      try { const answers = await api("/api/answers"); const answer = answers.find((a) => a.id === state.lastAnswerId); if (answer) renderAnswer(answer); else state.lastAnswerId = null; }
      catch { /* The history page can retry loading later. */ }
    }
    persistWorkspace();
  }
  catch (error) { $("#api-state").textContent = "Server not reachable"; toast(error.message, true); }
}
init();
