# -*- coding: utf-8 -*-
"""生成「课时薪资」PWA 图标（192/512 PNG，扁平化时钟硬币 + ¥）。"""
import math
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
    cx = cy = S // 2
    R = 330            # 表盘半径
    ring_w = 36        # 表盘描边宽度
    # 白色表盘圆环
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline='white', width=ring_w)
    # 12/3/6/9 点钟刻度点
    dot = 26
    for ang in (0, 90, 180, 270):
        x = cx + R * math.cos(math.radians(ang))
        y = cy + R * math.sin(math.radians(ang))
        d.ellipse([x - dot, y - dot, x + dot, y + dot], fill='white')
    # 中心 ¥ 符号
    font = pick_font(430)
    d.text((cx, cy + 14), '¥', font=font, fill='white', anchor='mm')
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
