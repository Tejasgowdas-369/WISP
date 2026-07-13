import time
from typing import Dict, Any, List

class EphemeralStore:
    def __init__(self):
        self._sources: Dict[str, Dict[str, Any]] = {}
        self._metrics: Dict[str, Any] = {
            "total_original_tokens": 0,
            "total_compressed_tokens": 0,
            "total_original_bytes": 0,
            "total_compressed_bytes": 0,
            "count_by_type": {
                "json": 0,
                "code": 0,
                "prose": 0,
                "rag": 0
            },
            "savings_by_type": {
                "json": 0,
                "code": 0,
                "prose": 0,
                "rag": 0
            }
        }

    def add_source(
        self,
        source_id: str,
        name: str,
        original_text: str,
        compressed_text: str,
        source_type: str,  # json, code, prose, rag
        original_tokens: int,
        compressed_tokens: int,
        duration_ms: float
    ) -> Dict[str, Any]:
        
        original_bytes = len(original_text.encode('utf-8'))
        compressed_bytes = len(compressed_text.encode('utf-8'))
        
        # Save source details
        source_data = {
            "id": source_id,
            "name": name,
            "original_text": original_text,
            "compressed_text": compressed_text,
            "type": source_type,
            "original_tokens": original_tokens,
            "compressed_tokens": compressed_tokens,
            "original_bytes": original_bytes,
            "compressed_bytes": compressed_bytes,
            "duration_ms": duration_ms,
            "timestamp": time.time()
        }
        self._sources[source_id] = source_data
        
        # Update metrics
        self._metrics["total_original_tokens"] += original_tokens
        self._metrics["total_compressed_tokens"] += compressed_tokens
        self._metrics["total_original_bytes"] += original_bytes
        self._metrics["total_compressed_bytes"] += compressed_bytes
        
        if source_type in self._metrics["count_by_type"]:
            self._metrics["count_by_type"][source_type] += 1
            
        # Recompute savings by type (tokens saved)
        self._recalculate_savings()
        
        return source_data

    def _recalculate_savings(self):
        # Calculate overall token metrics
        orig = self._metrics["total_original_tokens"]
        comp = self._metrics["total_compressed_tokens"]
        self._metrics["total_savings_pct"] = round(((orig - comp) / orig * 100), 1) if orig > 0 else 0.0
        
        # Reset savings per type
        for st in self._metrics["savings_by_type"]:
            self._metrics["savings_by_type"][st] = 0
            
        # Calculate sum of tokens for each type
        type_totals = {}
        for src in self._sources.values():
            st = src["type"]
            if st not in type_totals:
                type_totals[st] = {"orig": 0, "comp": 0}
            type_totals[st]["orig"] += src["original_tokens"]
            type_totals[st]["comp"] += src["compressed_tokens"]
            
        for st, counts in type_totals.items():
            if st in self._metrics["savings_by_type"]:
                saved = counts["orig"] - counts["comp"]
                pct = round((saved / counts["orig"] * 100), 1) if counts["orig"] > 0 else 0.0
                self._metrics["savings_by_type"][st] = pct

    def get_source(self, source_id: str) -> Dict[str, Any]:
        return self._sources.get(source_id)

    def get_all_sources(self) -> List[Dict[str, Any]]:
        # Return sorted by timestamp descending
        return sorted(self._sources.values(), key=lambda x: x["timestamp"], reverse=True)

    def get_metrics(self) -> Dict[str, Any]:
        orig_tokens = self._metrics["total_original_tokens"]
        comp_tokens = self._metrics["total_compressed_tokens"]
        saved_tokens = max(0, orig_tokens - comp_tokens)
        pct = round((saved_tokens / orig_tokens * 100), 1) if orig_tokens > 0 else 0.0
        
        return {
            "totalOriginalTokens": orig_tokens,
            "totalCompressedTokens": comp_tokens,
            "totalSavingsPct": pct,
            "totalOriginalBytes": self._metrics["total_original_bytes"],
            "totalCompressedBytes": self._metrics["total_compressed_bytes"],
            "countByType": self._metrics["count_by_type"],
            "savingsByType": self._metrics["savings_by_type"]
        }

    def wipe(self):
        self._sources.clear()
        self._metrics["total_original_tokens"] = 0
        self._metrics["total_compressed_tokens"] = 0
        self._metrics["total_original_bytes"] = 0
        self._metrics["total_compressed_bytes"] = 0
        for st in self._metrics["count_by_type"]:
            self._metrics["count_by_type"][st] = 0
        for st in self._metrics["savings_by_type"]:
            self._metrics["savings_by_type"][st] = 0
        if "total_savings_pct" in self._metrics:
            self._metrics["total_savings_pct"] = 0.0

# Singleton store for the application session
store = EphemeralStore()
