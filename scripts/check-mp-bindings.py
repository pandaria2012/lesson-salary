"""校验 WXML 中引用的事件处理函数在对应 .ts 中确实存在。

为什么需要：WXML 里写错 bindtap 名称不会报错，只会静默无响应。
DevTools 的编译不检查这一点，属于典型的"能在真机上才发现"的坑。

同时检查 WXML 标签配对，避免手工编辑造成结构错误。

用法: python scripts/check-mp-bindings.py
"""
from __future__ import annotations

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent / "miniprogram"

# 事件绑定：bindtap / catchtap / bind:change / bindinput / bindchange / catchtap 等
BIND_RE = re.compile(r"\b(?:bind|catch):?([a-zA-Z]+)\s*=\s*\"([^\"{}]+)\"")
# 标签名（用于配对检查）
TAG_RE = re.compile(r"<\s*(/?)([a-zA-Z][\w-]*)([^>]*?)(/?)\s*>")
# 自闭合或不需配对的标签
VOID_TAGS = {"image", "input", "icon", "progress", "switch", "slider", "canvas", "camera", "video", "audio"}


def ts_handlers(ts_path: pathlib.Path) -> set[str]:
    """粗略提取 .ts 中定义的方法名（页面/组件 methods 里的键）"""
    if not ts_path.exists():
        return set()
    src = ts_path.read_text(encoding="utf-8")
    names: set[str] = set()
    # 形如 `  onFoo(` 或 `  onFoo: function` 或 `  onFoo(e: ...) {`
    for m in re.finditer(r"^\s{2,}([A-Za-z_$][\w$]*)\s*(?::\s*(?:async\s*)?function|\()", src, re.M):
        names.add(m.group(1))
    # 形如 `  async onFoo(`
    for m in re.finditer(r"^\s{2,}async\s+([A-Za-z_$][\w$]*)\s*\(", src, re.M):
        names.add(m.group(1))
    return names


def check_tag_balance(wxml: pathlib.Path) -> list[str]:
    problems: list[str] = []
    text = wxml.read_text(encoding="utf-8")
    # 去掉注释
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    stack: list[str] = []
    for m in TAG_RE.finditer(text):
        closing, name, _attrs, self_close = m.group(1), m.group(2), m.group(3), m.group(4)
        if name in VOID_TAGS or self_close:
            if closing:
                problems.append(f"{wxml.name}: </{name}> 但该标签是自闭合/空元素")
            continue
        if closing:
            if not stack:
                problems.append(f"{wxml.name}: 多余的 </{name}>")
            elif stack[-1] != name:
                problems.append(f"{wxml.name}: 标签未正确闭合，期望 </{stack[-1]}> 实际 </{name}>")
                stack.pop()
            else:
                stack.pop()
        else:
            stack.append(name)
    for left in stack:
        problems.append(f"{wxml.name}: <{left}> 未闭合")
    return problems


def main() -> None:
    problems: list[str] = []
    checked = 0

    for wxml in sorted(ROOT.rglob("*.wxml")):
        ts = wxml.with_suffix(".ts")
        handlers = ts_handlers(ts)
        text = wxml.read_text(encoding="utf-8")

        for m in BIND_RE.finditer(text):
            fn = m.group(2).strip()
            # 跳过 WXML 表达式（如 {{...}}）—— 事件名不能是表达式，此处仅容错
            if "{" in fn or not fn:
                continue
            checked += 1
            if fn not in handlers:
                problems.append(f"{wxml.relative_to(ROOT)}: 绑定 {m.group(1)} 的处理函数 '{fn}' 在 {ts.name} 中不存在")

        problems.extend(check_tag_balance(wxml))

    print(f"检查 {checked} 处事件绑定")
    if problems:
        print("\n发现问题：")
        for p in problems:
            print("  -", p)
        raise SystemExit(1)
    print("事件绑定与标签配对全部通过")


if __name__ == "__main__":
    main()
