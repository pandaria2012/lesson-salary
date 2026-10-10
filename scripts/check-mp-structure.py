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

    print("=== 自定义组件 ===")
    all_pages = list(app["pages"]) + [
        f"{sp['root']}/{pg}" for sp in app.get("subPackages", []) for pg in sp["pages"]
    ]
    referenced: set[str] = set()
    for p in all_pages:
        cfg = ROOT / f"{p}.json"
        if not cfg.exists():
            continue
        data = json.loads(cfg.read_text(encoding="utf-8"))
        for name, path in (data.get("usingComponents") or {}).items():
            # 以 "/" 开头的是**相对 miniprogramRoot** 的绝对路径，且已含组件文件名，
            # 例如 "/components/sheet/index" → miniprogram/components/sheet/index.wxml
            target = ROOT / path.lstrip("/")
            referenced.add(str(target))
            for ext in (".wxml", ".json", ".ts"):
                f = target.with_suffix(ext)
                if not f.exists():
                    problems.append(f"{p} 引用组件 {name} -> {path} 缺少 {target.name}{ext}")
            print(f"  {p}: {name} -> {path}")

    # 组件自身检查：wxss 缺失 + 样式隔离声明
    # 背景：小程序自定义组件默认样式隔离，app.wxss 的规则进不去。
    # 曾因 month-picker 缺 index.wxss，导致 .month-picker{display:flex} 失效、
    # 月份选择器退化成竖排（picker 是块级元素）。这类问题只会在真机/GUI 里暴露。
    print("=== 组件样式完整性 ===")
    for comp in sorted(p for p in ROOT.rglob("index.json") if (p.parent / "index.wxml").exists()):
        d = comp.parent
        rel = d.relative_to(ROOT)
        has_wxss = (d / "index.wxss").exists()
        ts = d / "index.ts"
        ts_src = ts.read_text(encoding="utf-8") if ts.exists() else ""
        shares = "addGlobalClass" in ts_src or "apply-shared" in ts_src or "shared" in ts_src
        print(f"  {rel}: wxss={'Y' if has_wxss else 'N'} 共享全局样式={'Y' if shares else 'N'}")
        if not has_wxss and not shares:
            problems.append(
                f"组件 {rel} 既无 index.wxss 又未开 addGlobalClass —— "
                f"app.wxss 的样式不会生效（布局会静默退化）"
            )
        if not shares:
            problems.append(
                f"组件 {rel} 未开 addGlobalClass：若其模板用到 app.wxss 中的类名"
                f"（如 .btn / .field / .input）将不生效"
            )

    print()
    if problems:
        print("发现问题：")
        for x in problems:
            print("  -", x)
        raise SystemExit(1)
    print("结构检查全部通过")


if __name__ == "__main__":
    main()
