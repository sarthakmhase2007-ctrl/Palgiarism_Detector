import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadPyodide } from "pyodide";
import { loadDetector } from "../web/engine.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const file = (name) => readFile(path.join(root, name), "utf8");
const samples = await Promise.all(
  ["doc1.txt", "doc4.txt", "doc6.txt"].map(async (name) => ({
    name,
    text: await file("sample_docs/" + name),
  })),
);
function fixture(label, texts, names = texts.map((_, i) => "Text " + (i + 1))) {
  return {
    label,
    names,
    thresholds: [0, 0.25, 0.5, 0.7, 1],
    documents: texts.map((text, i) => ({ name: names[i], text })),
  };
}
const examples = [
  fixture(
    "three repository samples",
    samples.map((doc) => doc.text),
    samples.map((doc) => doc.name),
  ),
  fixture("short and stopword-only documents", [
    "a",
    "the",
    "two words",
    "word",
  ]),
  fixture("repetition, order and alignment ties", [
    "red red green blue",
    "green RED blue red",
    "red red green blue",
    "stone glass",
  ]),
  fixture("punctuation, Unicode and sentence splits", [
    "Café कोंकण. Train 42! Rain?",
    "CAFE train 42. rain!",
    "42… New\nline.",
  ]),
  fixture(
    "same-named files",
    ["word", "word", "word order"],
    ["report.txt", "report (2).txt", "report (3).txt"],
  ),
  fixture("eight documents, including isolated nodes", [
    "muddy river bank",
    "the bank of a river",
    "local train is late",
    "local train is late",
    "dry desert sand",
    "sand and dunes",
    "little scarlet robin",
    "deep blue ocean",
  ]),
  fixture("empty token sets preserve the desktop conventions", [
    "?!",
    "…",
    "ordinary words",
  ]),
  fixture("word-limit boundary", ["pixel ".repeat(1500), "pixel"]),
];
examples[4].documents.forEach((doc) => {
  doc.name = "report.txt";
});
const references = JSON.parse(
  execFileSync("python3", ["tests/reference.py"], {
    cwd: root,
    input: JSON.stringify(examples),
    encoding: "utf8",
    env: { ...process.env, MPLBACKEND: "Agg" },
  }),
);
const sources = JSON.parse(await file("dist/detector.json"));
const detector = await loadDetector(
  loadPyodide,
  path.join(root, "dist/runtime/"),
  sources,
);
const Constructor = detector.Comparison;
function rounded(value) {
  return JSON.parse(
    JSON.stringify(value, (_, v) =>
      typeof v === "number" ? Number(v.toFixed(12)) : v,
    ),
  );
}

for (const [index, sample] of examples.entries()) {
  test(sample.label, () => {
    const comparison = Constructor(JSON.stringify(sample.documents));
    try {
      const progress = [];
      const actual = JSON.parse(
        comparison.analyze((i, n) => progress.push([i, n])),
      );
      const expected = references[index];
      assert.deepEqual(actual.names, sample.names);
      assert.deepEqual(rounded(actual.matrix), rounded(expected.matrix));
      assert.equal(actual.pairs.length, expected.pairs.length);
      assert.deepEqual(
        progress,
        expected.pairs.map((_, i) => [i + 1, expected.pairs.length]),
      );
      assert.deepEqual(actual.network, expected.networks[2]);
      for (const [i, pair] of actual.pairs.entries()) {
        if (i) assert.ok(actual.pairs[i - 1].scores.final >= pair.scores.final);
        const ref = expected.pairs.find(
          (p) => p.a === pair.a && p.b === pair.b,
        );
        assert.deepEqual(rounded(pair.scores), rounded(ref.scores));
        assert.equal(pair.verdict, ref.verdict);
        assert.deepEqual(
          JSON.parse(comparison.detail(pair.a, pair.b)),
          ref.detail,
        );
      }
      for (const network of expected.networks) {
        assert.deepEqual(
          JSON.parse(comparison.network_json(network.threshold)),
          network,
        );
      }
    } finally {
      comparison.destroy();
    }
  });
}
