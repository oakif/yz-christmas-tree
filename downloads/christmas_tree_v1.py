import matplotlib

matplotlib.use('Agg')
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import imageio.v2 as imageio
from matplotlib.patches import Polygon

current_style_id = 1  # 在此切换风格 1-6

styles = {
    '1': dict(
        bg_col='#0f0505',
        tree_cols=['#0B3D0B', '#144514', '#006400'],
        trunk_col='#3e2723',
        decor_cols=['#FFD700', '#CCA43B', '#8B0000'],
        star_col='#FFD700',
        text_col='#FFD700',
        snow_col='white',
        ribbon=True,
        ribbon_col='#D4AF37',
        ribbon_width=1.5,
    ),
    '2': dict(
        bg_col='#F0F2F5',
        tree_cols=['#2F4F4F', '#5F9EA0', '#708090'],
        trunk_col='#696969',
        decor_cols=['#B0C4DE', '#FFFAF0', '#E0FFFF'],
        star_col='#B0C4DE',
        text_col='#708090',
        snow_col='#87CEFA',
        ribbon=True,
        ribbon_col='#B0C4DE',
        ribbon_width=1.5,
    ),
    '3': dict(
        bg_col='#1a1a1a',
        tree_cols=['#556B2F', '#6B8E23', '#808000'],
        trunk_col='#5D4037',
        decor_cols=['#CD853F', '#FFCC00'],
        star_col='#FFCC00',
        text_col='#DEB887',
        snow_col='white',
        ribbon=False,
        ribbon_col=None,
        ribbon_width=0,
    ),
    '4': dict(
        bg_col='#101010',
        tree_cols=['#006400', '#228B22'],
        trunk_col='#4E342E',
        decor_cols=['#FF0000', '#00FF00', '#0000FF', '#FFFF00'],
        star_col='#FFD700',
        text_col='#FF6347',
        snow_col='white',
        ribbon=True,
        ribbon_col='#C0C0C0',
        ribbon_width=1.0,
    ),
    '5': dict(
        bg_col='#000000',
        tree_cols=['#111111', '#050505'],
        trunk_col='#222222',
        decor_cols=['#FFFFFF', '#FFFFE0'],
        star_col='#FFFFFF',
        text_col='#FFFFFF',
        snow_col='gray30',
        ribbon=True,
        ribbon_col='#FFFFFF',
        ribbon_width=0.8,
    ),
    '6': dict(
        title='Pink Romance',
        bg_col='#1F0F12',
        tree_cols=['#D87093', '#FF69B4', '#FFB6C1'],
        trunk_col='#4A3728',
        decor_cols=['#FFFFFF', '#FFD700', '#FF1493'],
        star_col='#FFD700',
        text_col='#FFC0CB',
        snow_col='#FFF0F5',
        ribbon=True,
        ribbon_col='#F8F8FF',
        ribbon_width=0.8,
    ),
}

cfg = styles[str(current_style_id)]

np.random.seed(2025)


# =========================
# 2) 几何函数：星星多边形（对应 get_star_polygon）
# =========================
def get_star_polygon(x_center, y_center, radius):
    angles = np.linspace(np.pi / 2, 2.5 * np.pi, 11)[:-1]
    radii = np.array([radius, radius * 0.4] * 5)
    x = x_center + radii * np.cos(angles)
    y = y_center + radii * np.sin(angles)
    return np.column_stack([x, y])


# =========================
# 3) 生成树结构数据（对应 generate_tree_data）
# =========================
def generate_tree_data(cfg):
    # tree leaves
    n_leaves = 8000
    h = np.random.uniform(0, 1, n_leaves)
    base_r = 1 - h
    layer_cycle = (h * 7) % 1
    r = base_r * 0.65 * (0.4 + 0.6 * (1 - layer_cycle) ** 0.7)
    theta = np.random.uniform(0, 2 * np.pi, n_leaves)

    df_tree = pd.DataFrame(
        {
            'x': r * np.cos(theta),
            'y': h - 0.5,
            'z': r * np.sin(theta),
            'col': np.random.choice(cfg['tree_cols'], n_leaves),
            'size': np.random.uniform(0.6, 1.8, n_leaves),
            'type': 'tree',
            'alpha': 0.95,
        }
    )

    # trunk
    n_trunk = 1000
    h_trunk = np.random.uniform(-0.7, -0.45, n_trunk)
    r_trunk = 0.12
    theta_trunk = np.random.uniform(0, 2 * np.pi, n_trunk)
    df_trunk = pd.DataFrame(
        {
            'x': r_trunk * np.cos(theta_trunk),
            'y': h_trunk,
            'z': r_trunk * np.sin(theta_trunk),
            'col': cfg['trunk_col'],
            'size': 1.2,
            'type': 'trunk',
            'alpha': 1.0,
        }
    )

    # decor
    n_decor = 600
    h_dec = np.random.uniform(0, 0.95, n_decor)
    base_r_dec = 1 - h_dec
    layer_cycle_dec = (h_dec * 7) % 1
    r_dec = base_r_dec * 0.68 * (0.4 + 0.6 * (1 - layer_cycle_dec) ** 0.7)
    theta_dec = np.random.uniform(0, 2 * np.pi, n_decor)

    df_decor = pd.DataFrame(
        {
            'x': r_dec * np.cos(theta_dec),
            'y': h_dec - 0.5,
            'z': r_dec * np.sin(theta_dec),
            'col': np.random.choice(cfg['decor_cols'], n_decor),
            'size': np.random.uniform(2, 4, n_decor),
            'type': 'decor',
            'alpha': 1.0,
        }
    )

    # ribbon
    df_ribbon = None
    if cfg['ribbon']:
        n_rib = 6000
        h_rib = np.linspace(0, 0.95, n_rib)
        base_r_rib = (1 - h_rib) * 0.65 * 1.05
        theta_rib = 10 * np.pi * h_rib

        df_ribbon = pd.DataFrame(
            {
                'x': base_r_rib * np.cos(theta_rib),
                'y': h_rib - 0.5,
                'z': base_r_rib * np.sin(theta_rib),
                'col': cfg['ribbon_col'],
                'size': cfg['ribbon_width'],
                'type': 'ribbon',
                'alpha': 1.0,
            }
        )

    frames = [df_trunk, df_tree, df_decor]
    if df_ribbon is not None:
        frames.append(df_ribbon)

    return pd.concat(frames, ignore_index=True)


# =========================
# 4) 生成雪花（对应 generate_snow）
# =========================
def generate_snow(cfg, n_flakes=250):
    return pd.DataFrame(
        {
            'x': np.random.uniform(-1, 1, n_flakes),
            'y': np.random.uniform(-0.8, 1.2, n_flakes),
            'z': np.random.uniform(-1, 1, n_flakes),
            'col': cfg['snow_col'],
            'size': np.random.uniform(0.5, 2, n_flakes),
            'type': 'snow',
            'alpha': np.random.uniform(0.5, 0.9, n_flakes),
            'speed': np.random.uniform(0.015, 0.035, n_flakes),
        }
    )


# =========================
# 5) 每帧处理（对应 process_frame）
# =========================
def process_frame(frame_id, static_data, snow_data, n_frames):
    angle = 2 * np.pi * (frame_id / n_frames)

    # rotate tree around Y axis
    x_rot = static_data['x'] * np.cos(angle) - static_data['z'] * np.sin(angle)
    z_rot = static_data['z'] * np.cos(angle) + static_data['x'] * np.sin(angle)

    tree_rot = static_data.copy()
    tree_rot['x_rot'] = x_rot
    tree_rot['z_rot'] = z_rot
    tree_rot['y_final'] = tree_rot['y']

    # snow falling loop
    snow_curr = snow_data.copy()
    snow_curr['y_final'] = (
        -0.8 + (snow_curr['y'] - frame_id * snow_curr['speed'] - (-0.8)) % 2
    )
    snow_curr['x_rot'] = snow_curr['x']
    snow_curr['z_rot'] = snow_curr['z']

    df = pd.concat([tree_rot, snow_curr], ignore_index=True)

    # perspective projection
    depth = 1 / (2.5 - df['z_rot'])
    df['depth'] = depth
    df['x_proj'] = df['x_rot'] * depth * 2
    df['y_proj'] = df['y_final'] * depth * 2
    df['size_vis'] = df['size'] * depth * 1.5
    df['alpha_vis'] = df['alpha'] * np.where(
        df['type'] == 'snow', 1, (df['z_rot'] + 1.2) / 2.2
    )

    df = df.sort_values('depth')  # painter's algorithm

    return df


# =========================
# 6) 生成动画 GIF
# =========================
def make_gif(
    output_path='christmas_tree.gif', n_frames=90, fps=24, width=600, height=750
):
    static_data = generate_tree_data(cfg)
    snow_data = generate_snow(cfg, 250)
    star = get_star_polygon(0, 0.4, 0.03)

    images = []

    dpi = 100
    fig_w = width / dpi
    fig_h = height / dpi

    for frame_id in range(1, n_frames + 1):
        df = process_frame(frame_id, static_data, snow_data, n_frames)

        fig, ax = plt.subplots(figsize=(fig_w, fig_h), dpi=dpi)
        fig.patch.set_facecolor(cfg['bg_col'])
        ax.set_facecolor(cfg['bg_col'])

        # scatter points
        ax.scatter(
            df['x_proj'],
            df['y_proj'],
            s=df['size_vis'] ** 2,
            c=df['col'],
            alpha=df['alpha_vis'],
            linewidths=0,
        )

        # star polygon
        poly = Polygon(
            star,
            closed=True,
            facecolor=cfg['star_col'],
            edgecolor='white',
            linewidth=0.3,
        )
        ax.add_patch(poly)

        # text
        ax.text(
            0,
            0.6,
            'Merry Christmas',
            ha='center',
            va='center',
            fontsize=24,
            color=cfg['text_col'],
            fontweight='bold',
        )

        ax.set_xlim(-0.8, 0.8)
        ax.set_ylim(-0.8, 0.9)
        ax.set_aspect('equal')
        ax.axis('off')

        # draw to image buffer
        fig.canvas.draw()
        img = np.asarray(fig.canvas.buffer_rgba())[:, :, :3].copy()
        images.append(img)
        plt.close(fig)

    imageio.mimsave(output_path, images, fps=fps)
    print(f'✅ GIF saved to {output_path}')


if __name__ == '__main__':
    make_gif()
