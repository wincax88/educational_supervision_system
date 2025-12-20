#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
在指定“指标体系上下文”下，找出要素库中当前未被使用（不可达）的要素。

可达（used）的定义：
1) 被 doc/义务教育优质均衡要素列表.json 的 indicatorElementMappings 显式映射到的要素
2) 以及上述要素的公式/规则中引用到的其它要素（递归闭包）

注意：
- 这是“相对某一指标体系”的未使用，不代表未来不会用。
- 解析引用使用启发式：从 formula / complianceRule.condition 中用正则抽取 E### / D### token。

用法：
  python3 scripts/find_unused_elements.py \
    --elements-file doc/义务教育优质均衡要素列表.json

输出：
  - 打印统计摘要
  - 打印未使用要素列表（按 elementType / dataType 分组）
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple


TOKEN_RE = re.compile(r"\b([ED]\d{3})\b")


def load_json(p: Path) -> Any:
    with p.open("r", encoding="utf-8") as f:
        return json.load(f)


def extract_tokens(text: str) -> Set[str]:
    if not text:
        return set()
    return set(m.group(1) for m in TOKEN_RE.finditer(text))


@dataclass
class Element:
    code: str
    name: str
    element_type: str
    data_type: str
    formula: str | None
    compliance_condition: str | None


def build_elements_index(doc: Dict[str, Any]) -> Dict[str, Element]:
    idx: Dict[str, Element] = {}
    for e in doc.get("elements") or []:
        code = str(e.get("code") or "").strip()
        if not code:
            continue
        idx[code] = Element(
            code=code,
            name=str(e.get("name") or ""),
            element_type=str(e.get("elementType") or ""),
            data_type=str(e.get("dataType") or ""),
            formula=e.get("formula"),
            compliance_condition=(e.get("complianceRule") or {}).get("condition"),
        )
    return idx


def initial_used_from_mappings(doc: Dict[str, Any]) -> Set[str]:
    m = doc.get("indicatorElementMappings") or {}
    used: Set[str] = set()
    di = m.get("dataIndicators") or {}
    li = m.get("leafIndicators") or {}
    used.update(str(v) for v in di.values() if isinstance(v, str) and v.strip())
    used.update(str(v) for v in li.values() if isinstance(v, str) and v.strip())
    return used


def compute_reachable(elements: Dict[str, Element], seeds: Set[str]) -> Tuple[Set[str], Dict[str, Set[str]]]:
    """
    返回：
      reachable: 可达要素 code
      deps: code -> 直接依赖集合（用于解释）
    """
    reachable: Set[str] = set()
    deps: Dict[str, Set[str]] = {}

    queue = [c for c in seeds if c in elements]
    while queue:
        code = queue.pop()
        if code in reachable:
            continue
        reachable.add(code)

        el = elements.get(code)
        if not el:
            continue

        direct: Set[str] = set()
        if isinstance(el.formula, str):
            direct |= extract_tokens(el.formula)
        if isinstance(el.compliance_condition, str):
            direct |= extract_tokens(el.compliance_condition)

        # 只保留存在于要素库中的 token
        direct = {d for d in direct if d in elements}
        deps[code] = direct

        for d in direct:
            if d not in reachable:
                queue.append(d)

    return reachable, deps


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--elements-file", required=True, help="要素库 JSON 路径")
    args = ap.parse_args()

    doc = load_json(Path(args.elements_file))
    elements = build_elements_index(doc)

    seeds = initial_used_from_mappings(doc)
    reachable, _ = compute_reachable(elements, seeds)

    all_codes = set(elements.keys())
    unused = sorted(all_codes - reachable)

    # 统计
    print(f"Total elements: {len(all_codes)}")
    print(f"Mapped seeds:   {len(seeds)} (存在于要素库: {len([s for s in seeds if s in elements])})")
    print(f"Reachable:      {len(reachable)}")
    print(f"Unused:         {len(unused)}")

    # 分组输出
    groups: Dict[Tuple[str, str], List[str]] = {}
    for c in unused:
        el = elements[c]
        key = (el.element_type or "?", el.data_type or "?")
        groups.setdefault(key, []).append(c)

    # 按组大小倒序
    for (etype, dtype), codes in sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0][0], kv[0][1])):
        print(f"\n[{etype} / {dtype}] {len(codes)}")
        for c in codes:
            el = elements[c]
            print(f"- {el.code} {el.name}")


if __name__ == "__main__":
    main()


