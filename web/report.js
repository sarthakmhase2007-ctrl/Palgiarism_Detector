const element = (id) => document.getElementById(id);
const letter = (index) => String.fromCharCode(65 + index);
export const percent = (value) => (value * 100).toFixed(2) + "%";

function node(tag, text, className) {
  const out = document.createElement(tag);
  if (text !== undefined) out.textContent = text;
  if (className) out.className = className;
  return out;
}

const measures = [
  ["jaccard", "Jaccard"],
  ["ngram", "3-gram Jaccard"],
  ["cosine", "Cosine"],
  ["lcs", "Word order · LCS"],
  ["dice", "Dice"],
  ["overlap", "Overlap"],
];

export class ReportView {
  constructor(send) {
    this.send = send;
    this.details = new Map();
    this.pending = new Set();
    this.picker = element("pair");
    this.picker.addEventListener("change", () =>
      this.showPair(Number(this.picker.value)),
    );
    for (const button of document.querySelectorAll("[data-view]")) {
      button.addEventListener("click", () =>
        this.switchView(button.dataset.view),
      );
    }
    element("threshold").addEventListener("input", (event) => {
      const value = Number(event.target.value);
      element("threshold-value").textContent = value + "%";
      event.target.setAttribute("aria-valuetext", value + " percent");
      this.send({ type: "threshold", threshold: value / 100 });
    });
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    element("graph").append(this.canvas);
    new ResizeObserver(() => this.drawGraph()).observe(element("graph"));
  }

  clear() {
    this.report = null;
    this.details.clear();
    this.pending.clear();
    element("report").hidden = true;
  }

  show(report) {
    this.report = report;
    this.details.clear();
    this.pending.clear();
    const { names, pairs } = report;
    element("report-meta").textContent =
      names.length +
      " documents · " +
      pairs.length +
      (pairs.length === 1 ? " pair compared" : " pairs compared");
    this.picker.replaceChildren(
      ...pairs.map((pair, index) => {
        const option = node("option", names[pair.a] + " / " + names[pair.b]);
        option.value = index;
        return option;
      }),
    );
    element("pair-chooser").hidden = pairs.length === 1;
    element("report").hidden = false;
    const initialThreshold = Math.round(report.network.threshold * 100);
    element("threshold").value = initialThreshold;
    element("threshold-value").textContent = initialThreshold + "%";
    element("threshold").setAttribute(
      "aria-valuetext",
      initialThreshold + " percent",
    );
    this.makeMatrix();
    this.updateNetwork(report.network);
    this.switchView("overview");
    this.showPair(0);
    element("report-title").focus({ preventScroll: true });
    element("report").scrollIntoView({ block: "start" });
  }

  switchView(name) {
    for (const button of document.querySelectorAll("[data-view]")) {
      const active = button.dataset.view === name;
      button.setAttribute("aria-pressed", String(active));
      element(button.dataset.view).hidden = !active;
    }
    element("pair-chooser").hidden =
      name === "collection" || this.report?.pairs.length < 2;
    if (name === "collection") this.drawGraph();
  }

  showPair(index) {
    const { names, pairs } = this.report;
    const pair = pairs[index];
    this.pair = pair;
    element("score-value").textContent = percent(pair.scores.final);
    element("pair-title").textContent = names[pair.a] + " / " + names[pair.b];
    element("verdict").textContent = pair.verdict;
    const bars = measures.map(([key, title]) => {
      const row = node(
        "div",
        undefined,
        "metric" +
          (["dice", "overlap"].includes(key) ? " secondary-metric" : ""),
      );
      const track = node("div", undefined, "track");
      const fill = node("i");
      fill.style.width =
        Math.min(100, Math.max(0, pair.scores[key] * 100)) + "%";
      track.setAttribute("aria-hidden", "true");
      track.append(fill);
      row.append(
        node("span", title),
        track,
        node("span", percent(pair.scores[key])),
      );
      return row;
    });
    element("metrics").replaceChildren(...bars);
    const key = pair.a + "-" + pair.b;
    if (this.details.has(key)) {
      this.renderDetail(this.details.get(key));
      return;
    }
    for (const id of [
      "keyword-counts",
      "phrase",
      "sentence-matches",
      "changed",
    ]) {
      element(id).textContent = "Finding shared passages…";
    }
    if (!this.pending.has(key)) {
      this.pending.add(key);
      this.send({ type: "detail", a: pair.a, b: pair.b });
    }
  }

  receiveDetail(a, b, detail) {
    const key = a + "-" + b;
    this.pending.delete(key);
    this.details.set(key, detail);
    if (this.pair.a === a && this.pair.b === b) this.renderDetail(detail);
  }

  renderDetail(detail) {
    const { a, b } = this.pair;
    const titles = ["Only " + letter(a), "Shared", "Only " + letter(b)];
    element("keyword-counts").replaceChildren(
      ...detail.keywords.map((words, index) => {
        const cell = node("div");
        cell.append(node("strong", words.length), node("span", titles[index]));
        return cell;
      }),
    );
    element("phrase").textContent = detail.phrase.length
      ? "“" + detail.phrase.join(" ") + "”"
      : "No shared phrase.";
    const sentenceRows = detail.matches.map(([left, right, score]) => {
      const row = node("div", undefined, "match-row");
      const first = node("p"),
        second = node("p");
      first.append(node("span", letter(a), "lil-letter"), node("span", left));
      second.append(
        node("span", letter(b), "lil-letter second"),
        node("span", right),
      );
      row.append(
        node("strong", percent(score) + " sentence similarity"),
        first,
        second,
      );
      return row;
    });
    element("sentence-matches").replaceChildren(
      ...(sentenceRows.length
        ? sentenceRows
        : [node("p", "No sentence pair reached 70%.")]),
    );
    element("changed").replaceChildren(
      ...detail.changed.map((words, index) => {
        const col = node("div");
        col.append(
          node("h4", this.report.names[index ? b : a]),
          node("p", words.length ? words.join(" · ") : "All words aligned."),
        );
        return col;
      }),
    );
    element("report-status").textContent =
      "Passage details are ready for " +
      this.report.names[a] +
      " and " +
      this.report.names[b] +
      ".";
  }

  makeMatrix() {
    const { names, matrix } = this.report;
    const table = node("table");
    table.setAttribute(
      "aria-label",
      "Pairwise weighted similarity percentages",
    );
    const header = table.createTHead().insertRow();
    header.append(node("th", ""));
    for (let i = 0; i < names.length; i++) {
      const th = node("th", letter(i));
      th.scope = "col";
      th.title = names[i];
      header.append(th);
    }
    const body = table.createTBody();
    matrix.forEach((values, i) => {
      const tr = body.insertRow();
      const th = node("th", letter(i));
      th.scope = "row";
      th.title = names[i];
      tr.append(th);
      values.forEach((value, j) => {
        const td = tr.insertCell();
        td.textContent = percent(value);
        td.title = names[i] + " / " + names[j] + " · " + percent(value);
        td.style.backgroundColor =
          i === j
            ? "#e9e3ee"
            : "rgba(232, 139, 110, " + (0.08 + value * 0.6) + ")";
      });
    });
    element("matrix").replaceChildren(table);
    element("matrix-key").replaceChildren(
      ...names.map((name, i) => {
        const item = node("div");
        item.append(node("span", letter(i)), document.createTextNode(name));
        return item;
      }),
    );
  }

  updateNetwork(network) {
    if (
      !this.report ||
      Math.round(network.threshold * 100) !== Number(element("threshold").value)
    )
      return;
    this.report.network = network;
    element("groups").replaceChildren(
      ...network.groups.map((members, index) => {
        const group = node("div");
        const memberText = members
          .map(
            (name) =>
              name +
              " (" +
              network.degrees[name] +
              (network.degrees[name] === 1 ? " link)" : " links)"),
          )
          .join(" · ");
        group.append(
          node(
            "strong",
            members.length > 1 ? "Group " + (index + 1) : "Isolated",
          ),
          node("span", memberText),
        );
        return group;
      }),
    );
    const edges = this.report.pairs.filter(
      (pair) => pair.scores.final >= network.threshold,
    );
    const accessible = node(
      "p",
      edges.length
        ? edges
            .map(
              (pair) =>
                this.report.names[pair.a] +
                " and " +
                this.report.names[pair.b] +
                ", " +
                percent(pair.scores.final),
            )
            .join(". ")
        : "No linked pairs.",
      "sr-only",
    );
    element("groups").append(accessible);
    this.drawGraph();
  }

  drawGraph() {
    if (!this.report || element("collection").hidden) return;
    const { names, network } = this.report;
    const width = this.canvas.clientWidth,
      height = this.canvas.clientHeight;
    if (!width || !height) return;
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    const radius = Math.min(width * 0.35, height * 0.34);
    const positions = names.map((_, i) => {
      const angle =
        (2 * Math.PI * i) / names.length +
        (names.length === 2 ? Math.PI : -Math.PI / 2);
      return [
        width / 2 + Math.cos(angle) * radius,
        height / 2 + Math.sin(angle) * radius,
      ];
    });
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#9f6e60";
    names.forEach((name, i) => {
      for (const neighbor of network.adjacency[name]) {
        const j = names.indexOf(neighbor);
        if (j <= i) continue;
        ctx.beginPath();
        ctx.moveTo(...positions[i]);
        ctx.lineTo(...positions[j]);
        ctx.stroke();
      }
    });
    const linked = this.report.pairs.filter(
      (pair) => pair.scores.final >= network.threshold,
    );
    if (linked.length <= 3) {
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const pair of linked) {
        const [ax, ay] = positions[pair.a],
          [bx, by] = positions[pair.b];
        const x = (ax + bx) / 2,
          y = (ay + by) / 2;
        const label = percent(pair.scores.final);
        const w = ctx.measureText(label).width;
        ctx.fillStyle = "#fff9f3";
        ctx.fillRect(x - w / 2 - 3, y - 9, w + 6, 18);
        ctx.fillStyle = "#714a3d";
        ctx.fillText(label, x, y + 0.5);
      }
    }
    positions.forEach(([x, y], i) => {
      const connected = network.degrees[names[i]] > 0;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fillStyle = connected ? "#ffd2bd" : "#e7e1eb";
      ctx.fill();
      ctx.strokeStyle = connected ? "#9b6454" : "#998b9f";
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#44343e";
      ctx.font = "600 13px monospace";
      ctx.fillText(letter(i), x, y + 0.5);
    });
  }
}
