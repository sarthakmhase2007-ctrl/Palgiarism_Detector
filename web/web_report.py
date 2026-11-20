"""Translate the existing detector's results into the browser's report."""
import json
from pathlib import PurePosixPath

from graph_cluster import (build_graph, build_similarity_matrix, connected_components,
                           number_of_pairs, verdict, vertex_degrees)
from lcs_module import (changed_words, lcs_alignment, longest_common_substring,
                        sentence_level_matches)
from main import THRESHOLD, analyze_pair
from preprocessing import preprocess, tokenize


def unique_names(documents):
    names = []
    for item in documents:
        name = item["name"]
        path = PurePosixPath(name)
        count = 1
        while name in names:
            count += 1
            name = f"{path.stem} ({count}){path.suffix}"
        names.append(name)
    return names


class Comparison:
    def __init__(self, documents_json):
        documents = json.loads(documents_json)
        self.names = unique_names(documents)
        self.docs = [preprocess(item["text"]) for item in documents]

    def analyze(self, progress):
        pairs = []
        total = number_of_pairs(len(self.docs))

        def score(i, j):
            progress(len(pairs) + 1, total)
            measures = analyze_pair(self.docs[i], self.docs[j])
            pairs.append({"a": i, "b": j, "scores": measures, "verdict": verdict(measures["final"])})
            return measures["final"]

        self.matrix = build_similarity_matrix(self.names, score)
        return json.dumps({
            "names": self.names,
            "matrix": self.matrix,
            "pairs": sorted(pairs, key=lambda item: item["scores"]["final"], reverse=True),
            "network": self.network(THRESHOLD),
        })

    def network(self, threshold):
        graph = build_graph(self.names, self.matrix, threshold)
        return {"threshold": threshold, "adjacency": graph, "degrees": vertex_degrees(graph),
                "groups": connected_components(graph)}

    def network_json(self, threshold):
        return json.dumps(self.network(threshold))

    def detail(self, i, j):
        a, b = self.docs[i], self.docs[j]
        x, y = a["tokens"], b["tokens"]
        alignment = lcs_alignment(x, y)
        changed_a, changed_b = changed_words(x, y, alignment)
        keys_a, keys_b = set(a["keywords"]), set(b["keywords"])
        return json.dumps({
            "phrase": longest_common_substring(x, y),
            "changed": [changed_a, changed_b],
            "matches": sentence_level_matches(a["sentences"], b["sentences"], tokenize),
            "keywords": [sorted(keys_a - keys_b), sorted(keys_a & keys_b), sorted(keys_b - keys_a)],
        })
