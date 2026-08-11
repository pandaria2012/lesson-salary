# -*- coding: utf-8 -*-
"""生成「课时薪资」PWA 图标（192/512 PNG，扁平风：书本 + 金币）。"""
import os
from PIL import Image, ImageDraw, ImageFont

S = 1024  # 设计基准尺寸
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')

def pick_font(size):
    candidates = [
        r'C:\Windows\Fonts\msyhbd.ttc',   # 微软雅黑 Bold
        r'C:\Windows\Fonts\simhei.ttf',   # 黑体
        r'C:\Windows\Fonts\arialbd.ttf',  # Arial Bold
    ]
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()

def rounded_rect(d, box, radius, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def draw_icon():
    img = Image.new('RGB', (S, S))
    d = ImageDraw.Draw(img)
    # 垂直渐变背景（主题蓝）
    top = (76, 140, 255)
    bottom = (24, 84, 200)
    for y in range(S):
        t = y / (S - 1)
        c = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (S, y)], fill=c)

    # ---- 书本（白色圆角矩形 + 书脊 + 书页线）----
    book = (352, 380, 672, 830)          # 外轮廓
    rounded_rect(d, book, radius=36, fill='white')
    # 左书脊（浅蓝条）
    rounded_rect(d, (352, 380, 392, 830), radius=20, fill='#d7e6ff')
    # 书页线（浅蓝灰）
    line_color = '#cfe0ff'
    for ly in (480, 545, 610, 675):
        d.line([(420, ly), (645, ly)], fill=line_color, width=10)

    # ---- 小金币（左上，叠在大金币后面）----
    small_c = (525, 360)
    d.ellipse([small_c[0]-72, small_c[1]-72, small_c[0]+72, small_c[1]+72],
              fill='#ffd97a', outline='#e6b84c', width=10)

    # ---- 大金币（含 ¥）----
    big_c = (650, 445)
    d.ellipse([big_c[0]-150, big_c[1]-150, big_c[0]+150, big_c[1]+150],
              fill='#ffc93c', outline='#e6a817', width=14)
    font = pick_font(180)
    d.text((big_c[0], big_c[1] + 8), '¥', font=font, fill='#1450c4', anchor='mm')

    return img

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    base = draw_icon()
    for size in (512, 192):
        icon = base.resize((size, size), Image.LANCZOS)
        path = os.path.join(OUT_DIR, f'icon-{size}.png')
        icon.save(path, 'PNG')
        print(f'wrote {path} ({size}x{size})')

if __name__ == '__main__':
    main()
