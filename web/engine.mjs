// This entry point is shared by the real Web Worker and the parity tests.
export async function loadDetector(loadPyodide, indexURL, sources) {
  const python = await loadPyodide({ indexURL });
  const directory = "/home/pyodide/margin";
  python.FS.mkdirTree(directory);
  for (const [name, source] of Object.entries(sources)) {
    python.FS.writeFile(directory + "/" + name, source, { encoding: "utf8" });
  }
  python.runPython("import sys\nsys.path.insert(0, '/home/pyodide/margin')");
  return python.pyimport("web_report");
}
