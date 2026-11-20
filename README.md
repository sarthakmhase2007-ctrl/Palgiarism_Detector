# Plagiarism & Document Similarity Detector (Discrete Mathematics Mini Project)

## Margin web app

Margin runs the project's Python detector in a browser worker. Paste text or import two to eight UTF-8 `.txt` files, with up to 1,500 words per document. **Load example** compares the two Mumbai monsoon samples. Their weighted similarity is **76.46%**.

The report shows all six metrics, matching sentences, the longest shared phrase, keyword overlap, a pairwise matrix and document clusters. Adjust the link threshold in **Collection** to explore different groups. Document contents stay in the browser.

### Deploy on Vercel

Import this repository from GitHub. Use the repository root (`./`) and the **Other** framework preset. The checked-in `vercel.json` sets the build command to `npm run build` and the output directory to `dist`. The app serves its Python runtime and fonts from the same deployment.

### Run locally

With Node.js, npm and Python 3.9+ installed, run:

```sh
npm ci
npm run build
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000`. For the parity checks, install the desktop program's plotting dependency with `python3 -m pip install matplotlib`, then run `npm test` after building.

The build copies the original preprocessing, set similarity and LCS modules, and extracts the original scoring and graph definitions. The browser executes those definitions through Pyodide. The web adapter formats their return values for the interface.

## Desktop program

Install `matplotlib`, then run `python main.py` to analyze the text files in `sample_docs/`, print the report and save the four charts in `output/`. The folder, threshold and chart display settings are near the top of `main.py`. If the folder has fewer than two text files, the desktop program writes its three built-in samples.

| Member | File | Discrete Maths concepts |
|---|---|---|
| 1 | preprocessing.py | Sequences, sets, n-grams (shingles) |
| 2 | set_similarity.py | Set operations, Jaccard, Dice, Overlap, multisets, cosine, inclusion-exclusion |
| 3 | lcs_module.py | LCS (recurrence + DP), set difference/complement of matched positions, partition principle, Cartesian product X x Y, injective + order-preserving function |
| 4 | graph_cluster.py | Graphs, BFS, components, handshaking lemma, relations, C(n,2) + 4 matplotlib charts |
| All | main.py | Integration (weighted score + report) |

Final score = 0.20*Jaccard + 0.25*3-gram Jaccard + 0.15*Cosine + 0.40*LCS

Charts: 01 similarity graph | 02 metric comparison | 03 common vs unique words | 04 Venn diagram
