"""校验小程序工程结构完整性（页面四件套、tabBar 图标、组件引用）。

DevTools 在缺文件时会报错但信息零散，这个脚本一次列出全部问题。
用法: python scripts/check-mp-structure.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / "miniprogram"


def main() -> None:
    app = json.loads((ROOT / "app.json").read_text(encoding="utf-8"))
    problems: list[str] = []

    def check_page(page_path: str) -> None:
        for ext in (".ts", ".wxml", ".json", ".wxss"):
            f = ROOT / f"{page_path}{ext}"
            if not f.exists():
                problems.append(f"缺少 {f.relative_to(ROOT)}")

    print("=== 主包页面 ===")
    for p in app["pages"]:
        check_page(p)
        print(f"  {p}")

    print("=== 分包 ===")
    for sp in app.get("subPackages", []):
        print(f"  root: {sp['root']}")
        for p in sp["pages"]:
            check_page(f"{sp['root']}/{p}")
            print(f"    {p}")

    print("=== tabBar 图标 ===")
    for item in app["tabBar"]["list"]:
        for key in ("iconPath", "selectedIconPath"):
            f = ROOT / item[key]
            ok = f.exists()
            if not ok:
                problems.append(f"缺少图标 {item[key]}")
            print(f"  {item['text']}: {item[key]} [{'OK' if ok else 'MISSING'}]")

    print("=== 自定义组件引用 ===")
    all_pages = list(app["pages"]) + [
        f"{sp['root']}/{pg}" for sp in app.get("subPackages", []) for pg in sp["pages"]
    ]
    for p in all_pages:
        cfg = ROOT / f"{p}.json"
        if not cfg.exists():
            continue
        data = json.loads(cfg.read_text(encoding="utf-8"))
        for name, path in (data.get("usingComponents") or {}).items():
            target = ROOT / path.lstrip("/")
            ok = (target / "index.wxml").exists() or target.with_suffix(".wxml").exists()
            if not ok:
                problems.append(f"{p} 引用组件 {name} -> {path} 不存在")
            print(f"  {p}: {name} -> {path} [{'OK' if ok else 'MISSING'}]")

    print()
    if problems:
        print("发现问题：")
        for x in problems:
            print("  -", x)
        raise SystemExit(1)
    print("结构检查全部通过")


if __name__ == "__main__":
    main()
