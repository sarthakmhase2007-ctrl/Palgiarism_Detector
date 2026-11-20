import { loadPyodide } from "./runtime/pyodide.mjs";
import { loadDetector } from "./engine.mjs";

let comparison;
let startup;
function getDetector() {
  if (!startup) {
    startup = fetch(new URL("./detector.json", import.meta.url))
      .then((response) => {
        if (!response.ok) throw new Error("Detector sources are unavailable");
        return response.json();
      })
      .then((sources) =>
        loadDetector(
          loadPyodide,
          new URL("./runtime/", import.meta.url).href,
          sources,
        ),
      );
  }
  return startup;
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "analyze") {
      const detector = await getDetector();
      comparison?.destroy();
      const Constructor = detector.Comparison;
      try {
        comparison = Constructor(JSON.stringify(data.documents));
      } finally {
        Constructor.destroy();
      }
      const progress = (pair, total) =>
        self.postMessage({ type: "progress", pair, total });
      self.postMessage({
        type: "report",
        report: JSON.parse(comparison.analyze(progress)),
      });
    } else if (data.type === "detail") {
      const detail = JSON.parse(comparison.detail(data.a, data.b));
      self.postMessage({ type: "detail", a: data.a, b: data.b, detail });
    } else if (data.type === "threshold") {
      const network = JSON.parse(comparison.network_json(data.threshold));
      self.postMessage({ type: "network", network });
    }
  } catch {
    self.postMessage({ type: "error", operation: data.type });
  }
};
