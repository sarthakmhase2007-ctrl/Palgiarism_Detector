"""Build a self-hosted static site from the repository's Python detector."""
import ast
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
WEB = ROOT / "web"
PACKAGES = ROOT / "node_modules"


def python_parts(filename, *, imports=(), constants=(), functions=()):
    """Copy whole definitions verbatim. Desktop graphics are outside the web runtime."""
    source = (ROOT / filename).read_text(encoding="utf-8")
    parts = []
    settings = {}
    copied = set()
    for node in ast.parse(source).body:
        if isinstance(node, ast.ImportFrom) and node.module in imports:
            parts.append(ast.get_source_segment(source, node))
        elif isinstance(node, ast.FunctionDef) and node.name in functions:
            copied.add(node.name)
            parts.append(ast.get_source_segment(source, node))
        elif isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name in constants:
                settings[name] = ast.literal_eval(node.value)
                parts.append(ast.get_source_segment(source, node))
    if copied != set(functions) or set(settings) != set(constants):
        raise ValueError(f"A required original definition is missing in {filename}")
    return "\n\n".join(parts) + "\n", settings


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def build():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    for path in WEB.iterdir():
        if path.is_file() and path.suffix in {".html", ".css", ".js", ".mjs", ".svg"}:
            shutil.copyfile(path, DIST / path.name)

    modules = {name: (ROOT / name).read_text(encoding="utf-8") for name in
               ("preprocessing.py", "set_similarity.py", "lcs_module.py")}
    modules["main.py"], settings = python_parts(
        "main.py", imports=("set_similarity", "lcs_module"),
        constants=("WEIGHTS", "THRESHOLD"), functions=("analyze_pair",))
    modules["graph_cluster.py"], _ = python_parts(
        "graph_cluster.py", imports=("collections", "itertools"),
        functions=("number_of_pairs", "build_similarity_matrix", "build_graph",
                   "vertex_degrees", "connected_components", "verdict"))
    modules["web_report.py"] = (WEB / "web_report.py").read_text(encoding="utf-8")
    write_json(DIST / "detector.json", modules)

    config = json.loads((WEB / "limits.json").read_text())
    config.update(threshold=settings["THRESHOLD"], weights=settings["WEIGHTS"])
    config["samples"] = [{"name": path.name, "text": path.read_text(encoding="utf-8").strip()}
                         for path in sorted((ROOT / "sample_docs").glob("*.txt"))]
    (DIST / "config.js").write_text("export default " + json.dumps(config) + ";\n")

    runtime = DIST / "runtime"
    runtime.mkdir(exist_ok=True)
    shutil.copyfile(WEB / "licenses" / "Pyodide-LICENSE.txt", runtime / "LICENSE.txt")
    for name in ("pyodide.mjs", "pyodide.asm.js", "pyodide.asm.wasm",
                 "python_stdlib.zip", "pyodide-lock.json"):
        shutil.copyfile(PACKAGES / "pyodide" / name, runtime / name)

    fonts = DIST / "fonts"
    fonts.mkdir(exist_ok=True)
    for folder, name in [("@fontsource-variable/dm-sans", "dm-sans-latin-wght-normal"),
                         ("@fontsource/instrument-serif", "instrument-serif-latin-400-italic")]:
        package = PACKAGES / folder
        shutil.copyfile(package / "files" / f"{name}.woff2", fonts / f"{name}.woff2")
        shutil.copyfile(package / "LICENSE", fonts / f"{package.name}-LICENSE.txt")
    print("Built Margin in dist/ with the original detector and local Python runtime.")


if __name__ == "__main__":
    build()
