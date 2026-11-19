"""Regression tests for the web adapter; run: python -m unittest discover -s tests."""
import unittest

from api.analyze import analyze_documents, MAX_DOCUMENTS
from main import analyze_pair
from preprocessing import preprocess


class WebAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.a = "The cat sat on the mat and watched the birds."
        self.b = "The cat sat on the mat and watched the birds."
        self.c = "Mumbai has heavy rainfall in the monsoon season."

    def analyze(self, docs, threshold=0.5):
        return analyze_documents({"documents": [
            {"name": f"doc{i + 1}.txt", "text": text} for i, text in enumerate(docs)
        ], "threshold": threshold})

    def test_identical_documents_use_original_scoring(self):
        result = self.analyze([self.a, self.b])
        expected = analyze_pair(preprocess(self.a), preprocess(self.b))
        self.assertEqual(result["pairs"][0]["scores"], expected)
        self.assertAlmostEqual(result["pairs"][0]["scores"]["final"], 1.0)
        self.assertEqual(len(result["graph"]["edges"]), 1)
        self.assertEqual(len(result["graph"]["clusters"]), 1)

    def test_multiple_documents_matrix_and_graph(self):
        result = self.analyze([self.a, self.b, self.c])
        self.assertEqual(len(result["pairs"]), 3)
        self.assertEqual(len(result["matrix"]), 3)
        self.assertEqual(result["matrix"][0][1], result["matrix"][1][0])
        self.assertTrue(all(result["matrix"][i][i] == 1 for i in range(3)))
        self.assertEqual(sum(len(g) for g in result["graph"]["clusters"]), 3)
        self.assertEqual(len(result["graph"]["edges"]), 1)

    def test_threshold_affects_clusters_not_scores(self):
        low = self.analyze([self.a, self.b, self.c], 0)
        high = self.analyze([self.a, self.b, self.c], 1)
        self.assertEqual(low["matrix"], high["matrix"])
        self.assertEqual(len(low["graph"]["edges"]), 3)
        self.assertEqual(len(high["graph"]["edges"]), 1)

    def test_reject_empty_input(self):
        with self.assertRaisesRegex(ValueError, "between 2"):
            analyze_documents({"documents": []})

    def test_reject_duplicate_names(self):
        with self.assertRaisesRegex(ValueError, "unique"):
            analyze_documents({"documents": [
                {"name": "Same.txt", "text": self.a},
                {"name": "same.TXT", "text": self.b}]})

    def test_reject_too_many(self):
        with self.assertRaisesRegex(ValueError, "between 2"):
            self.analyze([self.a] * (MAX_DOCUMENTS + 1))

    def test_reject_nonnumeric_threshold(self):
        with self.assertRaisesRegex(ValueError, "Threshold"):
            analyze_documents({"documents": [
                {"name": "a", "text": self.a}, {"name": "b", "text": self.b}],
                "threshold": "0.5"})

    def test_reject_uncomparable_content(self):
        with self.assertRaisesRegex(ValueError, "no comparable words"):
            self.analyze([self.a, "!!!..."])

    def test_longest_phrase_and_sentence_matches(self):
        pair = self.analyze([self.a, self.b])["pairs"][0]
        self.assertIn("cat sat on the mat", pair["details"]["longest_phrase"])
        self.assertTrue(pair["details"]["sentences"])


if __name__ == "__main__":
    unittest.main()
