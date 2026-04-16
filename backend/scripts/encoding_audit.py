#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Encoding audit script:
- Check UTF-8 and no BOM
- Check known garbled text tokens
- Check JSON Content-Type includes charset=utf-8
"""

from __future__ import annotations

import argparse
import codecs
import re
from pathlib import Path
from typing import Iterable

# 需要参与编码验收的文本扩展名
TEXT_EXTENSIONS = {
    ".js", ".ts", ".jsx", ".tsx", ".vue", ".html", ".css", ".scss", ".json",
    ".java", ".py", ".go", ".md", ".sql", ".yml", ".yaml",
}

# 仅对代码文件做 Content-Type 检查
CODE_EXTENSIONS = {".js", ".ts", ".jsx", ".tsx", ".py", ".go", ".java"}

# 典型乱码片段（可按项目经验持续扩充）
GARBLED_PATTERNS = [
    "�", "妯＄壒", "杈句汉", "鍟嗗", "浣欓", "鍔犺浇涓", "鈥?", "绉", "鎿嶄綔",
]

# 命中 application/json 但未显式声明 charset=utf-8 的粗粒度规则
JSON_CT_PATTERN = re.compile(r"Content-Type\s*[:=]\s*[\"']application/json[\"']", re.IGNORECASE)
JSON_CT_WITH_CHARSET_PATTERN = re.compile(r"Content-Type\s*[:=]\s*[\"']application/json\s*;\s*charset\s*=\s*utf-8[\"']", re.IGNORECASE)

# 扫描排除列表（避免验收脚本自身模式定义被误判）
EXCLUDE_REL_PATHS = {
    "backend/scripts/encoding_audit.py",
    "乱码与编码验收清单.md",
}


def iter_target_files(root: Path) -> Iterable[Path]:
    """Iterate text files included in audit."""
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        rel_posix = path.relative_to(root).as_posix()
        if rel_posix in EXCLUDE_REL_PATHS:
            continue
        # 跳过依赖与构建产物目录
        if any(part in {"node_modules", "dist", "build", ".git"} for part in path.parts):
            continue
        yield path


def check_utf8_and_bom(path: Path) -> tuple[bool, bool]:
    """Return (is_utf8, has_bom)."""
    data = path.read_bytes()
    has_bom = data.startswith(codecs.BOM_UTF8)
    try:
        data.decode("utf-8")
        return True, has_bom
    except UnicodeDecodeError:
        return False, has_bom


def has_garbled_text(content: str) -> bool:
    """Check whether text contains known garbled tokens."""
    return any(token in content for token in GARBLED_PATTERNS)


def has_json_charset_issue(path: Path, content: str) -> bool:
    """Check missing charset=utf-8 for application/json in code files."""
    if path.suffix.lower() not in CODE_EXTENSIONS:
        return False
    if not JSON_CT_PATTERN.search(content):
        return False
    return not JSON_CT_WITH_CHARSET_PATTERN.search(content)


def main() -> int:
    """执行验收并输出结果。"""
    parser = argparse.ArgumentParser(description="Project encoding audit")
    parser.add_argument("--root", default=".", help="项目根目录")
    args = parser.parse_args()

    root = Path(args.root).resolve()

    non_utf8_files: list[str] = []
    bom_files: list[str] = []
    garbled_files: list[str] = []
    json_charset_files: list[str] = []

    for file_path in iter_target_files(root):
        is_utf8, has_bom = check_utf8_and_bom(file_path)
        rel = str(file_path.relative_to(root))
        if not is_utf8:
            non_utf8_files.append(rel)
            continue
        if has_bom:
            bom_files.append(rel)

        text = file_path.read_text(encoding="utf-8", errors="ignore")
        if has_garbled_text(text):
            garbled_files.append(rel)
        if has_json_charset_issue(file_path, text):
            json_charset_files.append(rel)

    print("== ENCODING AUDIT REPORT ==")
    print(f"ROOT: {root}")
    print(f"NON_UTF8: {len(non_utf8_files)}")
    print(f"BOM_UTF8: {len(bom_files)}")
    print(f"GARBLED_TEXT: {len(garbled_files)}")
    print(f"JSON_CHARSET_MISSING: {len(json_charset_files)}")

    def print_list(title: str, items: list[str]) -> None:
        """Print issue files by section."""
        if not items:
            return
        print(f"\n[{title}]")
        for item in items:
            print(item)

    print_list("NON_UTF8", non_utf8_files)
    print_list("BOM_UTF8", bom_files)
    print_list("GARBLED_TEXT", garbled_files)
    print_list("JSON_CHARSET_MISSING", json_charset_files)

    has_error = any([non_utf8_files, bom_files, garbled_files, json_charset_files])
    return 1 if has_error else 0


if __name__ == "__main__":
    raise SystemExit(main())
