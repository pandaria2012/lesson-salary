"""校验小程序名称/简称候选是否符合微信字符数规则（1 个中文 = 2 个字符）。

用法: python scripts/check-mp-names.py
"""
NAMES = [
    "上课记账本",
    "课时记账簿",
    "课时记录本",
    "课时小账房",
    "三尺课时账",
    "排课记账本",
    "课时记账小助手",
    "我的课时记账本",
]

SHORTS = [
    ("上课记账本", "上课记账"),
    ("课时记账簿", "课时记账"),
    ("课时记录本", "课时记录"),
    ("课时小账房", "小账房"),
    ("三尺课时账", "课时账"),
    ("排课记账本", "排课记账"),
    ("课时记账小助手", "课时记账"),
    ("我的课时记账本", "课时记账"),
]

# 平台排除的名称（含金融类目风险或已确认被占用）
EXCLUDED = ["课时薪资", "课时记账本"]


def char_count(s: str) -> int:
    """中文按 2 个字符计，其余按 1 个。"""
    return sum(2 if "\u4e00" <= c <= "\u9fff" else 1 for c in s)


def main() -> None:
    print("=== 名称候选（规则：4~30 字符） ===")
    for n in NAMES:
        total = char_count(n)
        cjk = sum(1 for c in n if "\u4e00" <= c <= "\u9fff")
        ok = "OK" if 4 <= total <= 30 else "FAIL"
        print(f"  {n}  {cjk} 个中文 -> {total} 字符  [{ok}]")

    print()
    print("=== 简称候选（规则：4~10 字符） ===")
    for name, s in SHORTS:
        total = char_count(s)
        ok = "OK" if 4 <= total <= 10 else "FAIL"
        note = "连续片段" if s in name else "!! 非连续，需页面实测 !!"
        print(f"  {s}  (来自 {name}) -> {total} 字符  [{ok}] {note}")

    print()
    print("=== 已排除 ===")
    for n in EXCLUDED:
        print(f"  {n} -> {char_count(n)} 字符")


if __name__ == "__main__":
    main()
