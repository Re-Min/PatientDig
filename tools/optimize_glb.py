"""Shrink Tripo GLB textures so the bundled prototype stays small.

Tripo exports three 2048px textures per model (Color / ORM / NormalGL), ~2-4 MB per file.
This rewrites every embedded image as a smaller JPEG and repacks the binary chunk,
keeping meshopt-compressed bufferViews intact.

Usage: python tools/optimize_glb.py   (assets/*.glb + assets/anim/*.glb -> assets/opt/)
"""
import io
import json
import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets"
OUT = SRC / "opt"

# Max texture edge per role; small hand tools need less detail than fossils.
SIZES = {"Color": 1024, "NormalGL": 1024, "ORM": 512}
SMALL = {"trowel", "brush", "bamboo_pick", "grid_stake", "site_sign"}


def read_glb(path):
    b = path.read_bytes()
    json_len = struct.unpack("<I", b[12:16])[0]
    gltf = json.loads(b[20:20 + json_len])
    bin_start = 20 + json_len + 8
    bin_len = struct.unpack("<I", b[20 + json_len:24 + json_len])[0]
    return gltf, b[bin_start:bin_start + bin_len]


def write_glb(path, gltf, binary):
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    binary += b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    out = struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(js), 0x4E4F534A) + js
    out += struct.pack("<II", len(binary), 0x004E4942) + binary
    path.write_bytes(out)


def shrink(data, role, small):
    img = Image.open(io.BytesIO(data)).convert("RGB")
    edge = SIZES.get(role, 1024) // (2 if small else 1)
    if max(img.size) > edge:
        img = img.resize((edge, edge), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90 if role == "NormalGL" else 82, optimize=True)
    return buf.getvalue()


def optimize(src, dst):
    gltf, binary = read_glb(src)
    small = src.stem in SMALL
    replaced = {}
    for img in gltf.get("images", []):
        bv = gltf["bufferViews"][img["bufferView"]]
        start = bv.get("byteOffset", 0)
        role = img.get("name", "").split("_")[0]
        replaced[img["bufferView"]] = shrink(binary[start:start + bv["byteLength"]], role, small)
        img["mimeType"] = "image/jpeg"

    # Repack buffer 0. A bufferView can point at it directly or through EXT_meshopt_compression.
    new = bytearray()
    for i, bv in enumerate(gltf.get("bufferViews", [])):
        ext = bv.get("extensions", {}).get("EXT_meshopt_compression")
        target = ext if ext is not None and ext.get("buffer", 0) == 0 else (bv if bv.get("buffer", 0) == 0 else None)
        if target is None:
            continue
        start = target.get("byteOffset", 0)
        chunk = replaced.get(i, binary[start:start + target["byteLength"]])
        new += b"\0" * (-len(new) % 4)
        target["byteOffset"] = len(new)
        target["byteLength"] = len(chunk)
        new += chunk
    gltf["buffers"][0]["byteLength"] = len(new)
    write_glb(dst, gltf, bytes(new))
    print(f"{src.relative_to(SRC)}: {src.stat().st_size // 1024} KB -> {dst.stat().st_size // 1024} KB")


def main():
    for folder, out in ((SRC, OUT), (SRC / "anim", OUT / "anim")):
        out.mkdir(parents=True, exist_ok=True)
        for src in sorted(folder.glob("*.glb")):
            optimize(src, out / src.name)


if __name__ == "__main__":
    main()
