import config from "./config.js";
import { addIcons } from "./icons.js";
import { ReportView } from "./report.js";

const byId = (id) => document.getElementById(id);
const form = byId("compare-form");
const editors = byId("editors");
const cards = () => [...editors.children];
const wordCount = (text) =>
  (text.toLowerCase().match(/[a-z0-9]+/g) || []).length;
const countLabel = (count) =>
  count.toLocaleString() + (count === 1 ? " word" : " words");
const reads = new WeakMap();
let serial = 0;
let worker = null;
let running = false;
const report = new ReportView((message) => worker?.postMessage(message));
addIcons(document);
byId("word-limit").textContent = config.maxWords.toLocaleString("en-US");

function feedback(message = "", error = false) {
  const region = byId("feedback");
  region.textContent = message;
  region.hidden = !message;
  region.classList.toggle("info", !error);
}

function setRunning(value) {
  running = value;
  byId("run").querySelector("span").textContent = value
    ? "Cancel comparison"
    : "Compare documents";
  form.setAttribute("aria-busy", String(value));
}

function resetAnalysis() {
  worker?.terminate();
  worker = null;
  report.clear();
  setRunning(false);
  feedback();
}

function fieldMessage(card, message = "") {
  const field = card.querySelector("textarea");
  const notice = card.querySelector(".field-error");
  notice.textContent = message;
  notice.hidden = !message;
  field.setAttribute("aria-invalid", String(Boolean(message)));
  card.classList.toggle("invalid", Boolean(message));
}

function validation(text) {
  if (!text.trim()) return "Add some text or import a .txt file.";
  if (text.length > config.maxCharacters)
    return (
      "This document exceeds the " +
      config.maxCharacters.toLocaleString() +
      "-character limit."
    );
  const count = wordCount(text);
  if (!count)
    return "Add text containing English letters or digits so the detector has words to compare.";
  if (count > config.maxWords)
    return (
      "Use up to " +
      config.maxWords.toLocaleString() +
      " words in each document."
    );
  return "";
}

function refreshCount(card) {
  const text = card.querySelector("textarea").value;
  const count = wordCount(text);
  card.querySelector(".word-count").textContent = countLabel(count);
  fieldMessage(
    card,
    count > config.maxWords || text.length > config.maxCharacters
      ? validation(text)
      : "",
  );
}

function refreshLabels() {
  const list = cards();
  list.forEach((card, index) => {
    const char = String.fromCharCode(65 + index);
    const label = "Document " + char;
    card.querySelector("label").textContent = label;
    card.querySelector(".badge").textContent = char;
    card.querySelector("textarea").placeholder =
      index === 0
        ? "Paste your source text here…"
        : "Paste text to compare here…";
    card
      .querySelector(".import")
      .setAttribute("aria-label", "Import a .txt file for " + label);
    const remove = card.querySelector(".remove");
    remove.hidden = list.length <= 2;
    remove.setAttribute("aria-label", "Remove " + label);
  });
  byId("doc-count").textContent =
    list.length + " / " + config.maxDocuments + " documents";
  byId("add").disabled = list.length >= config.maxDocuments;
}

async function importFile(card, files) {
  const file = files[0];
  const version = (reads.get(card) || 0) + 1;
  reads.set(card, version);
  if (!file) return;
  if (files.length !== 1 || !/\.txt$/i.test(file.name)) {
    fieldMessage(card, "Choose one plain-text .txt file for this document.");
    return;
  }
  if (file.size > config.maxCharacters * 4) {
    fieldMessage(card, "This file is too large. Import a shorter excerpt.");
    return;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
    if (!card.isConnected || reads.get(card) !== version) return;
    const message = validation(text);
    if (message) {
      fieldMessage(card, message);
      return;
    }
    resetAnalysis();
    card.querySelector("textarea").value = text;
    card.querySelector(".source-name").textContent = file.name;
    refreshCount(card);
    feedback("Imported " + file.name + ".");
  } catch {
    if (card.isConnected && reads.get(card) === version)
      fieldMessage(
        card,
        "Save the file as UTF-8 plain text and import it again.",
      );
  }
}

function newCard(doc = {}) {
  const card =
    byId("editor-template").content.firstElementChild.cloneNode(true);
  const id = "document-" + ++serial;
  const field = card.querySelector("textarea"),
    input = card.querySelector(".file-input");
  field.id = id;
  const error = card.querySelector(".field-error");
  error.id = id + "-error";
  field.setAttribute("aria-describedby", error.id + " " + id + "-count");
  card.querySelector(".word-count").id = id + "-count";
  card.querySelector("label").htmlFor = id;
  field.value = doc.text || "";
  card.querySelector(".source-name").textContent = doc.name || "";
  card.querySelector(".import").addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    importFile(card, [...input.files]);
    input.value = "";
  });
  field.addEventListener("input", () => {
    reads.set(card, (reads.get(card) || 0) + 1);
    if (worker || !byId("feedback").hidden) resetAnalysis();
    if (!field.value) card.querySelector(".source-name").textContent = "";
    refreshCount(card);
  });
  card.querySelector(".remove").addEventListener("click", () => {
    resetAnalysis();
    card.remove();
    refreshLabels();
    byId("add").focus();
  });
  card.addEventListener("dragover", (event) => {
    if (event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
      card.classList.add("drop");
    }
  });
  card.addEventListener("dragleave", (event) => {
    if (!card.contains(event.relatedTarget)) card.classList.remove("drop");
  });
  card.addEventListener("drop", (event) => {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    card.classList.remove("drop");
    importFile(card, [...event.dataTransfer.files]);
  });
  addIcons(card);
  editors.append(card);
  refreshCount(card);
  refreshLabels();
  return field;
}

function loadExample() {
  resetAnalysis();
  editors.replaceChildren();
  const byName = new Map(config.samples.map((doc) => [doc.name, doc]));
  const selected = [byName.get("doc4.txt"), byName.get("doc6.txt")];
  const samples = selected.every(Boolean)
    ? selected
    : config.samples.slice(0, 2);
  for (const doc of samples) newCard(doc);
  while (cards().length < 2) newCard();
  feedback(
    "The example is ready. Compare the documents to see their shared passages.",
  );
}

byId("sample").addEventListener("click", () => {
  if (cards().some((card) => card.querySelector("textarea").value.trim()))
    byId("replace-dialog").showModal();
  else loadExample();
});
byId("keep").addEventListener("click", () => byId("replace-dialog").close());
byId("replace").addEventListener("click", () => {
  byId("replace-dialog").close();
  loadExample();
});
byId("add").addEventListener("click", () => {
  if (cards().length >= config.maxDocuments) return;
  resetAnalysis();
  newCard().focus();
});

function engineFailed() {
  resetAnalysis();
  feedback(
    "The comparison was interrupted. Try again to reload the local engine, or use a shorter excerpt.",
    true,
  );
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (running) {
    resetAnalysis();
    feedback("Comparison cancelled. Your documents are ready to edit.");
    return;
  }
  const documents = [];
  let firstInvalid;
  for (const card of cards()) {
    const field = card.querySelector("textarea");
    const message = validation(field.value);
    fieldMessage(card, message);
    if (message && !firstInvalid) firstInvalid = field;
    documents.push({
      name:
        card.querySelector(".source-name").textContent ||
        card.querySelector("label").textContent,
      text: field.value,
    });
  }
  if (firstInvalid) {
    firstInvalid.focus();
    feedback("Check the highlighted documents.", true);
    return;
  }
  resetAnalysis();
  setRunning(true);
  feedback("Starting the local Python engine…");
  try {
    const current = new Worker(
      new URL("./analysis-worker.js", import.meta.url),
      { type: "module" },
    );
    worker = current;
    current.onmessage = ({ data }) => {
      if (worker !== current) return;
      switch (data.type) {
        case "progress":
          feedback("Comparing pair " + data.pair + " of " + data.total + "…");
          break;
        case "report":
          setRunning(false);
          feedback();
          report.show(data.report);
          break;
        case "detail":
          report.receiveDetail(data.a, data.b, data.detail);
          break;
        case "network":
          report.updateNetwork(data.network);
          break;
        case "error":
          engineFailed();
          break;
      }
    };
    current.onerror = () => {
      if (worker === current) engineFailed();
    };
    current.onmessageerror = current.onerror;
    current.postMessage({ type: "analyze", documents });
  } catch {
    engineFailed();
  }
});

const metricNames = {
  jaccard: "Keyword overlap · Jaccard",
  ngram: "Three-word phrases · Jaccard",
  cosine: "Word frequency · Cosine",
  lcs: "Word order · LCS",
};
for (const [key, weight] of Object.entries(config.weights)) {
  const row = document.createElement("div"),
    label = document.createElement("span"),
    value = document.createElement("strong");
  label.textContent = metricNames[key] || key;
  value.textContent = Math.round(weight * 100) + "%";
  row.append(label, value);
  byId("method-weights").append(row);
}
for (const id of ["method-open", "hero-method"])
  byId(id).addEventListener("click", () => byId("method-dialog").showModal());
byId("method-close").addEventListener("click", () =>
  byId("method-dialog").close(),
);
byId("method-done").addEventListener("click", () => {
  byId("method-dialog").close();
  byId("desk-heading").focus();
});
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
newCard();
newCard();
