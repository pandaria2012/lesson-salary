"""生成小程序 tabBar 图标（4 个 tab × 2 种状态 = 8 张）。

规格来源：微信小程序 tabBar
- 建议尺寸 81×81px，单张 < 40KB，不支持网络图片
- 常态灰色、选中态主色 #1f6feb

用法: python scripts/gen-mp-tab-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 81
SS = 8  # 超采样，抗锯齿
W = SIZE * SS

NORMAL = (138, 143, 152)   # #8a8f98
ACTIVE = (31, 111, 235)    # #1f6feb

OUT = Path(__file__).resolve().parent.parent / "miniprogram" / "images"


def px(v: float) -> float:
    return v * SS


def blank() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def bars(color) -> Image.Image:
    """汇总：柱状图。"""
    img, d = blank()
    for i, (x0, x1, y0) in enumerate([(18, 30, 46), (34, 46, 30), (50, 62, 16)]):
        d.rounded_rectangle([px(x0), px(y0), px(x1), px(64)], radius=px(3), fill=color)
    d.rounded_rectangle([px(14), px(64), px(66), px(68)], radius=px(2), fill=color)
    return img


def list_rows(color) -> Image.Image:
    """记录：三行，每行一个圆点 + 一条线。"""
    img, d = blank()
    for y in (24, 40, 56):
        d.ellipse([px(16), px(y - 4), px(24), px(y + 4)], fill=color)
        d.rounded_rectangle([px(30), px(y - 3), px(66), px(y + 3)], radius=px(3), fill=color)
    return img


def book(color) -> Image.Image:
    """课程类型：书（圆角矩形 + 书脊）。"""
    img, d = blank()
    d.rounded_rectangle([px(18), px(14), px(64), px(66)], radius=px(6), fill=color)
    # 书脊用镂空表现（透明），避免依赖背景色
    d.rectangle([px(28), px(18), px(31), px(62)], fill=(0, 0, 0, 0))
    return img


def sliders(color) -> Image.Image:
    """设置：三条滑杆。"""
    img, d = blank()
    for y, knob in ((25, 30), (40, 50), (55, 36)):
        d.rounded_rectangle([px(14), px(y - 3), px(66), px(y + 3)], radius=px(3), fill=color)
        d.ellipse([px(knob - 7), px(y - 7), px(knob + 7), px(y + 7)], fill=(0, 0, 0, 0))
        d.ellipse([px(knob - 7), px(y - 7), px(knob + 7), px(y + 7)], outline=color, width=int(px(3)))
    return img


ICONS = {
    "summary": bars,
    "records": list_rows,
    "courses": book,
    "settings": sliders,
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in ICONS.items():
        for state, color in (("", NORMAL), ("-active", ACTIVE)):
            img = fn(color).resize((SIZE, SIZE), Image.Resampling.LANCZOS)
            path = OUT / f"tab-{name}{state}.png"
            img.save(path)
            print(f"{path.name}: {path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
