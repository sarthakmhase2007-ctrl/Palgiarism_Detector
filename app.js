"use strict";

const MAX_DOCUMENTS = 8;
const MAX_WORDS = 850;
const MAX_CHARACTERS = 20000;
const state = { documents: [], result: null, selectedPair: 0, busy: false };
const $ = (id) => document.getElementById(id);
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const pct = (score) => `${(score * 100).toFixed(1)}%`;
const shortName = (name, limit = 22) => name.length > limit ? `${name.slice(0, limit - 1)}…` : name;
const wordCount = (text) => (text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim().match(/\S+/g) || []).length;
let toastTimeout;

const examples = [
  {name: "doc1.txt", text: "Artificial intelligence is the simulation of human intelligence by machines. It includes learning, reasoning and self correction. Modern systems use large amounts of data to improve their performance over time. Many industries such as healthcare and finance now depend on these tools."},
  {name: "doc4.txt", text: "The monsoon season in Mumbai brings heavy rainfall from June to September. Local trains often get delayed and streets fill with water. Street vendors sell hot tea and corn to people waiting for the rain to stop."},
  {name: "doc6.txt", text: "Heavy rainfall arrives in Mumbai during the monsoon season from June to September. Local trains often get delayed and streets fill with water. Vendors on the street sell hot tea and corn to people waiting for the rain to stop."}
];

function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 3600);
}
function showInputError(message) {
  $("input-error").textContent = message;
  $("input-error").hidden = !message;
}
function setBusy(busy) {
  state.busy = busy;
  const button = $("analyze-button");
  button.disabled = busy || state.documents.length < 2;
  button.classList.toggle("busy", busy);
  $("analyze-label").innerHTML = busy ? '<span class="loading-ring" aria-hidden="true"></span> Comparing documents...' : "Run analysis";
  $("analyze-arrow").textContent = busy ? "" : "↗";
  $("rerun-button").disabled = busy;
}
function updateDocuments() {
  const list = $("documents");
  $("doc-count").textContent = `${state.documents.length} / ${MAX_DOCUMENTS}`;
  if (!state.documents.length) {
    list.innerHTML = '<div class="empty-documents"><span>◎</span> Your added documents will appear here.</div>';
  } else {
    list.innerHTML = state.documents.map((doc, i) => `<div class="document-item"><div class="file-icon">TXT</div><div class="file-info"><strong title="${escapeHTML(doc.name)}">${escapeHTML(doc.name)}</strong><span>${wordCount(doc.text)} words · ${new Blob([doc.text]).size.toLocaleString()} bytes</span></div><button class="remove-file" type="button" data-remove="${i}" aria-label="Remove ${escapeHTML(doc.name)}" title="Remove document">✕</button></div>`).join("");
  }
  $("run-hint").textContent = state.documents.length < 2 ? "Add at least 2 documents to begin" : `${state.documents.length} documents ready · ${(state.documents.length * (state.documents.length - 1)) / 2} comparisons`;
  setBusy(state.busy);
}
function clearResult() {
  state.result = null;
  $("results").hidden = true;
  $("nav-results").classList.remove("active");
}
function validateDocument(name, text) {
  name = name.trim();
  if (!name) throw new Error("Give the document a filename.");
  if (name.length > 120) throw new Error("Filename must be at most 120 characters.");
  if (state.documents.length >= MAX_DOCUMENTS) throw new Error(`You can compare up to ${MAX_DOCUMENTS} documents at once.`);
  if (state.documents.some(d => d.name.toLowerCase() === name.toLowerCase())) throw new Error(`A document named ${name} is already added.`);
  if (!text.trim() || !wordCount(text)) throw new Error("The document is empty or has no comparable words.");
  if (text.length > MAX_CHARACTERS) throw new Error(`Document is too long (max ${MAX_CHARACTERS.toLocaleString()} characters).`);
  if (wordCount(text) > MAX_WORDS) throw new Error(`Document is too long (max ${MAX_WORDS} words).`);
  return { name, text };
}
function addDocument(name, text) {
  state.documents.push(validateDocument(name, text));
  clearResult();
  showInputError("");
  updateDocuments();
}
async function addFiles(files) {
  const errors = [];
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".txt")) { errors.push(`${file.name}: only .txt files are supported.`); continue; }
    if (file.size > 80000) { errors.push(`${file.name}: file is too large.`); continue; }
    try { addDocument(file.name, await file.text()); }
    catch (error) { errors.push(`${file.name}: ${error.message}`); }
  }
  if (errors.length) showInputError(errors.join(" "));
  else if (files.length) notify(`${files.length} file${files.length === 1 ? "" : "s"} added.`);
}
function openModal() {
  if (state.documents.length >= MAX_DOCUMENTS) { showInputError("Document limit reached. Remove a document first."); return; }
  $("paste-modal").hidden = false;
  $("paste-error").hidden = true;
  $("paste-name").value = `document-${state.documents.length + 1}.txt`;
  $("paste-content").value = "";
  $("paste-name").focus();
}
function closeModal() { $("paste-modal").hidden = true; $("paste-button").focus(); }

async function analyze() {
  if (state.busy || state.documents.length < 2) return;
  showInputError("");
  clearResult();
  setBusy(true);
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 60000);
  try {
    const response = await fetch("/api/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents: state.documents, threshold: Number($("threshold").value) / 100 }),
      signal: abort.signal
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) throw new Error(json?.error || `Server error ${response.status}.`);
    if (!json || !Array.isArray(json.pairs) || !Array.isArray(json.matrix)) throw new Error("Unexpected server response.");
    state.result = json;
    state.selectedPair = 0;
    renderResults();
    $("results").hidden = false;
    $("results").scrollIntoView({ behavior: "smooth", block: "start" });
    $("nav-results").classList.add("active");
    notify("Analysis completed successfully.");
  } catch (error) {
    showInputError(error.name === "AbortError" ? "Analysis timed out. Try smaller documents." : error.message || "Could not connect to the analysis engine.");
    $("workspace").scrollIntoView({ behavior: "smooth" });
  } finally { clearTimeout(timeout); setBusy(false); }
}
function statsCard(label, value, hint, icon) {
  return `<div class="stat-card"><div class="stat-label"><span class="stat-icon">${icon}</span>${escapeHTML(label)}</div><div class="stat-value">${escapeHTML(value)}</div><div class="stat-hint">${escapeHTML(hint)}</div></div>`;
}
function renderResults() {
  const data = state.result;
  if (!data) return;
  const highPairs = data.pairs.filter(p => p.scores.final >= data.threshold);
  const topScore = data.pairs[0]?.scores.final ?? 0;
  const clusters = data.graph.clusters.filter(group => group.length > 1);
  $("stats-grid").innerHTML = [
    statsCard("Documents scanned", String(data.documents.length), "Plain text documents", "▤"),
    statsCard("Pairs compared", String(data.pairs.length), "Every unique combination", "≋"),
    statsCard("Highest similarity", pct(topScore), "Most closely related pair", "◈"),
    statsCard("Matching pairs", String(highPairs.length), `At ${Math.round(data.threshold * 100)}% threshold`, "⌁")
  ].join("");
  $("pair-count").textContent = `${data.pairs.length} comparisons`;
  $("pair-list").innerHTML = data.pairs.map((pair, i) => {
    const score = Math.round(pair.scores.final * 100);
    const nameA = data.documents[pair.a].name, nameB = data.documents[pair.b].name;
    return `<button type="button" class="pair-row ${i === state.selectedPair ? "selected" : ""}" data-pair="${i}" aria-pressed="${i === state.selectedPair}"><div class="pair-row-top"><span class="pair-title" title="${escapeHTML(`${nameA} vs ${nameB}`)}">${escapeHTML(shortName(nameA, 20))} <span class="pair-dot">×</span> ${escapeHTML(shortName(nameB, 20))}</span><span class="pair-percent">${pct(pair.scores.final)}</span></div><div class="score-track"><div class="score-fill" style="width:${score}%"></div></div><span class="pair-caption">${escapeHTML(pair.verdict)}</span></button>`;
  }).join("");
  renderPairDetail();
  renderGraph();
  renderMatrix();
}
function renderPairDetail() {
  const data = state.result;
  const pair = data?.pairs[state.selectedPair];
  if (!pair) return;
  const names = data.documents;
  const scoreItems = [
    ["Jaccard", pair.scores.jaccard], ["Dice", pair.scores.dice],
    ["Overlap", pair.scores.overlap], ["Cosine", pair.scores.cosine],
    ["3-gram", pair.scores.ngram], ["LCS", pair.scores.lcs],
    ["Final score", pair.scores.final]
  ];
  $("selected-verdict").textContent = pair.scores.final >= .7 ? "HIGH" : pair.scores.final >= .5 ? "MODERATE" : "LOW";
  const detail = pair.details;
  $("pair-detail").innerHTML = `<div class="detail-heading"><span>${escapeHTML(shortName(names[pair.a].name, 27))}<br />vs ${escapeHTML(shortName(names[pair.b].name, 27))}</span><strong>${pct(pair.scores.final)}</strong></div>
    ${scoreItems.map(([name, score]) => `<div class="metric-row"><span class="metric-label">${escapeHTML(name)}</span><div class="metric-track"><span style="width:${Math.round(score * 100)}%"></span></div><span class="metric-value">${pct(score)}</span></div>`).join("")}
    <hr class="detail-rule" /><h4 class="detail-subtitle">Common vs unique words</h4><div class="word-counts"><span class="word-pill">Only A <strong>${pair.counts.only_a}</strong></span><span class="word-pill">Shared <strong>${pair.counts.common}</strong></span><span class="word-pill">Only B <strong>${pair.counts.only_b}</strong></span></div>
    ${detail ? `<hr class="detail-rule" /><h4 class="detail-subtitle">Longest identical phrase</h4><div class="quote-panel">${detail.longest_phrase ? `“${escapeHTML(detail.longest_phrase)}”` : "<em>No matching phrase found.</em>"}</div>
    ${detail.sentences.length ? `<hr class="detail-rule" /><h4 class="detail-subtitle">Similar sentences</h4><div class="matched-sentences">${detail.sentences.map(s => `<div class="matched-sentence"><strong>${pct(s.score)} match</strong><div>A: ${escapeHTML(s.a)}</div><div>B: ${escapeHTML(s.b)}</div></div>`).join("")}</div>` : ""}` : '<p class="panel-explainer">Detailed phrase analysis is available for the 12 most similar pairs.</p>'}`;
}
function renderGraph() {
  const data = state.result;
  const n = data.documents.length;
  const clusters = data.graph.clusters;
  const groupFor = new Map(clusters.flatMap((group, i) => group.map(name => [name, i])));
  const colors = ["#7669ed", "#35aeba", "#e2a254", "#ea7f9b", "#7086cf", "#75b079", "#b57cbd", "#8693a8"];
  const width = 420, height = 305, radius = n <= 3 ? 98 : 110;
  const coords = data.documents.map((_, i) => ({ x: width / 2 + radius * Math.cos((2 * Math.PI * i / n) - Math.PI / 2), y: height / 2 + radius * Math.sin((2 * Math.PI * i / n) - Math.PI / 2) }));
  const lines = data.graph.edges.map(edge => {
    const a = coords[edge.a], b = coords[edge.b], x = (a.x+b.x)/2, y=(a.y+b.y)/2;
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#a2a2de" stroke-opacity=".65" stroke-width="${(1.2+edge.score*3).toFixed(1)}"/><rect x="${x-20}" y="${y-9}" width="40" height="18" rx="9" fill="#fff" stroke="#e5e7f1"/><text x="${x}" y="${y+3.2}" text-anchor="middle" font-size="10" fill="#6e6e98" font-weight="700">${Math.round(edge.score*100)}%</text>`;
  }).join("");
  const nodes = data.documents.map((doc,i) => {
    const c=coords[i], cluster=groupFor.get(doc.name) ?? 0, active=clusters[cluster].length > 1;
    return `<circle cx="${c.x}" cy="${c.y}" r="24" fill="${active ? colors[cluster % colors.length] : "#b6bccc"}" stroke="white" stroke-width="4"/><text x="${c.x}" y="${c.y+5}" text-anchor="middle" fill="white" font-size="13" font-weight="800">${i+1}</text><text x="${c.x}" y="${c.y+39}" text-anchor="middle" fill="#6d768d" font-size="10" font-weight="600">${escapeHTML(shortName(doc.name.replace(/\.txt$/i,""), 14))}</text>`;
  }).join("");
  $("graph-viz").innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Graph of documents connected when similarity exceeds the threshold">${lines}${nodes}</svg>`;
  $("cluster-list").innerHTML = clusters.map((cluster, i) => `<div class="cluster-pill"><strong>Group ${i+1}:</strong> ${escapeHTML(cluster.join(", "))}${cluster.length === 1 ? " (isolated)" : ""}</div>`).join("");
}
function renderMatrix() {
  const data = state.result;
  const headers = data.documents.map((doc,i) => `<th title="${escapeHTML(doc.name)}">D${i+1}</th>`).join("");
  const rows = data.matrix.map((scores,i) => `<tr><th title="${escapeHTML(data.documents[i].name)}">D${i+1}</th>${scores.map((score,j) => {
    const alpha = (0.09 + score * 0.58).toFixed(3);
    return `<td class="${i===j?'diagonal':''}" style="${i===j?'':`background:rgba(113,98,237,${alpha});color:${score>.55?'#fff':'#414268'}`}">${Math.round(score*100)}%</td>`;
  }).join("")}</tr>`).join("");
  $("matrix-container").innerHTML = `<table class="matrix-table" aria-label="Document similarity matrix"><thead><tr><th></th>${headers}</tr></thead><tbody>${rows}</tbody></table><p class="panel-explainer">${data.documents.map((doc,i)=>`D${i+1}: ${escapeHTML(doc.name)}`).join(" · ")}</p>`;
}
function attachEvents() {
  $("file-picker").addEventListener("change", async e => { const files = Array.from(e.target.files || []); e.target.value = ""; await addFiles(files); });
  const dropzone = $("dropzone");
  dropzone.addEventListener("click", () => $("file-picker").click());
  dropzone.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); $("file-picker").click(); } });
  ["dragenter", "dragover"].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.remove("dragging"); }));
  dropzone.addEventListener("drop", async event => addFiles(Array.from(event.dataTransfer?.files || [])));
  $("documents").addEventListener("click", event => { const button = event.target.closest("[data-remove]"); if (!button) return; state.documents.splice(Number(button.dataset.remove),1); clearResult(); updateDocuments(); showInputError(""); });
  $("threshold").addEventListener("input", event => { $("threshold-value").textContent = `${event.target.value}%`; if(state.result){ clearResult(); notify("Threshold changed. Re-run analysis to update your results."); } });
  $("demo-button").addEventListener("click", () => { state.documents = examples.map(item => ({ ...item })); clearResult(); showInputError(""); updateDocuments(); notify("3 example documents loaded."); });
  $("paste-button").addEventListener("click",openModal);
  $("close-modal").addEventListener("click",closeModal);
  $("cancel-modal").addEventListener("click",closeModal);
  $("paste-modal").addEventListener("click",e=>{ if(e.target === $("paste-modal"))closeModal(); });
  document.addEventListener("keydown", event => { if(event.key === "Escape" && !$("paste-modal").hidden)closeModal(); });
  $("save-paste").addEventListener("click", () => { try { addDocument($("paste-name").value, $("paste-content").value);closeModal();notify("Text document added."); } catch(error) {$("paste-error").textContent = error.message;$("paste-error").hidden=false;} });
  $("analyze-button").addEventListener("click",analyze);
  $("rerun-button").addEventListener("click",analyze);
  $("pair-list").addEventListener("click", event => { const row=event.target.closest("[data-pair]"); if(!row)return;state.selectedPair=Number(row.dataset.pair);$("pair-list").querySelectorAll("[data-pair]").forEach(button=>{const active=button===row;button.classList.toggle("selected",active);button.setAttribute("aria-pressed",String(active));});renderPairDetail(); });
  $("nav-results").addEventListener("click",event=>{ if(!state.result){event.preventDefault();notify("Run an analysis to view your results.");} });
}
async function checkHealth() {
  try { const response=await fetch("/api/analyze",{method:"GET",cache:"no-store"});if(!response.ok)throw new Error("unavailable"); }
  catch {const status=document.querySelector(".server-status");status.classList.add("offline");status.lastChild.textContent=" Engine unavailable";}
}
attachEvents();
updateDocuments();
checkHealth();
