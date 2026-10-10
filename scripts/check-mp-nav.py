"""校验小程序内所有 navigateTo / switchTab 的目标路径真实存在。

为什么需要：路径写错（或 switchTab 用了非 tab 页）在开发时不会报错，
只在运行时静默失败或提示"页面不存在"。这与 WXML 事件绑定是同类问题。

用法: python scripts/check-mp-nav.py
"""
from __future__ import annotations

import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent / "miniprogram"

NAV_RE = re.compile(r"""wx\.(navigateTo|redirectTo|switchTab|reLaunch)\s*\(\s*\{[^}]*url:\s*[`'"]([^`'"]+)[`'"]""", re.S)


def main() -> None:
    app = json.loads((ROOT / "app.json").read_text(encoding="utf-8"))

    tab_pages = {item["pagePath"] for item in app["tabBar"]["list"]}
    all_pages = set(app["pages"]) | {
        f"{sp['root']}/{p}" for sp in app.get("subPackages", []) for p in sp["pages"]
    }

    problems: list[str] = []
    checked = 0

    for ts in sorted(ROOT.rglob("*.ts")):
        src = ts.read_text(encoding="utf-8")
        for m in NAV_RE.finditer(src):
            method, url = m.group(1), m.group(2)
            # 去掉查询串与模板变量插值
            path = url.split("?")[0].strip("/")
            if "${" in path or not path:
                continue
            checked += 1
            rel = ts.relative_to(ROOT)

            if path not in all_pages:
                problems.append(f"{rel}: {method} 目标 '{path}' 不在 app.json 注册的页面中")
                continue

            if method == "switchTab" and path not in tab_pages:
                problems.append(f"{rel}: switchTab 只能跳 tab 页，但 '{path}' 不是")
            if method in ("navigateTo", "redirectTo") and path in tab_pages:
                problems.append(f"{rel}: {method} 不能跳 tab 页 '{path}'（应使用 switchTab）")

    print(f"检查 {checked} 处页面跳转")
    if problems:
        print("\n发现问题：")
        for p in problems:
            print("  -", p)
        raise SystemExit(1)
    print("页面跳转目标全部有效")


if __name__ == "__main__":
    main()
