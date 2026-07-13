# WISP (Working-set Intelligent Semantic Pruner)

A local-first, zero-persistence context compression layer for LLM agents — nothing ever touches disk. 

WISP sits between raw context sources (RAG chunks, tool outputs, terminal outputs, source code, prose logs) and your LLM API call. It prunes redundant structures and extracts the core information using type-aware algorithms, caches the original representation *in RAM only*, and can "rehydrate" any compressed section back to full detail on demand.

---

## Key Core Features

1. **100% Local Processing**: All compression, de-deduplication, token estimation, and memory stores run in-process on `127.0.0.1:8420`.
2. **Zero Disk Writing**: No SQLite databases, log files, `.cache` directories, or browser storage APIs (no `localStorage`, `sessionStorage`, or cookies) are utilized.
3. **Data Dies on Close**: The moment you stop the FastAPI server (Ctrl+C), close the browser tab, or click **Wipe Now**, all active sessions are instantly wiped from RAM and cannot be recovered.
4. **Offline Resilience**: Features fallback pure-Python BPE token estimators and TF-IDF sentence similarity vectorizers so the tool functions offline without requiring sentence-transformer downloads.

---

## Getting Started

Follow the simple setup steps below to launch both the backend and frontend.

### 1. Start the Backend

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the FastAPI development server:
   ```bash
   uvicorn main:app --port 8420 --reload
   ```

The backend API runs on `http://127.0.0.1:8420`.

### 2. Start the Frontend

1. Navigate to the `frontend/` directory in a new terminal window:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Launch the Vite dev server:
   ```bash
   npm run dev
   ```

Open `http://localhost:5173` (or the URL outputted by Vite) in your browser to interact with WISP.

---

## Project Structure

```
wisp/
├── backend/
│   ├── compressors/
│   │   ├── __init__.py
│   │   ├── code_compressor.py    # Python AST & Regex JS/TS pruning
│   │   ├── json_compressor.py    # Key/value pruning & uniform structure deduping
│   │   ├── prose_compressor.py   # Sentence embedding & TF-IDF centrality clustering
│   │   └── rag_dedup.py          # Pairwise cosine similarity chunk deduplication
│   ├── main.py                   # FastAPI, WebSockets connection, and token estimation
│   ├── store.py                  # EphemeralStore memory class
│   └── requirements.txt          # Python packages list
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx        # Logo, connection indicator, ephemeral guarantee badge
│   │   │   ├── IngestionPanel.tsx# Text pasting area & config sliders
│   │   │   ├── CompressionView.tsx# Before/After collapsible diff panel
│   │   │   └── MetricsDashboard.tsx# Live counters, SVG donut chart & ingestion history
│   │   ├── App.tsx               # State coordination & WebSocket client
│   │   └── index.css             # Tailwind v4 directives & glassmorphic styling
│   └── package.json              # React + Vite configuration
├── .env.example                  # Optional LLM keys configuration
└── README.md                     # Documentation
```
