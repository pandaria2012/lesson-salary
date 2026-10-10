"""生成「课时记账本」微信小程序头像。

规则来源：微信公众平台小程序注册页
- 格式 png/bmp/jpeg/jpg/gif，单文件 <= 2MB，建议 144x144px
- 同一次上传需同时满足方形与圆形两种裁切预览
  -> 图形内容必须居中并留足安全边距，否则圆切时四角会丢信息

用法: python scripts/gen-miniprogram-avatar.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 144
SS = 8  # 超采样倍数，用于抗锯齿
W = SIZE * SS

BG_TOP = (42, 123, 240)     # #2a7bf0
BG_BOTTOM = (23, 91, 196)   # #175bc4
BAND = (23, 91, 196)        # 日历顶栏
BODY = (255, 255, 255)
RING = (255, 255, 255)
BAR_HI = (31, 111, 235)     # #1f6feb 主色，首条记录
BAR = (191, 214, 244)       # #bfd6f4 次级记录

OUT = Path(__file__).resolve().parent.parent / "assets" / "miniprogram"


def px(v: float) -> float:
    return v * SS


def gradient(w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(round(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)
    return img


def rounded(d: ImageDraw.ImageDraw, box, radius: float, fill) -> None:
    d.rounded_rectangle(
        [px(box[0]), px(box[1]), px(box[2]), px(box[3])],
        radius=px(radius),
        fill=fill,
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    img = gradient(W, W)
    d = ImageDraw.Draw(img)

    # 装订环：先画，下端随后被日历体与顶栏覆盖，形成"环插进本子"的效果
    rounded(d, (45, 26, 53, 44), 4, RING)
    rounded(d, (91, 26, 99, 44), 4, RING)

    # 日历体
    rounded(d, (28, 36, 116, 116), 13, BODY)

    # 顶栏：圆角矩形打底，再用直角矩形补齐下缘，得到"上圆下方"的顶栏
    rounded(d, (28, 36, 116, 58), 13, BAND)
    d.rectangle([px(28), px(50), px(116), px(58)], fill=BAND)

    # 三条记录条（长度递减，暗示"多条记录"）
    rounded(d, (42, 70, 102, 78), 4, BAR_HI)
    rounded(d, (42, 85, 90, 93), 4, BAR)
    rounded(d, (42, 100, 78, 108), 4, BAR)

    icon = img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    icon.save(OUT / "avatar-144.png")
    icon.resize((512, 512), Image.Resampling.LANCZOS).save(OUT / "avatar-512.png")

    # 预览：方形 + 圆形并排，用于人工确认两种裁切都不丢信息
    pad, gap = 24, 32
    prev = Image.new("RGB", (pad * 2 + SIZE * 2 + gap, pad * 2 + SIZE), (245, 246, 248))
    prev.paste(icon, (pad, pad))

    big = SIZE * 4
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, big - 1, big - 1], fill=255)
    prev.paste(icon, (pad + SIZE + gap, pad), mask.resize((SIZE, SIZE), Image.Resampling.LANCZOS))

    prev.save(OUT / "avatar-preview.png")

    for f in sorted(OUT.glob("*.png")):
        print(f"{f.name}: {f.stat().st_size} bytes")


if __name__ == "__main__":
    main()
