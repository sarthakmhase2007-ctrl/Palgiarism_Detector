"""Vercel HTTP adapter for the project's unchanged plagiarism algorithms.

No new similarity formula is implemented here: scoring and graph analysis call
existing functions in main.py and graph_cluster.py.
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

os.environ.setdefault("MPLBACKEND", "Agg")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import analyze_pair  # noqa: E402
from preprocessing import preprocess  # noqa: E402
from lcs_module import (lcs_alignment, changed_words, longest_common_substring,
                        sentence_level_matches)  # noqa: E402
from graph_cluster import (build_similarity_matrix, build_graph,
                           connected_components, vertex_degrees, verdict)  # noqa: E402
from preprocessing import tokenize  # noqa: E402

MAX_DOCUMENTS = 8
MAX_WORDS = 850
MAX_CHARACTERS = 20_000
MAX_REQUEST_BYTES = 250_000


def analyze_documents(payload):
    """Validate browser input, then invoke the existing project algorithms."""
    if not isinstance(payload, dict):
        raise ValueError("Expected a JSON object.")
    submitted = payload.get("documents")
    if not isinstance(submitted, list) or not 2 <= len(submitted) <= MAX_DOCUMENTS:
        raise ValueError(f"Upload between 2 and {MAX_DOCUMENTS} text documents.")
    threshold = payload.get("threshold", 0.5)
    if isinstance(threshold, bool) or not isinstance(threshold, (int, float)) or not 0 <= threshold <= 1:
        raise ValueError("Threshold must be a number between 0 and 1.")

    names, docs = [], []
    for index, item in enumerate(submitted, 1):
        if not isinstance(item, dict):
            raise ValueError(f"Document {index} must be an object.")
        name, content = item.get("name"), item.get("text")
        if not isinstance(name, str) or not name.strip() or len(name) > 120:
            raise ValueError(f"Document {index} needs a name of at most 120 characters.")
        if not isinstance(content, str) or not content.strip():
            raise ValueError(f"Document {index} is empty.")
        if len(content) > MAX_CHARACTERS:
            raise ValueError(f"{name} exceeds {MAX_CHARACTERS:,} characters.")
        data = preprocess(content)
        if not data["tokens"]:
            raise ValueError(f"{name} contains no comparable words.")
        if len(data["tokens"]) > MAX_WORDS:
            raise ValueError(f"{name} exceeds {MAX_WORDS} words. Use shorter text documents.")
        if name.casefold() in {n.casefold() for n in names}:
            raise ValueError("Each document needs a unique filename.")
        names.append(name)
        docs.append(data)

    cache = {}

    def score_fn(i, j):
        scores = analyze_pair(docs[i], docs[j])
        cache[(i, j)] = scores
        return scores["final"]

    matrix = build_similarity_matrix(names, score_fn)
    graph = build_graph(names, matrix, threshold)
    components = connected_components(graph)

    ranked = sorted(cache, key=lambda pair: cache[pair]["final"], reverse=True)
    pairs = []
    for rank, (i, j) in enumerate(ranked):
        scores = cache[(i, j)]
        keywords_a, keywords_b = set(docs[i]["keywords"]), set(docs[j]["keywords"])
        pair = {
            "a": i, "b": j, "scores": scores,
            "verdict": verdict(scores["final"]),
            "counts": {"only_a": len(keywords_a - keywords_b),
                       "common": len(keywords_a & keywords_b),
                       "only_b": len(keywords_b - keywords_a)},
        }
        # Match the existing report's details without changing its matching methods.
        if rank < 12:
            x, y = docs[i]["tokens"], docs[j]["tokens"]
            alignment = lcs_alignment(x, y)
            changed_a, changed_b = changed_words(x, y, alignment)
            matches = sentence_level_matches(docs[i]["sentences"],
                                             docs[j]["sentences"], tokenize)
            pair["details"] = {
                "longest_phrase": " ".join(longest_common_substring(x, y)),
                "only_a_words": changed_a[:16],
                "only_b_words": changed_b[:16],
                "sentences": [{"a": left, "b": right, "score": score}
                              for left, right, score in matches[:8]],
            }
        pairs.append(pair)

    return {
        "documents": [{"name": name, "words": len(doc["tokens"]),
                       "keywords": len(set(doc["keywords"]))}
                      for name, doc in zip(names, docs)],
        "threshold": threshold,
        "matrix": matrix,
        "pairs": pairs,
        "graph": {"adjacency": graph,
                  "degrees": vertex_degrees(graph),
                  "clusters": components,
                  "edges": [{"a": p["a"], "b": p["b"],
                             "score": p["scores"]["final"]}
                            for p in pairs if p["scores"]["final"] >= threshold]},
    }


class handler(BaseHTTPRequestHandler):
    """Vercel recognizes this standard-library Python function entrypoint."""

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.send_json(200, {"status": "ok", "service": "Originality Lab analysis API"})

    def do_POST(self):
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
            return self.send_json(415, {"error": "Send application/json."})
        try:
            size = int(self.headers.get("Content-Length", ""))
        except (ValueError, TypeError):
            return self.send_json(411, {"error": "A valid Content-Length is required."})
        if size < 1:
            return self.send_json(400, {"error": "Request body is empty."})
        if size > MAX_REQUEST_BYTES:
            return self.send_json(413, {"error": "Request is too large."})
        try:
            data = json.loads(self.rfile.read(size).decode("utf-8"))
            answer = analyze_documents(data)
        except (ValueError, UnicodeError, json.JSONDecodeError) as exc:
            return self.send_json(400, {"error": str(exc)})
        except Exception:
            # Never reveal internal paths, tracebacks or document content to clients.
            return self.send_json(500, {"error": "Analysis could not be completed. Try shorter documents."})
        self.send_json(200, answer)
