import ast
import re
from typing import List, Union

def compress_code(raw_code: str, language: str = "python", signatures_only: bool = True) -> str:
    """
    Compresses Python or JS/TS code by reducing it to signatures, classes,
    and structure, while dropping the detailed implementation lines.
    """
    if not raw_code.strip():
        return raw_code

    if language.lower() in ("python", "py"):
        try:
            return _compress_python(raw_code, signatures_only)
        except Exception as e:
            # Fallback if AST parsing fails due to syntax error
            return f"# [AST Parse Failed: {str(e)}]\n" + _compress_regex_fallback(raw_code, "#")
    elif language.lower() in ("javascript", "typescript", "js", "ts", "jsx", "tsx"):
        return _compress_js_ts(raw_code, signatures_only)
    else:
        # Generic fallback using comment symbol '#' or '//'
        return _compress_regex_fallback(raw_code, "//")

def _compress_python(code: str, signatures_only: bool) -> str:
    """
    Parses Python code using AST and reconstructs a skeleton of imports,
    classes, functions, signatures, docstrings, and returns/yields.
    """
    tree = ast.parse(code)
    lines = code.splitlines()
    output: List[str] = []

    class CodeVisitor(ast.NodeVisitor):
        def __init__(self):
            self.indent_level = 0

        def get_indent(self) -> str:
            return "    " * self.indent_level

        def visit_Import(self, node: ast.Import):
            for alias in node.names:
                output.append(f"{self.get_indent()}import {alias.name}")

        def visit_ImportFrom(self, node: ast.ImportFrom):
            names = ", ".join(alias.name for alias in node.names)
            module = node.module if node.module else ""
            output.append(f"{self.get_indent()}from {module} import {names}")

        def visit_ClassDef(self, node: ast.ClassDef):
            bases = ", ".join(ast.unparse(b) for b in node.bases)
            bases_str = f"({bases})" if bases else ""
            
            # Print class signature
            output.append("")
            output.append(f"{self.get_indent()}class {node.name}{bases_str}:")
            
            # Parse docstring if present
            docstring = ast.get_docstring(node)
            if docstring:
                short_doc = docstring.strip().split("\n")[0]
                output.append(f"{self.get_indent()}    \"\"\"{short_doc} ...\"\"\"")
            
            self.indent_level += 1
            # Visit body children manually
            for child in node.body:
                if docstring and isinstance(child, ast.Expr) and isinstance(child.value, ast.Constant) and isinstance(child.value.value, str):
                    continue  # skip visiting docstring as node
                self.visit(child)
            self.indent_level -= 1

        def visit_FunctionDef(self, node: ast.FunctionDef):
            self._visit_func_common(node, is_async=False)

        def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
            self._visit_func_common(node, is_async=True)

        def _visit_func_common(self, node: Union[ast.FunctionDef, ast.AsyncFunctionDef], is_async: bool):
            # Reconstruct arguments signature
            args_str = ast.unparse(node.args)
            decorator_list = []
            for dec in node.decorator_list:
                try:
                    decorator_list.append(f"@{ast.unparse(dec)}")
                except Exception:
                    pass
            
            # Write decorators
            for dec in decorator_list:
                output.append(f"{self.get_indent()}{dec}")

            # Return type annotation
            ret_str = ""
            if node.returns:
                try:
                    ret_str = f" -> {ast.unparse(node.returns)}"
                except Exception:
                    pass

            prefix = "async def" if is_async else "def"
            func_sig = f"{self.get_indent()}{prefix} {node.name}({args_str}){ret_str}:"
            output.append(func_sig)

            # Docstring
            docstring = ast.get_docstring(node)
            if docstring:
                short_doc = docstring.strip().split("\n")[0]
                output.append(f"{self.get_indent()}    \"\"\"{short_doc} ...\"\"\"")

            # Extract return statements or yield statements if not signatures_only
            body_info = []
            if not signatures_only:
                for subnode in ast.walk(node):
                    if isinstance(subnode, ast.Return) and subnode.value:
                        try:
                            body_info.append(f"return {ast.unparse(subnode.value)}")
                        except Exception:
                            body_info.append("return ...")
                    elif isinstance(subnode, ast.Yield):
                        try:
                            body_info.append(f"yield {ast.unparse(subnode.value)}")
                        except Exception:
                            body_info.append("yield ...")
                    elif isinstance(subnode, ast.YieldFrom):
                        try:
                            body_info.append(f"yield from {ast.unparse(subnode.value)}")
                        except Exception:
                            body_info.append("yield from ...")

            body_lines_count = len(node.body)
            total_physical_lines = node.end_lineno - node.lineno if node.end_lineno else body_lines_count

            if body_info:
                for b_item in body_info[:3]:  # limit to first 3 returns/yields
                    output.append(f"{self.get_indent()}    # ... {b_item}")
                if len(body_info) > 3:
                    output.append(f"{self.get_indent()}    # ... (+ {len(body_info) - 3} more return/yields)")
            else:
                output.append(f"{self.get_indent()}    pass  # ... [omitted {total_physical_lines} lines of logic]")

        def visit_Assign(self, node: ast.Assign):
            # Show global variable definitions at level 0
            if self.indent_level == 0:
                try:
                    targets = " = ".join(ast.unparse(t) for t in node.targets)
                    val = ast.unparse(node.value)
                    # Truncate values if too long
                    if len(val) > 40:
                        val = val[:40] + " ... [truncated]"
                    output.append(f"{targets} = {val}")
                except Exception:
                    pass

    visitor = CodeVisitor()
    visitor.visit(tree)
    
    # Filter empty lines
    return "\n".join(output).strip()

def _compress_js_ts(code: str, signatures_only: bool) -> str:
    """
    Compresses JS/TS code by keeping lines with declarations (import, class, function, interface)
    and skipping code inside curly brace blocks (methods bodies, function bodies).
    """
    lines = code.splitlines()
    output: List[str] = []
    
    # Simple brace parsing state machine
    brace_depth = 0
    in_block_comment = False
    
    for line in lines:
        stripped = line.strip()
        
        # Track block comments
        if "/*" in stripped:
            in_block_comment = True
        if "*/" in stripped:
            in_block_comment = False
            continue
        if in_block_comment or stripped.startswith("//"):
            continue
            
        # Check imports/exports/declarations when not inside nested code blocks
        is_decl = False
        if brace_depth == 0:
            if (stripped.startswith("import ") or 
                stripped.startswith("export ") or 
                stripped.startswith("class ") or 
                stripped.startswith("interface ") or 
                stripped.startswith("type ") or
                "function " in stripped or
                "const " in stripped and "=>" in stripped):
                is_decl = True
        else:
            # Inside a class definition, show method signatures
            if ("constructor(" in stripped or 
                "function " in stripped or 
                ("async " in stripped and "(" in stripped) or
                ("(" in stripped and "{" in stripped and not any(k in stripped for k in ["if", "for", "while", "switch"]))):
                is_decl = True

        # Track braces on this line
        open_braces = stripped.count("{")
        close_braces = stripped.count("}")
        
        net_braces = open_braces - close_braces
        
        if is_decl:
            # We print the declaration line
            output.append(line)
            if open_braces > 0 and net_braces > 0:
                output.append(" " * (line.find(stripped) + 2) + "/* ... [implementation omitted] ... */")
        
        # Update depth
        brace_depth += net_braces
        if brace_depth < 0:
            brace_depth = 0
            
        # If we just exited a high-level block, close it
        if brace_depth == 0 and not is_decl and close_braces > 0:
            if stripped == "}":
                output.append(line)
                
    return "\n".join(output).strip()

def _compress_regex_fallback(code: str, comment_symbol: str) -> str:
    """
    Generic fallback compressor that identifies lines with keywords
    (class, def, function, import, etc.) and omits the rest.
    """
    lines = code.splitlines()
    output = []
    omitted = 0
    
    for line in lines:
        stripped = line.strip()
        # Keep imports, classes, functions
        if (stripped.startswith("def ") or 
            stripped.startswith("class ") or 
            stripped.startswith("import ") or 
            stripped.startswith("from ") or
            stripped.startswith("function ") or
            stripped.startswith("export ") or
            "interface " in stripped):
            if omitted > 0:
                output.append(f"{comment_symbol} ... [omitted {omitted} lines]")
                omitted = 0
            output.append(line)
        else:
            omitted += 1
            
    if omitted > 0:
        output.append(f"{comment_symbol} ... [omitted {omitted} lines]")
        
    return "\n".join(output)
