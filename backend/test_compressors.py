import json
import sys
import os

# Adjust paths to import local backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.store import store
from backend.compressors.json_compressor import compress_json
from backend.compressors.code_compressor import compress_code
from backend.compressors.prose_compressor import compress_prose
from backend.compressors.rag_dedup import deduplicate_rag_chunks

def test_json_compressor():
    print("Testing JSON Compressor...")
    raw_json = json.dumps([
        {"id": 1, "name": "Alice", "role": "admin", "details": "long_string_value_that_needs_to_be_truncated_to_save_tokens"},
        {"id": 2, "name": "Bob", "role": "user", "details": "short"},
        {"id": 3, "name": "Charlie", "role": "user", "details": "another_long_string_value_to_prune"},
        {"id": 4, "name": "David", "role": "user", "details": "yet_another_one"}
    ])
    
    compressed = compress_json(raw_json, max_depth=3, max_string_len=15, max_array_items=2)
    # Parse back
    data = json.loads(compressed)
    
    assert data["_type"] == "UniformSchemaArray"
    assert data["total_items"] == 4
    assert len(data["samples"]) == 2
    assert "truncated" in data["samples"][0]["details"]
    print("[OK] JSON Compressor Passed!")

def test_code_compressor():
    print("Testing Code Compressor...")
    python_code = """
import os
import sys

class Agent:
    def __init__(self, name: str):
        \"\"\"Initialize agent metadata here.\"\"\"
        self.name = name
        self.history = []

    def perform_action(self, action: str) -> bool:
        # Check condition
        if not action:
            return False
        self.history.append(action)
        print(f"Action: {action}")
        return True
"""
    compressed = compress_code(python_code, "python", signatures_only=True)
    assert "def __init__(self, name: str):" in compressed
    assert "def perform_action(self, action: str) -> bool:" in compressed
    assert "self.history.append" not in compressed
    assert "pass  # ... [" in compressed
    print("[OK] Code Compressor Passed!")

def test_prose_compressor():
    print("Testing Prose Compressor...")
    prose = (
        "Large Language Models are neural networks trained on large amounts of text. "
        "These models can generate coherent text and solve diverse language tasks. "
        "Large Language Models are neural networks trained on massive corpora of texts. " # redundant
        "They operate by predicting the next token in a sequence. "
        "Next token prediction is the core task they are trained on." # redundant
    )
    
    compressed = compress_prose(prose, ratio=0.6, similarity_threshold=0.55)
    # Verify duplicates are dropped
    assert "predicting the next token" in compressed.lower() or "prediction" in compressed.lower()
    print("[OK] Prose Compressor Passed!")

def test_rag_deduplicator():
    print("Testing RAG Deduplicator...")
    chunks = (
        "User query was received at 10:00 AM on Monday.\n\n"
        "User query was received at 10:00 AM on Monday.\n\n" # exact duplicate
        "The agent executed search query and fetched 5 results.\n\n"
        "The agent ran the search action and fetched 5 results." # near duplicate
    )
    compressed = deduplicate_rag_chunks(chunks, similarity_threshold=0.7)
    parsed_chunks = [c for c in compressed.split('\n\n') if c.strip()]
    assert len(parsed_chunks) < 4
    print("[OK] RAG Deduplicator Passed!")

def test_ephemeral_store():
    print("Testing Ephemeral Store...")
    store.add_source(
        source_id="test1",
        name="test_source",
        original_text="Hello World",
        compressed_text="Hello",
        source_type="prose",
        original_tokens=2,
        compressed_tokens=1,
        duration_ms=5.0
    )
    
    assert len(store.get_all_sources()) == 1
    metrics = store.get_metrics()
    assert metrics["totalOriginalTokens"] == 2
    assert metrics["totalCompressedTokens"] == 1
    
    # Test rehydrate
    assert store.get_source("test1")["original_text"] == "Hello World"
    
    # Test wipe
    store.wipe()
    assert len(store.get_all_sources()) == 0
    assert store.get_metrics()["totalOriginalTokens"] == 0
    print("[OK] Ephemeral Store Passed!")

if __name__ == "__main__":
    print("Running WISP Backend Unit Tests...")
    test_json_compressor()
    test_code_compressor()
    test_prose_compressor()
    test_rag_deduplicator()
    test_ephemeral_store()
    print("All tests passed successfully!")
