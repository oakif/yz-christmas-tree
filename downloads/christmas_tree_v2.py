import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
from matplotlib.patches import Polygon
import matplotlib.cm as cm
from PIL import Image, ImageDraw, ImageFont
import os

# 1. 定义风格配置 (6种风格，可以在后面代码中选择自己需要的)
styles = {
    '1': {
        'bg_col': '#0f0505',
        'tree_cols': ['#0B3D0B', '#144514', '#006400'],
        'trunk_col': '#3e2723',
        'decor_cols': ['#FFD700', '#CCA43B', '#8B0000'],
        'star_col': '#FFD700',
        'text_col': '#FFD700',
        'snow_col': 'white',
        'ribbon': True,
        'ribbon_col': '#D4AF37',
        'ribbon_width': 1.5,
    },
    '2': {
        'bg_col': '#F0F2F5',
        'tree_cols': ['#2F4F4F', '#5F9EA0', '#708090'],
        'trunk_col': '#696969',
        'decor_cols': ['#B0C4DE', '#FFFAF0', '#E0FFFF'],
        'star_col': '#B0C4DE',
        'text_col': '#708090',
        'snow_col': '#87CEFA',
        'ribbon': True,
        'ribbon_col': '#B0C4DE',
        'ribbon_width': 1.5,
    },
    '3': {
        'bg_col': '#1a1a1a',
        'tree_cols': ['#556B2F', '#6B8E23', '#808000'],
        'trunk_col': '#5D4037',
        'decor_cols': ['#CD853F', '#FFCC00'],
        'star_col': '#FFCC00',
        'text_col': '#DEB887',
        'snow_col': 'white',
        'ribbon': False,
        'ribbon_col': None,
        'ribbon_width': 0,
    },
    '4': {
        'bg_col': '#101010',
        'tree_cols': ['#006400', '#228B22'],
        'trunk_col': '#4E342E',
        'decor_cols': ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'],
        'star_col': '#FFD700',
        'text_col': '#FF6347',
        'snow_col': 'white',
        'ribbon': True,
        'ribbon_col': '#C0C0C0',
        'ribbon_width': 1.0,
    },
    '5': {
        'bg_col': '#000000',
        'tree_cols': ['#111111', '#050505'],
        'trunk_col': '#222222',
        'decor_cols': ['#FFFFFF', '#FFFFE0'],
        'star_col': '#FFFFFF',
        'text_col': '#FFFFFF',
        'snow_col': 'gray30',
        'ribbon': True,
        'ribbon_col': '#FFFFFF',
        'ribbon_width': 0.8,
    },
    '6': {
        'bg_col': '#1F0F12',
        'tree_cols': ['#D87093', '#FF69B4', '#FFB6C1'],
        'trunk_col': '#4A3728',
        'decor_cols': ['#FFFFFF', '#FFD700', '#FF1493'],
        'star_col': '#FFD700',
        'text_col': '#FFC0CB',
        'snow_col': '#FFF0F5',
        'ribbon': True,
        'ribbon_col': '#F8F8FF',
        'ribbon_width': 0.8,
    },
}

# 2. 在此选择风格 (1-6)
current_style_id = '1'
cfg = styles[current_style_id]

# 3. 生成树的数据
np.random.seed(2025)


def generate_tree_data(cfg):
    """生成树、树干、装饰和丝带的数据点"""
    all_points = []
    # 生成树叶
    n_leaves = 8000
    h = np.random.uniform(0, 1, n_leaves)
    base_r = 1 - h
    layer_cycle = (h * 7) % 1
    r = base_r * 0.65 * (0.4 + 0.6 * (1 - layer_cycle) ** 0.7)
    theta = np.random.uniform(0, 2 * np.pi, n_leaves)
    x = r * np.cos(theta)
    y = h - 0.5
    z = r * np.sin(theta)
    colors = np.random.choice(cfg['tree_cols'], n_leaves)
    sizes = np.random.uniform(0.6, 1.8, n_leaves)
    for i in range(n_leaves):
        all_points.append(
            {
                'x': x[i],
                'y': y[i],
                'z': z[i],
                'color': colors[i],
                'size': sizes[i],
                'type': 'tree',
                'alpha': 0.95,
            }
        )

    # 生成树干
    n_trunk = 1000
    h_trunk = np.random.uniform(-0.7, -0.45, n_trunk)
    r_trunk = 0.12
    theta_trunk = np.random.uniform(0, 2 * np.pi, n_trunk)
    x_trunk = r_trunk * np.cos(theta_trunk)
    y_trunk = h_trunk
    z_trunk = r_trunk * np.sin(theta_trunk)
    for i in range(n_trunk):
        all_points.append(
            {
                'x': x_trunk[i],
                'y': y_trunk[i],
                'z': z_trunk[i],
                'color': cfg['trunk_col'],
                'size': 1.2,
                'type': 'trunk',
                'alpha': 1.0,
            }
        )

    # 生成装饰
    n_decor = 600
    h_dec = np.random.uniform(0, 0.95, n_decor)
    base_r_dec = 1 - h_dec
    layer_cycle_dec = (h_dec * 7) % 1
    r_dec = base_r_dec * 0.68 * (0.4 + 0.6 * (1 - layer_cycle_dec) ** 0.7)
    theta_dec = np.random.uniform(0, 2 * np.pi, n_decor)
    x_dec = r_dec * np.cos(theta_dec)
    y_dec = h_dec - 0.5
    z_dec = r_dec * np.sin(theta_dec)
    decor_colors = np.random.choice(cfg['decor_cols'], n_decor)
    decor_sizes = np.random.uniform(2, 4, n_decor)
    for i in range(n_decor):
        all_points.append(
            {
                'x': x_dec[i],
                'y': y_dec[i],
                'z': z_dec[i],
                'color': decor_colors[i],
                'size': decor_sizes[i],
                'type': 'decor',
                'alpha': 1.0,
            }
        )

    # 生成丝带（如果启用）
    if cfg['ribbon']:
        n_rib = 6000
        h_rib = np.linspace(0, 0.95, n_rib)
        base_r_rib = (1 - h_rib) * 0.65 * 1.05
        theta_rib = 10 * np.pi * h_rib
        x_rib = base_r_rib * np.cos(theta_rib)
        y_rib = h_rib - 0.5
        z_rib = base_r_rib * np.sin(theta_rib)
        for i in range(n_rib):
            all_points.append(
                {
                    'x': x_rib[i],
                    'y': y_rib[i],
                    'z': z_rib[i],
                    'color': cfg['ribbon_col'],
                    'size': cfg['ribbon_width'],
                    'type': 'ribbon',
                    'alpha': 1.0,
                }
            )

    return all_points


def generate_snow(n_flakes=250):
    """生成雪花数据"""
    snow_points = []
    for _ in range(n_flakes):
        snow_points.append(
            {
                'x': np.random.uniform(-1, 1),
                'y': np.random.uniform(-0.8, 1.2),
                'z': np.random.uniform(-1, 1),
                'color': cfg['snow_col'],
                'size': np.random.uniform(0.5, 2),
                'type': 'snow',
                'alpha': np.random.uniform(0.5, 0.9),
                'speed': np.random.uniform(0.015, 0.035),
            }
        )
    return snow_points


def get_star_polygon(x_center=0, y_center=0.4, radius=0.03):
    """生成五角星的多边形点"""
    angles = np.linspace(np.pi / 2, 2.5 * np.pi, 11)[:-1]
    radii = np.repeat([radius, radius * 0.4], 5)
    x = x_center + radii * np.cos(angles)
    y = y_center + radii * np.sin(angles)
    return list(zip(x, y))


# 4. 生成静态和动态数据
static_data = generate_tree_data(cfg)
snow_data = generate_snow(250)
star_shape = get_star_polygon()

# 5. 创建图形和坐标轴
fig, ax = plt.subplots(figsize=(6, 7.5))
fig.patch.set_facecolor(cfg['bg_col'])
ax.set_facecolor(cfg['bg_col'])
ax.set_xlim(-0.8, 0.8)
ax.set_ylim(-0.8, 0.9)
ax.set_aspect('equal')
ax.axis('off')

# 用一个透明点初始化，避免空数组错误
scatter = ax.scatter([0], [0], s=[0.1], c=['white'], alpha=[0], edgecolors='none')

# 添加五角星
star_polygon = Polygon(
    star_shape, closed=True, facecolor=cfg['star_col'], edgecolor='white', linewidth=0.3
)
ax.add_patch(star_polygon)

# 添加文本 (如果没有指定字体，使用默认字体)
try:
    ax.text(
        0,
        0.6,
        'Merry Christmas ',
        fontsize=28,
        color=cfg['text_col'],
        ha='center',
        va='center',
        fontweight='bold',
        fontstyle='italic',
    )
except:
    ax.text(
        0,
        0.6,
        'Merry Christmas ',
        fontsize=28,
        color=cfg['text_col'],
        ha='center',
        va='center',
        fontweight='bold',
    )


def update(frame):
    angle = 2 * np.pi * (frame / 90)
    tree_points = []
    for point in static_data:
        x_rot = point['x'] * np.cos(angle) - point['z'] * np.sin(angle)
        z_rot = point['z'] * np.cos(angle) + point['x'] * np.sin(angle)
        depth = 1 / (2.5 - z_rot)
        x_proj = x_rot * depth * 2
        y_proj = point['y'] * depth * 2
        size_vis = point['size'] * depth * 1.5
        alpha_vis = (
            point['alpha'] * (z_rot + 1.2) / 2.2
            if point['type'] != 'snow'
            else point['alpha']
        )

        tree_points.append(
            {
                'x': x_proj,
                'y': y_proj,
                'color': point['color'],
                'size': size_vis,
                'alpha': alpha_vis,
            }
        )

    # 处理雪花数据
    snow_points = []
    for point in snow_data:
        y_final = -0.8 + (point['y'] - frame * point['speed'] - (-0.8)) % 2
        depth = 1 / (2.5 - point['z'])
        x_proj = point['x'] * depth * 2
        y_proj = y_final * depth * 2
        size_vis = point['size'] * depth * 1.5
        alpha_vis = point['alpha']

        snow_points.append(
            {
                'x': x_proj,
                'y': y_proj,
                'color': point['color'],
                'size': size_vis,
                'alpha': alpha_vis,
            }
        )

    # 合并所有点并按深度排序（模拟3D遮挡）
    all_points = tree_points + snow_points
    all_points.sort(
        key=lambda p: 1 / (abs(p['x']) + abs(p['y']) + 0.001)
    )  # 简单的深度排序

    # 更新散点图
    if all_points:
        scatter.set_offsets(np.array([[p['x'], p['y']] for p in all_points]))
        scatter.set_sizes([p['size'] * 10 for p in all_points])  # 调整大小比例
        scatter.set_color([p['color'] for p in all_points])
        scatter.set_alpha([p['alpha'] for p in all_points])

    return (scatter,)


# 7. 创建动画
ani = FuncAnimation(fig, update, frames=90, interval=1000 / 24, blit=True)

# 8. 保存动画（为GIF）并显示
print('正在生成动画...')
try:
    # 保存为GIF（需要pillow库）
    ani.save('christmas_tree.gif', writer='pillow', fps=24)
    print("动画已保存为 'christmas_tree.gif'")
except Exception as e:
    print(f'保存GIF时出错: {e}')
    print('将只显示动画窗口。')

plt.tight_layout()
plt.show()
# 保存到自定义路径，并调整质量，以下路径需要自己修改！！！
output_path = 'F:/python-learning/pythonProject/christmas_xinping.gif'
ani.save(output_path, writer='pillow', fps=20, dpi=100)
print(f'动画已保存至: {output_path}')
