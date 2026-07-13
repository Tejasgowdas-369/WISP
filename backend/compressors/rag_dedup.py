import json
from typing import List
from backend.compressors.prose_compressor import (
    HAS_SENTENCE_TRANSFORMERS,
    get_transformer_model,
    _tokenize,
    _compute_cosine_similarity
)

def parse_chunks(raw_text: str) -> List[str]:
    """
    Parses RAG chunks from raw text.
    If it's a JSON list, parses it.
    If not, splits by double newlines to treat paragraphs as separate chunks.
    """
    try:
        data = json.loads(raw_text)
        if isinstance(data, list):
            return [str(item).strip() for item in data if str(item).strip()]
    except Exception:
        pass
        
    # Split by double newline or blank lines
    chunks = [c.strip() for c in raw_text.split('\n\n') if c.strip()]
    if not chunks:
        # Fallback to single lines if no double newlines exist
        chunks = [c.strip() for c in raw_text.split('\n') if c.strip()]
    return chunks

def deduplicate_rag_chunks(
    raw_text: str,
    similarity_threshold: float = 0.75
) -> str:
    """
    Identifies and removes duplicate or highly similar RAG chunks.
    Keeps chronological/input order of the non-duplicate chunks.
    """
    chunks = parse_chunks(raw_text)
    if len(chunks) <= 1:
        return raw_text

    kept_chunks: List[str] = []
    
    # Check if sentence-transformers is available
    model = get_transformer_model() if HAS_SENTENCE_TRANSFORMERS else None
    
    if model is not None:
        try:
            import numpy as np
            embeddings = model.encode(chunks, convert_to_numpy=True)
            # Normalize
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            normalized = embeddings / norms
            
            # Keep first chunk
            kept_chunks.append(chunks[0])
            kept_indices = [0]
            
            for i in range(1, len(chunks)):
                is_duplicate = False
                # Compare chunk i against all already kept chunks
                for kept_idx in kept_indices:
                    sim = np.dot(normalized[i], normalized[kept_idx])
                    if sim > similarity_threshold:
                        is_duplicate = True
                        break
                if not is_duplicate:
                    kept_chunks.append(chunks[i])
                    kept_indices.append(i)
                    
        except Exception:
            # Fallback to TF-IDF if anything fails
            kept_chunks = _dedup_tfidf_fallback(chunks, similarity_threshold)
    else:
        kept_chunks = _dedup_tfidf_fallback(chunks, similarity_threshold)

    # Return formatted output (as JSON array if original was JSON, else double-newline joined)
    try:
        json.loads(raw_text)
        return json.dumps(kept_chunks, indent=2)
    except Exception:
        return "\n\n".join(kept_chunks)

def _dedup_tfidf_fallback(chunks: List[str], similarity_threshold: float) -> List[str]:
    """
    Pure Python fallback RAG deduplication using TF-IDF and Cosine Similarity.
    """
    # 1. Tokenize chunks
    chunk_tokens = [_tokenize(c) for c in chunks]
    num_chunks = len(chunks)
    
    # 2. Compute DF
    df = {}
    for tokens in chunk_tokens:
        for t in set(tokens):
            df[t] = df.get(t, 0) + 1
            
    # 3. Compute TF-IDF vectors
    vectors = []
    for tokens in chunk_tokens:
        tf = {}
        for t in tokens:
            tf[t] = tf.get(t, 0.0) + 1.0
        
        vec = {}
        for t, count in tf.items():
            idf = math_log_safe(num_chunks, df.get(t, 0))
            vec[t] = count * idf
        vectors.append(vec)

    kept_chunks = [chunks[0]]
    kept_vectors = [vectors[0]]
    
    for i in range(1, len(chunks)):
        is_duplicate = False
        vec_i = vectors[i]
        for kept_vec in kept_vectors:
            sim = _compute_cosine_similarity(vec_i, kept_vec)
            if sim > similarity_threshold:
                is_duplicate = True
                break
        if not is_duplicate:
            kept_chunks.append(chunks[i])
            kept_vectors.append(vec_i)
            
    return kept_chunks

def math_log_safe(num_chunks: int, df_val: int) -> float:
    import math
    return math.log((num_chunks + 1) / (df_val + 0.5))
