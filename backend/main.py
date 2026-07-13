import time
import hashlib
import json
from typing import Dict, Any, Set, List
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tiktoken

# Import store and compressors
from backend.store import store
from backend.compressors.json_compressor import compress_json
from backend.compressors.code_compressor import compress_code
from backend.compressors.prose_compressor import compress_prose
from backend.compressors.rag_dedup import deduplicate_rag_chunks

app = FastAPI(title="WISP Backend", version="1.0.0")

# Setup CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections
active_connections: Set[WebSocket] = set()

# Safe token counter
def count_tokens(text: str) -> int:
    if not text:
        return 0
    try:
        # cl100k_base is the standard GPT-4 / Gemini-compatible BPE tokenizer
        encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(text))
    except Exception:
        # Robust pure-python fallback: words * 1.3 + len(chars)/20
        words = text.split()
        return max(1, int(len(words) * 1.3 + (len(text) - len(words)*5)/4))

# Models
class CompressionRequest(BaseModel):
    name: str
    text: str
    type: str  # json, code, prose, rag
    settings: Dict[str, Any] = {}

async def broadcast_state():
    """Broadcasts all items and updated metrics to all active WebSocket clients."""
    if not active_connections:
        return
        
    state_payload = {
        "event": "state_update",
        "sources": store.get_all_sources(),
        "metrics": store.get_metrics()
    }
    
    dead_connections = set()
    for websocket in active_connections:
        try:
            await websocket.send_text(json.dumps(state_payload))
        except Exception:
            dead_connections.add(websocket)
            
    for dead in dead_connections:
        active_connections.remove(dead)

@app.on_event("shutdown")
def shutdown_event():
    # Explicitly clear store to fulfill 100% ephemeral RAM requirement
    store.wipe()
    print("WISP Session Data completely cleared from RAM.")

@app.post("/api/compress")
async def compress_endpoint(req: CompressionRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Empty text provided")

    start_time = time.perf_counter()
    
    # Generate in-memory short hash ID
    hash_id = hashlib.sha256(req.text.encode('utf-8')).hexdigest()[:8]
    
    # Extract config settings with safe fallbacks
    settings = req.settings or {}
    
    original_tokens = count_tokens(req.text)
    
    # Route to correct compressor
    compressed_text = ""
    try:
        if req.type == "json":
            max_depth = int(settings.get("maxDepth", 4))
            max_str_len = int(settings.get("maxStringLen", 100))
            max_arr_items = int(settings.get("maxArrayItems", 3))
            compressed_text = compress_json(req.text, max_depth, max_str_len, max_arr_items)
            
        elif req.type == "code":
            lang = str(settings.get("language", "python"))
            sig_only = bool(settings.get("signaturesOnly", True))
            compressed_text = compress_code(req.text, lang, sig_only)
            
        elif req.type == "prose":
            ratio = float(settings.get("ratio", 0.5))
            sim_thresh = float(settings.get("similarityThreshold", 0.6))
            compressed_text = compress_prose(req.text, ratio, sim_thresh)
            
        elif req.type == "rag":
            sim_thresh = float(settings.get("similarityThreshold", 0.75))
            compressed_text = deduplicate_rag_chunks(req.text, sim_thresh)
            
        else:
            raise HTTPException(status_code=400, detail=f"Unknown type: {req.type}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compression error: {str(e)}")

    compressed_tokens = count_tokens(compressed_text)
    duration_ms = (time.perf_counter() - start_time) * 1000.0

    # Save to ephemeral store
    source_data = store.add_source(
        source_id=hash_id,
        name=req.name,
        original_text=req.text,
        compressed_text=compressed_text,
        source_type=req.type,
        original_tokens=original_tokens,
        compressed_tokens=compressed_tokens,
        duration_ms=duration_ms
    )

    # Broadcast updated state over WebSockets
    await broadcast_state()

    return {
        "status": "success",
        "data": {
            "id": source_data["id"],
            "name": source_data["name"],
            "type": source_data["type"],
            "compressed_text": source_data["compressed_text"],
            "original_tokens": source_data["original_tokens"],
            "compressed_tokens": source_data["compressed_tokens"],
            "original_bytes": source_data["original_bytes"],
            "compressed_bytes": source_data["compressed_bytes"],
            "duration_ms": source_data["duration_ms"]
        }
    }

@app.get("/api/rehydrate/{hash_id}")
async def rehydrate_endpoint(hash_id: str):
    source = store.get_source(hash_id)
    if not source:
        raise HTTPException(status_code=404, detail="Original content not found or session has expired")
    return {"original_text": source["original_text"]}

@app.delete("/api/session")
async def wipe_session_endpoint():
    store.wipe()
    await broadcast_state()
    return {"status": "session_wiped"}

@app.get("/api/state")
async def get_state_endpoint():
    return {
        "sources": store.get_all_sources(),
        "metrics": store.get_metrics()
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    try:
        # Send initial state on connection
        initial_payload = {
            "event": "state_update",
            "sources": store.get_all_sources(),
            "metrics": store.get_metrics()
        }
        await websocket.send_text(json.dumps(initial_payload))
        
        # Keep connection open and listen for heartbeat/client messages
        while True:
            data = await websocket.receive_text()
            # If client sends a ping/wipe command via WS, we can handle it
            try:
                msg = json.loads(data)
                if msg.get("command") == "wipe":
                    store.wipe()
                    await broadcast_state()
            except Exception:
                pass
    except WebSocketDisconnect:
        active_connections.remove(websocket)
    except Exception:
        if websocket in active_connections:
            active_connections.remove(websocket)
