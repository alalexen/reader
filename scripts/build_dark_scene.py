"""Regenerate the unified dark scenes with a smooth castle-to-background blend.

This is an optional design-time tool, not an application runtime dependency.
Run from the repository root after installing Pillow and NumPy:
    python scripts/build_dark_scene.py

Existing source artwork stays untouched. Only the transition of the castle's
left edge changes; the layout, timer, books, cup, rabbit and light mode do not.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
BACKGROUND = (9, 14, 19)


def smoothstep(start: float, end: float, values: np.ndarray) -> np.ndarray:
    """Interpolate smoothly between zero and one with no sharp gradient ends."""
    fraction = np.clip((values - start) / (end - start), 0, 1)
    return fraction * fraction * (3 - 2 * fraction)


def soften_castle_transition(image: Image.Image) -> Image.Image:
    """Feather the castle's left wall without blurring the cup or books."""
    rgba = np.asarray(image.convert("RGBA")).copy()
    height, width = rgba.shape[:2]
    x = np.arange(width, dtype=np.float32) / width
    y = np.arange(height, dtype=np.float32) / height

    # Keep the moon and upper clouds unchanged. Fade the architecture gradually
    # into the empty page; the cup and books further right remain sharp.
    building = smoothstep(0.22, 0.39, y)
    edge = 1 - smoothstep(0.26, 0.69, x)
    fade = 1.0 - building[:, None] * edge[None, :]
    rgba[:, :, 3] = np.clip(rgba[:, :, 3] * fade, 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def create_background(width: int, height: int) -> Image.Image:
    """Create the same restrained blue-black atmosphere for both viewports."""
    yy, xx = np.ogrid[:height, :width]
    glow = np.exp(
        -(((xx / width - 0.89) / 0.35) ** 2
          + ((yy / height - 0.08) / 0.42) ** 2) * 2.1
    )
    blue = np.exp(
        -(((xx / width - 0.17) / 0.40) ** 2
          + ((yy / height - 0.83) / 0.65) ** 2) * 3.1
    )
    channels = [
        np.clip(
            base + glow * (1.9 + index * 0.5) + blue * (0.3 + index * 0.2),
            0, 255,
        ).astype(np.uint8)
        for index, base in enumerate(BACKGROUND)
    ]
    return Image.fromarray(np.stack(channels, axis=-1), "RGB")


def render_scene(
    name: str,
    viewport: tuple[int, int],
    sidebar_width: int,
    castle_width: int,
    castle_top: int,
    rabbit: Image.Image,
    castle: Image.Image,
) -> None:
    """Composite a single 2x background without modifying its layout geometry."""
    viewport_width, viewport_height = viewport
    width, height = viewport_width * 2, viewport_height * 2
    canvas = create_background(width, height).convert("RGBA")

    rabbit_width = sidebar_width * 2
    rabbit_height = round(rabbit_width * rabbit.height / rabbit.width)
    rabbit_image = rabbit.resize(
        (rabbit_width, rabbit_height), Image.Resampling.LANCZOS
    )
    canvas.alpha_composite(rabbit_image, (0, max(0, height - rabbit_height)))

    castle_pixels = castle_width * 2
    castle_height = round(castle_pixels * castle.height / castle.width)
    castle_image = castle.resize(
        (castle_pixels, castle_height), Image.Resampling.LANCZOS
    )
    canvas.alpha_composite(castle_image, (width - castle_pixels, castle_top * 2))

    output = ASSETS / f"{name}.webp"
    canvas.convert("RGB").save(output, "WEBP", quality=97, method=6)
    print(f"{output.name}: {width} x {height}, {output.stat().st_size} bytes")


def main() -> None:
    """Build both approved viewport variants from the retained source artwork."""
    rabbit = Image.open(ASSETS / "dark-sidebar-seamless.webp").convert("RGBA")
    castle = soften_castle_transition(
        Image.open(ASSETS / "dark-castle-seamless.webp")
    )
    render_scene("dark-scene-wide", (1920, 1080), 260, 670, -14, rabbit, castle)
    render_scene("dark-scene-laptop", (1448, 1086), 245, 595, -8, rabbit, castle)


if __name__ == "__main__":
    main()
