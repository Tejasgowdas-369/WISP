# WISP (Working-set Intelligent Semantic Pruner)

> **A local-first, zero-persistence context compression layer for LLM agents — nothing ever touches disk.**

I completed the core research and initial build for this system back in **January 2026**. Over the last few months, I’ve refined the compression algorithms, optimized the pipeline integrations, and polished the interfaces to make it fully production-ready. Today, in **July 2026**, I am finally opening it up to the public!

I completed the core research and initial build for this system back in January 2026. Over the last few months, I’ve refined the compression algorithms, optimized the pipeline integrations, and polished the interfaces to make it fully production-ready. Today, in July 2026, I am finally opening it up to the public!

WISP sits between raw context sources (RAG chunks, tool outputs, terminal logs, codebases, prose) and your LLM API call. It prunes redundant structures and extracts core information using type-aware algorithms, caches the original in local RAM, and lets you "rehydrate" any compressed section back to full detail on demand.

---

## 🚀 Key Features

1. **Type-Aware Pruning**:
   - **Code**: Reduces code files to signatures and structure (Python AST & Regex JS/TS) while dropping method bodies.
   - **JSON**: Key/value schema pruning, truncates long strings, and collapses uniform arrays of objects.
   - **Prose**: Uses extractive similarity clustering to drop redundant sentences.
   - **RAG Chunks**: Pairwise cosine similarity deduplication.
2. **Dynamic Rehydration**: Inline retrieval allows any truncated block to expand back to its original state.
3. **Command Line Interface (CLI)**: Stream and pipe compression directly in the terminal.
4. **100% Ephemeral**: Zero persistence. All data lives in Python process RAM and React state. Closing the tab or stopping the server destroys all data instantly.
5. **Offline Resilience**: Automatic fallback to pure-Python TF-IDF and character metrics if offline/no model caches.

---

## 🛠️ Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Tejasgowdas-369/WISP.git
cd WISP
```

### Setup Python Backend Dependencies:
```bash
pip install -r backend/requirements.txt
```

### Setup Frontend Web UI Dependencies:
```bash
cd frontend
npm install
cd ..
```

---

## 💻 1. Using WISP via Command Line (CLI)

WISP includes a root-level CLI tool (`wisp.py`) that allows you to run context compression directly in the terminal, pipe inputs, and output to files.

### Basic CLI Usage:
```bash
# Compress Python source code:
python wisp.py --type code --lang python backend/main.py

# Compress Prose text to 30% retention ratio:
python wisp.py --type prose --ratio 0.3 my_document.txt

# Compress and prune a JSON payload, writing output to a new file:
python wisp.py --type json --max-depth 3 --input data.json --output compressed.json
```

### Piping and Stream Integration:
WISP integrates perfectly with terminal streams using standard piping:
```bash
# Pipe terminal log outputs through prose compression:
cat server.log | python wisp.py --type prose --ratio 0.4

# Fetch and compress web content for agent ingestion:
curl -s https://example.com | python wisp.py --type prose --ratio 0.5
```

---

## 📊 2. Using the Web Workspace Dashboard

The WISP web workspace provides a premium glassmorphic dashboard for monitoring compression rates, viewing visual side-by-side diffs, and testing interactive rehydration.

### Start the Backend Server:
```bash
# From the root directory:
python -m uvicorn backend.main:app --port 8420 --reload
```
The backend API and WebSocket server will run on `http://127.0.0.1:8420`.

### Start the Frontend Web UI:
```bash
# In a new terminal window:
cd frontend
npm run dev
```
Open **`http://localhost:5173`** in your browser to access the workspace.

---

