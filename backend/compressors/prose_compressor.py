import re
import math
import os
from typing import List, Set, Dict, Tuple

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

# Attempt to import sentence-transformers and numpy
try:
    import numpy as np
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False

# Simple model cache to avoid reloading on every request
_model_cache = {}

def get_transformer_model():
    if not HAS_SENTENCE_TRANSFORMERS:
        return None
    if "model" not in _model_cache:
        try:
            # Load a lightweight model locally
            _model_cache["model"] = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception:
            # Fallback if download/load fails
            _model_cache["model"] = None
    return _model_cache["model"]

def split_into_sentences(text: str) -> List[str]:
    """
    Split text into sentences using simple heuristics.
    """
    # Regex split that tries not to split on abbreviations (Mr., Dr., etc.)
    sentence_end = re.compile(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?)\s')
    paragraphs = text.split('\n')
    sentences = []
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        splits = sentence_end.split(para)
        for s in splits:
            s_clean = s.strip()
            if s_clean:
                sentences.append(s_clean)
    return sentences

# --- Pure Python TF-IDF and Cosine Similarity Fallback ---
def _tokenize(text: str) -> List[str]:
    """Tokenize a sentence into words, lowercased, with punctuation removed."""
    words = re.findall(r'\b\w+\b', text.lower())
    return words

def _compute_cosine_similarity(vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
    """Computes cosine similarity between two sparse term weight dictionaries."""
    intersection = set(vec1.keys()) & set(vec2.keys())
    if not intersection:
        return 0.0
        
    dot_product = sum(vec1[w] * vec2[w] for w in intersection)
    
    sum1 = sum(val ** 2 for val in vec1.values())
    sum2 = sum(val ** 2 for val in vec2.values())
    
    if sum1 == 0 or sum2 == 0:
        return 0.0
        
    return dot_product / (math.sqrt(sum1) * math.sqrt(sum2))

def _compress_prose_fallback(
    sentences: List[str],
    ratio: float = 0.5,
    similarity_threshold: float = 0.6
) -> List[str]:
    """
    Pure Python extractive summarization using TF-IDF cosine similarity.
    1. Build TF-IDF vectors for sentences.
    2. Compute pairwise similarity.
    3. Run LexRank-style centrality scoring (number of connections above threshold).
    4. Keep central sentences and drop highly redundant ones.
    """
    num_sentences = len(sentences)
    if num_sentences <= 3:
        return sentences

    # 1. Build vocabulary and document frequencies (DF)
    df: Dict[str, int] = {}
    sentence_tokens = []
    for s in sentences:
        tokens = _tokenize(s)
        sentence_tokens.append(tokens)
        for token in set(tokens):
            df[token] = df.get(token, 0) + 1
            
    # 2. Build TF-IDF vectors
    vectors: List[Dict[str, float]] = []
    for tokens in sentence_tokens:
        tf: Dict[str, float] = {}
        for token in tokens:
            tf[token] = tf.get(token, 0.0) + 1.0
            
        vector: Dict[str, float] = {}
        for token, count in tf.items():
            # Standard TF-IDF formula
            idf = math.log((num_sentences + 1) / (df.get(token, 0) + 0.5))
            vector[token] = count * idf
        vectors.append(vector)

    # 3. Calculate Centrality Matrix (LexRank-style)
    # Degree of connection is the sum of similarity to all other sentences
    degrees = [0.0] * num_sentences
    similarity_matrix = [[0.0 for _ in range(num_sentences)] for _ in range(num_sentences)]
    
    for i in range(num_sentences):
        for j in range(i + 1, num_sentences):
            sim = _compute_cosine_similarity(vectors[i], vectors[j])
            similarity_matrix[i][j] = sim
            similarity_matrix[j][i] = sim
            if sim > 0.3:  # connection threshold
                degrees[i] += sim
                degrees[j] += sim

    # Rank indices by degree (centrality) descending
    ranked_indices = sorted(range(num_sentences), key=lambda idx: degrees[idx], reverse=True)
    
    # 4. Extractive Selection with Redundancy Filtering
    target_count = max(2, int(num_sentences * ratio))
    selected_indices: Set[int] = set()
    
    for idx in ranked_indices:
        if len(selected_indices) >= target_count:
            break
            
        # Redundancy check: is this sentence too similar to any already selected sentence?
        is_redundant = False
        for sel_idx in selected_indices:
            if similarity_matrix[idx][sel_idx] > similarity_threshold:
                is_redundant = True
                break
                
        if not is_redundant:
            selected_indices.add(idx)
            
    # If we didn't select enough (due to high redundancy filtering), add top ranked ones regardless
    for idx in ranked_indices:
        if len(selected_indices) >= target_count:
            break
        selected_indices.add(idx)
        
    # Return selected sentences in their original chronological order
    ordered_selected = [sentences[idx] for idx in sorted(list(selected_indices))]
    return ordered_selected

# --- Sentence Transformers Engine ---
def _compress_prose_transformer(
    sentences: List[str],
    ratio: float = 0.5,
    similarity_threshold: float = 0.6
) -> List[str]:
    """
    Extractive summarization using SentenceTransformers embeddings.
    """
    model = get_transformer_model()
    if not model:
        # Fall back if loading model fails at runtime
        return _compress_prose_fallback(sentences, ratio, similarity_threshold)
        
    num_sentences = len(sentences)
    if num_sentences <= 3:
        return sentences

    # Compute sentence embeddings
    embeddings = model.encode(sentences, convert_to_numpy=True)
    
    # Calculate cosine similarity matrix
    # Normalize vectors
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    # Avoid divide by zero
    norms[norms == 0] = 1.0
    normalized_embeddings = embeddings / norms
    
    # Pairwise similarity
    similarity_matrix = np.dot(normalized_embeddings, normalized_embeddings.T)
    
    # Calculate centrality degrees
    # Row sum of similarities that exceed a low connection threshold (0.3)
    adjacency = (similarity_matrix > 0.3).astype(float) * similarity_matrix
    degrees = np.sum(adjacency, axis=1)
    
    # Sort indices by centrality descending
    ranked_indices = np.argsort(-degrees)
    
    # Extractive Selection with Redundancy Filtering
    target_count = max(2, int(num_sentences * ratio))
    selected_indices: Set[int] = set()
    
    for idx in ranked_indices:
        if len(selected_indices) >= target_count:
            break
            
        is_redundant = False
        for sel_idx in selected_indices:
            if similarity_matrix[idx, sel_idx] > similarity_threshold:
                is_redundant = True
                break
                
        if not is_redundant:
            selected_indices.add(int(idx))
            
    # Add fallback if under target limit
    for idx in ranked_indices:
        if len(selected_indices) >= target_count:
            break
        selected_indices.add(int(idx))
        
    ordered_selected = [sentences[idx] for idx in sorted(list(selected_indices))]
    return ordered_selected

# --- Public API ---
def compress_prose(
    raw_text: str,
    ratio: float = 0.5,
    similarity_threshold: float = 0.6
) -> str:
    """
    Compresses prose text by splitting into sentences, clustering,
    filtering redundancies, and returning an extracted summary.
    """
    sentences = split_into_sentences(raw_text)
    if not sentences:
        return raw_text

    # Route based on model availability
    if HAS_SENTENCE_TRANSFORMERS and get_transformer_model() is not None:
        compressed_sentences = _compress_prose_transformer(sentences, ratio, similarity_threshold)
    else:
        compressed_sentences = _compress_prose_fallback(sentences, ratio, similarity_threshold)
        
    # Join sentences back with space/newlines
    return " ".join(compressed_sentences)
