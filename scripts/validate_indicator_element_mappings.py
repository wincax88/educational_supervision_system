#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
校验 doc/义务教育优质均衡要素列表.json 中的 indicatorElementMappings 是否可被机器严格验证：

1) 指标体系文件中所有 dataIndicators.code 都必须在 mappings.dataIndicators 中出现
2) mappings.dataIndicators 的每个值必须是存在的要素 code（elements[].code）
3) 指标体系中“末级指标且 dataIndicators 为空”的 code 必须在 mappings.leafIndicators 中出现
4) mappings.leafIndicators 的每个值必须是存在的要素 code
5) 额外映射（映射里有但指标体系里没有）会报错（防止漂移）

用法：
  python3 scripts/validate_indicator_element_mappings.py \
    --elements-file doc/义务教育优质均衡要素列表.json \
    --indicator-system-file doc/义务教育优质均衡督导评估指标体系.json
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Set, Tuple


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _iter_leaf_nodes(tree: List[Dict[str, Any]]) -> Iterable[Dict[str, Any]]:
    # 指标体系文件的节点结构：{ code, isLeaf, children?, dataIndicators? }
    stack = list(tree or [])
    while stack:
        node = stack.pop()
        children = node.get("children") or []
        if children:
            stack.extend(children)
        else:
            # 兼容：有些节点 children 为空但 isLeaf 仍为 false（这里按“无 children 即叶子”处理）
            yield node


def _collect_data_indicator_codes(indicator_system: Dict[str, Any]) -> Set[str]:
    codes: Set[str] = set()
    for leaf in _iter_leaf_nodes(indicator_system.get("tree") or []):
        for di in leaf.get("dataIndicators") or []:
            c = di.get("code")
            if c:
                codes.add(str(c))
    return codes


def _collect_leaf_codes_without_data_indicators(indicator_system: Dict[str, Any]) -> Set[str]:
    codes: Set[str] = set()
    for leaf in _iter_leaf_nodes(indicator_system.get("tree") or []):
        data_indicators = leaf.get("dataIndicators")
        if data_indicators is not None and len(data_indicators) == 0:
            c = leaf.get("code")
            if c:
                codes.add(str(c))
    return codes


def _collect_element_codes(elements_doc: Dict[str, Any]) -> Set[str]:
    codes: Set[str] = set()
    for e in elements_doc.get("elements") or []:
        c = e.get("code")
        if c:
            codes.add(str(c))
    return codes


@dataclass
class ValidationResult:
    ok: bool
    errors: List[str]
    warnings: List[str]


def validate(elements_file: Path, indicator_system_file: Path) -> ValidationResult:
    elements_doc = _load_json(elements_file)
    indicator_system = _load_json(indicator_system_file)

    mappings = (elements_doc.get("indicatorElementMappings") or {})
    data_map: Dict[str, Any] = mappings.get("dataIndicators") or {}
    leaf_map: Dict[str, Any] = mappings.get("leafIndicators") or {}

    element_codes = _collect_element_codes(elements_doc)
    di_codes = _collect_data_indicator_codes(indicator_system)
    leaf_no_di_codes = _collect_leaf_codes_without_data_indicators(indicator_system)

    errors: List[str] = []
    warnings: List[str] = []

    # 1) 全覆盖：数据指标必须有映射
    missing_di = sorted(di_codes - set(data_map.keys()))
    if missing_di:
        errors.append(f"缺失 dataIndicators 映射：{missing_di}")

    # 2) 映射目标必须存在
    bad_targets = []
    for k, v in data_map.items():
        if not isinstance(v, str) or not v.strip():
            bad_targets.append((k, v))
        elif v not in element_codes:
            bad_targets.append((k, v))
    if bad_targets:
        errors.append("dataIndicators 映射目标不存在或非法：" + "; ".join([f"{k}->{v!r}" for k, v in bad_targets[:30]]) + (" ..." if len(bad_targets) > 30 else ""))

    # 3) 叶子指标（无 dataIndicators）必须有映射
    missing_leaf = sorted(leaf_no_di_codes - set(leaf_map.keys()))
    if missing_leaf:
        errors.append(f"缺失 leafIndicators 映射（末级且 dataIndicators=[]）：{missing_leaf}")

    # 4) leafIndicators 目标必须存在
    bad_leaf_targets = []
    for k, v in leaf_map.items():
        if not isinstance(v, str) or not v.strip():
            bad_leaf_targets.append((k, v))
        elif v not in element_codes:
            bad_leaf_targets.append((k, v))
    if bad_leaf_targets:
        errors.append("leafIndicators 映射目标不存在或非法：" + "; ".join([f"{k}->{v!r}" for k, v in bad_leaf_targets[:30]]) + (" ..." if len(bad_leaf_targets) > 30 else ""))

    # 5) 不允许出现“映射里有但体系里没有”的漂移
    extra_di = sorted(set(data_map.keys()) - di_codes)
    if extra_di:
        errors.append(f"存在多余 dataIndicators 映射（指标体系中不存在这些 code）：{extra_di}")

    extra_leaf = sorted(set(leaf_map.keys()) - leaf_no_di_codes)
    if extra_leaf:
        errors.append(f"存在多余 leafIndicators 映射（指标体系中不存在这些末级无 dataIndicators 的 code）：{extra_leaf}")

    # 6) 软校验：一个要素被多个 dataIndicator 复用，给 warning（不当作错误）
    reverse: Dict[str, List[str]] = {}
    for di_code, element_code in data_map.items():
        if isinstance(element_code, str):
            reverse.setdefault(element_code, []).append(di_code)
    reused = sorted([(e, codes) for e, codes in reverse.items() if len(codes) > 1], key=lambda x: (-len(x[1]), x[0]))
    if reused:
        # 只提示前 10 个
        preview = "; ".join([f"{e}<=({', '.join(codes[:6])}{'...' if len(codes)>6 else ''})" for e, codes in reused[:10]])
        warnings.append(f"提示：存在要素被多个 dataIndicator 复用（不一定错误）：{preview}")

    return ValidationResult(ok=(len(errors) == 0), errors=errors, warnings=warnings)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--elements-file", required=True, help="要素库 JSON 路径")
    parser.add_argument("--indicator-system-file", required=True, help="指标体系 JSON 路径")
    args = parser.parse_args()

    res = validate(Path(args.elements_file), Path(args.indicator_system_file))
    for w in res.warnings:
        print("WARNING:", w)
    if not res.ok:
        for e in res.errors:
            print("ERROR:", e)
        raise SystemExit(1)
    print("OK: indicatorElementMappings 校验通过")


if __name__ == "__main__":
    main()


