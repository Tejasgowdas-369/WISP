import json
from typing import Any, Union, Dict, List

def compress_json(
    raw_text: str,
    max_depth: int = 4,
    max_string_len: int = 100,
    max_array_items: int = 3
) -> str:
    """
    Compresses JSON by:
    1. Parsing it to a Python structure.
    2. Recursively pruning keys/values.
    3. Collapsing large arrays and deduping duplicate structures in arrays.
    4. Truncating long strings.
    5. Dropping nesting beyond max_depth.
    """
    try:
        data = json.loads(raw_text)
    except Exception:
        # If it's not valid JSON, return original text or basic representation
        return raw_text

    compressed_data = _prune_recursive(data, current_depth=1, max_depth=max_depth, 
                                      max_str_len=max_string_len, max_arr_items=max_array_items)
    
    return json.dumps(compressed_data, indent=2)

def _prune_recursive(
    val: Any,
    current_depth: int,
    max_depth: int,
    max_str_len: int,
    max_arr_items: int
) -> Any:
    if val is None:
        return None

    if isinstance(val, str):
        if len(val) > max_str_len:
            return f"{val[:max_str_len]}... [truncated {len(val) - max_str_len} chars]"
        return val

    if isinstance(val, (int, float, bool)):
        return val

    # If depth limit reached, collapse nested collection
    if current_depth > max_depth:
        if isinstance(val, dict):
            return f"{{... dict with {len(val)} keys ...}}"
        elif isinstance(val, list):
            return f"[... list with {len(val)} items ...]"
        return "..."

    if isinstance(val, dict):
        pruned_dict = {}
        for k, v in val.items():
            # Skip keys that are empty or have null values to save tokens
            if v is None or v == "" or v == [] or v == {}:
                continue
            pruned_dict[k] = _prune_recursive(v, current_depth + 1, max_depth, max_str_len, max_arr_items)
        return pruned_dict

    if isinstance(val, list):
        if not val:
            return []
        
        # Deduplicate repeated object structures within arrays
        # (e.g. a list of 50 objects with identical keys)
        first_item = val[0]
        if isinstance(first_item, dict) and len(val) > max_arr_items:
            # Analyze if the items share the same keys
            first_keys = set(first_item.keys())
            is_uniform_schema = True
            for item in val[1:min(len(val), 10)]:  # check first 10 items
                if not isinstance(item, dict) or set(item.keys()) != first_keys:
                    is_uniform_schema = False
                    break
            
            if is_uniform_schema:
                # Compile a schema description and keep a few samples
                samples = [
                    _prune_recursive(item, current_depth + 1, max_depth, max_str_len, max_arr_items)
                    for item in val[:max_arr_items]
                ]
                # Return a special compressed array struct with schema notice
                return {
                    "_type": "UniformSchemaArray",
                    "schema_keys": list(first_keys),
                    "total_items": len(val),
                    "samples": samples,
                    "omitted_count": len(val) - max_arr_items
                }

        # For normal arrays, just prune and keep first max_array_items
        pruned_list = []
        for item in val[:max_arr_items]:
            pruned_list.append(_prune_recursive(item, current_depth + 1, max_depth, max_str_len, max_arr_items))
            
        if len(val) > max_arr_items:
            pruned_list.append(f"... [+ {len(val) - max_arr_items} more items]")
            
        return pruned_list

    return val
