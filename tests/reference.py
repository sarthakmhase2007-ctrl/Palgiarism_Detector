"""Read comparison fixtures on stdin and evaluate them with the desktop modules."""
import json
import sys
from itertools import combinations
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from graph_cluster import build_graph, build_similarity_matrix, connected_components, verdict, vertex_degrees
from lcs_module import changed_words, lcs_alignment, longest_common_substring, sentence_level_matches
from main import analyze_pair
from preprocessing import preprocess, tokenize


def evaluate(case):
    docs = [preprocess(item["text"]) for item in case["documents"]]
    names = case["names"]
    scores = {(i, j): analyze_pair(docs[i], docs[j]) for i, j in combinations(range(len(docs)), 2)}
    matrix = build_similarity_matrix(names, lambda i, j: scores[i, j]["final"])
    pairs = []
    for (i, j), metrics in scores.items():
        x, y = docs[i]["tokens"], docs[j]["tokens"]
        a, b = set(docs[i]["keywords"]), set(docs[j]["keywords"])
        pairs.append({
            "a": i, "b": j, "scores": metrics, "verdict": verdict(metrics["final"]),
            "detail": {
                "changed": changed_words(x, y, lcs_alignment(x, y)),
                "phrase": longest_common_substring(x, y),
                "matches": sentence_level_matches(docs[i]["sentences"], docs[j]["sentences"], tokenize),
                "keywords": [sorted(a - b), sorted(a & b), sorted(b - a)],
            },
        })
    networks = []
    for threshold in case["thresholds"]:
        graph = build_graph(names, matrix, threshold)
        networks.append({"threshold": threshold, "adjacency": graph, "degrees": vertex_degrees(graph),
                         "groups": connected_components(graph)})
    return {"matrix": matrix, "pairs": pairs, "networks": networks}


if __name__ == "__main__":
    print(json.dumps([evaluate(case) for case in json.load(sys.stdin)]))
