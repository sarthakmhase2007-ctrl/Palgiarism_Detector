# Originality Lab — Web interface

A mobile-friendly website for the **existing** Python Plagiarism & Document Similarity Detector. The underlying `main.py`, `preprocessing.py`, `set_similarity.py`, `lcs_module.py` and `graph_cluster.py` remain unchanged.

## What it does

- Upload 2–8 `.txt` files, or paste document content directly.
- Compare all document pairs using the project's exact formula: `0.20*Jaccard + 0.25*3-gram Jaccard + 0.15*Cosine + 0.40*LCS`.
- Inspect all six raw metrics (Jaccard, Dice, Overlap, Cosine, 3-gram, LCS) and the weighted score.
- View matching sentences, longest identical word sequence, common/unique keywords, the symmetric similarity matrix, and BFS graph clusters.
- Change the graph threshold (default 50%). The original console scripts and saved matplotlib charts still work separately.

The website **does not** check online sources, store uploads, perform AI/semantic similarity, or establish plagiarism as fact. It processes text transiently in server memory and returns JSON. Avoid submitting confidential content unless you trust your host.

## Run locally

1. Install Python 3.12 and `pip install -r requirements.txt` (the original algorithm uses matplotlib / NumPy).
2. Run `python dev_server.py`.
3. Open `http://127.0.0.1:8000` (do not open `index.html` directly; the API requires a running server).
4. Click **Load example** and **Run analysis**.
5. Run regression tests: `python -m unittest discover -s tests -v`.

## Deploy on Vercel (manually)

1. Push or merge these files to `main` in `raaj-2222/Palgiarism_Detector`.
2. Vercel Dashboard → **Add New** → **Project** → import that GitHub repository.
3. Keep **Root Directory** as `./` (repo root). Use the **Other** framework preset if a choice is offered. **Do not set a Build Command or Output Directory.**
4. Click **Deploy**. Vercel serves `index.html`, `style.css`, `app.js` as static files and `api/analyze.py` as a Python Function at `/api/analyze`.
5. Verify `/api/analyze` returns a JSON health response, then use **Load example → Run analysis** on the live site. If deployment fails, inspect build logs for Python runtime/dependency errors.

No API keys, Firebase, databases, or paid services are required for this basic web version. Normal Vercel function and bandwidth limits still apply.

## Input restrictions

Up to 8 documents, up to 850 words and 20,000 characters each. These limits protect the LCS dynamic-programming implementation from expensive requests on a serverless function. `.txt` is the supported file type; browser-side paste is also supported. Existing comparison logic and score weights are unchanged. The website shows detailed sentence matches for the top 12 pairs to bound runtime.

## Architecture

- `index.html`, `style.css`, `app.js`, `favicon.svg`: dependency-free responsive frontend.
- `api/analyze.py`: HTTP JSON adapter with validation. Calls functions from the unchanged Python modules.
- `dev_server.py`: local HTTP server using the **same API handler** as Vercel.
- `tests/test_web.py`: validation and algorithm regression checks.
- `.python-version`, `requirements.txt`: Vercel runtime / existing visualization dependency.
