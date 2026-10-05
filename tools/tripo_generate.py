"""Generate 3D assets for 地层之下 with the Tripo v3 API.

Usage:
    python tools/tripo_generate.py                 # generate every missing asset
    python tools/tripo_generate.py trowel brush    # only the named assets
    python tools/tripo_generate.py --force trowel  # regenerate even if the GLB exists

The API key is read from the TRIPO_API_KEY env var, falling back to D:/datday/2.
Results (task ids, credits, preview urls) are written to assets/tripo_manifest.json.
"""
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
MANIFEST = ASSETS / "tripo_manifest.json"
BASE = "https://openapi.tripo3d.ai/v3"
PROXY = os.environ.get("TRIPO_PROXY", "http://127.0.0.1:10808")
PROXIES = {"http": PROXY, "https": PROXY} if PROXY else None

STYLE = (
    "stylized handmade clay diorama style, soft matte plasticine material, "
    "slightly chunky proportions, natural earthy colors, single isolated object, "
    "clean silhouette, no base, no pedestal"
)
NEGATIVE = "text, logo, watermark, pedestal, base plate, floor, multiple objects, glossy plastic, candy colors"

H_MODEL = "v3.1-20260211"

# Each asset: prompt + generation options. Character gets rigged and animated afterwards.
ASSETS_SPEC = {
    "trowel": {
        "prompt": "An archaeologist's pointing trowel: a flat diamond-shaped steel blade with a worn edge, "
                  "a short bent metal neck and a rounded varnished wooden handle. Field excavation tool. " + STYLE,
        "face_limit": 8000,
    },
    "brush": {
        "prompt": "A small soft-bristle excavation brush used to clean fossils: a flat wooden handle with a "
                  "rounded end and a short dense tuft of light brown natural bristles held by a metal ferrule. " + STYLE,
        "face_limit": 8000,
    },
    "bamboo_pick": {
        "prompt": "A thin bamboo pick tool for removing rock around fossils: a slender pale bamboo stick about "
                  "20 cm long with a sharpened flat chisel tip and a visible bamboo node near the grip. " + STYLE,
        "face_limit": 4000,
    },
    "archaeologist": {
        "prompt": "A friendly Chinese field paleontologist standing in a relaxed T-pose, full body, arms straight "
                  "out to the sides: wide-brim canvas sun hat, khaki field vest with pockets over a light shirt, "
                  "rolled sleeves, cargo trousers, sturdy brown boots, small canvas satchel. Chibi clay figure "
                  "proportions, simple friendly face. " + STYLE,
        "face_limit": 20000,
        "rig": True,
        "animations": ["preset:biped:idle", "preset:biped:walk", "preset:biped:dig", "preset:biped:shovel", "preset:biped:cheer"],
    },
    "tail_vertebrae": {
        "prompt": "A short articulated series of four fossilized dinosaur tail vertebrae lying in a gentle curve, "
                  "each with a spool-shaped centrum and a short upward neural spine, pale ochre mineralized bone "
                  "with fine cracks and reddish sandstone stains. Paleontology specimen. " + STYLE,
        "face_limit": 15000,
    },
    "vertebra": {
        "prompt": "A single large fossilized theropod dinosaur dorsal vertebra: thick hourglass centrum, tall "
                  "neural spine and two side transverse processes, pale ochre mineralized bone with cracks and "
                  "reddish sandstone stains. Paleontology specimen. " + STYLE,
        "face_limit": 12000,
    },
    "rib": {
        "prompt": "A long curved fossilized dinosaur rib fragment, gently arched flattened bone broken at one end, "
                  "rib head with two small knobs at the other end, pale ochre mineralized bone with cracks and "
                  "reddish sandstone stains. Paleontology specimen. " + STYLE,
        "face_limit": 8000,
    },
    "bone_fragment": {
        "prompt": "An irregular broken chunk of fossilized dinosaur limb bone, jagged fractured edges showing "
                  "spongy inner bone texture, pale ochre and brown mineralized bone with reddish sandstone stains. " + STYLE,
        "face_limit": 6000,
    },
    "yangchuanosaurus": {
        "prompt": "A Yangchuanosaurus, a large Late Jurassic carnivorous theropod dinosaur from Sichuan China, "
                  "standing on two strong hind legs, long stiff horizontal tail, large head with small nasal and "
                  "eye ridges, short three-fingered arms, muted olive and rust brown skin with faint stripes. "
                  "Museum reconstruction. " + STYLE,
        "face_limit": 30000,
    },
    "canopy": {
        "prompt": "A small temporary excavation rain shelter: four slender wooden poles with rope ties holding a "
                  "slightly sagging faded blue-green canvas tarp roof, open on all sides. " + STYLE,
        "face_limit": 8000,
    },
    "toolbox": {
        "prompt": "An old wooden field toolbox with a carry handle, open top, holding a few rolled maps, a tape "
                  "measure, a notebook and small labeled specimen bags. " + STYLE,
        "face_limit": 12000,
    },
    "site_sign": {
        "prompt": "A small wooden excavation site sign: a weathered plank board on a single wooden stake, blank "
                  "face with no writing, nail heads, slightly tilted. " + STYLE,
        "face_limit": 3000,
    },
    "grid_stake": {
        "prompt": "A single short wooden survey stake for an excavation grid, square pointed post with an orange "
                  "string tied around the top and a small blank paper tag. " + STYLE,
        "face_limit": 2000,
    },
    # --- home page (index.html): map props and card icons ---
    "map_pin": {
        "prompt": "A chunky location map pin marker: a classic teardrop pin with a round head and a pointed tip, "
                  "plain off-white cream clay with a small flat round inset on the head. " + STYLE,
        "face_limit": 3000,
    },
    "map_hills": {
        "prompt": "A tiny miniature landscape piece: a cluster of three low rounded sage green hills with soft "
                  "terraced slopes, a few small round trees and a thin dirt path. " + STYLE,
        "face_limit": 8000,
    },
    "compass": {
        "prompt": "A vintage field compass: a round brass case with a cream dial, a simple red and white needle "
                  "and four short cardinal tick marks, lying flat. " + STYLE,
        "face_limit": 5000,
    },
    "field_radio": {
        "prompt": "A small vintage portable transistor radio: a rounded box in faded olive green with a cream "
                  "perforated speaker grille, one round tuning knob and a short telescopic antenna. " + STYLE,
        "face_limit": 6000,
    },
    "red_rock": {
        "prompt": "A chunk of layered purple-red Jurassic sandstone with clear horizontal strata bands in brick red, "
                  "rust and pale tan, rough broken edges and a flat top. Geology sample. " + STYLE,
        "face_limit": 6000,
    },
    "feather_fossil": {
        "prompt": "A flat rounded slab of pale grey shale with an embossed impression of a small feathered dinosaur "
                  "skeleton, long tail and faint feather traces around the arms. Jehol biota fossil plate. " + STYLE,
        "face_limit": 8000,
    },
}


def api_key():
    key = os.environ.get("TRIPO_API_KEY")
    if not key:
        key = Path("D:/datday/2").read_text(encoding="utf-8").strip()
    return key


SESSION = requests.Session()
SESSION.headers["Authorization"] = f"Bearer {api_key()}"
if PROXIES:
    SESSION.proxies.update(PROXIES)


def call(method, path, **kw):
    for attempt in range(6):
        r = SESSION.request(method, BASE + path, timeout=60, **kw)
        if r.status_code == 429:
            wait = int(r.headers.get("Retry-After") or 2 ** attempt)
            print(f"  429, waiting {wait}s")
            time.sleep(wait)
            continue
        body = r.json()
        if body.get("code") != 0:
            raise RuntimeError(f"{method} {path} -> {r.status_code} {body}")
        return body["data"]
    raise RuntimeError(f"{method} {path}: retries exhausted")


def wait_task(task_id, label, timeout=900):
    start = time.time()
    last = None
    while time.time() - start < timeout:
        task = call("GET", f"/tasks/{task_id}")
        status, progress = task["status"], task.get("progress", 0)
        if (status, progress) != last:
            print(f"  [{label}] {status} {progress}%")
            last = (status, progress)
        if status == "success":
            return task
        if status in ("failed", "cancelled", "banned", "expired", "unknown"):
            raise RuntimeError(f"{label} task {task_id} ended with {status}: {task}")
        time.sleep(3)
    raise TimeoutError(f"{label} task {task_id} timed out")


def download(url, dest):
    r = requests.get(url, timeout=180, proxies=PROXIES)
    r.raise_for_status()
    dest.write_bytes(r.content)
    print(f"  saved {dest.relative_to(ROOT)} ({len(r.content) / 1024:.0f} KB)")


def load_manifest():
    return json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}


_lock = threading.Lock()


def save_manifest(m):
    with _lock:
        MANIFEST.write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding="utf-8")


def generate(name, spec, manifest):
    entry = manifest.setdefault(name, {})
    body = {
        "prompt": spec["prompt"],
        "negative_prompt": NEGATIVE,
        "model": H_MODEL,
        "texture": True,
        "pbr": True,
        "texture_quality": "standard",
        "face_limit": spec["face_limit"],
        "compress": "geometry",
    }
    if spec.get("rig"):
        body.pop("compress")  # keep the mesh untouched for the rigging step
    task_id = call("POST", "/generation/text-to-model", json=body)["task_id"]
    print(f"[{name}] text_to_model {task_id}")
    entry.update(prompt=spec["prompt"], model=H_MODEL, face_limit=spec["face_limit"], task_id=task_id)
    save_manifest(manifest)

    task = wait_task(task_id, name)
    out = task["output"]
    entry["credits"] = task.get("credits_consumed")
    entry["preview"] = out.get("rendered_image_url")
    download(out["model_url"], ASSETS / f"{name}.glb")
    if out.get("rendered_image_url"):
        download(out["rendered_image_url"], ASSETS / "previews" / f"{name}.png")
    save_manifest(manifest)

    if spec.get("rig"):
        rig_id = call("POST", "/animations/rig", json={
            "input": task_id, "model": "v1.0-20240301", "rig_type": "biped", "out_format": "glb",
        })["task_id"]
        print(f"[{name}] rig {rig_id}")
        rig = wait_task(rig_id, name + ":rig")
        entry["rig_task_id"] = rig_id
        entry["rig_credits"] = rig.get("credits_consumed")
        save_manifest(manifest)

        if rig["output"].get("model_url"):
            download(rig["output"]["model_url"], ASSETS / f"{name}.glb")  # rigged mesh, skeleton for the clips

        # A multi-animation retarget only keeps one clip in the GLB, so retarget each preset on its own
        # and export animation-only files (assets/anim/<clip>.glb) that share the rigged skeleton.
        (ASSETS / "anim").mkdir(exist_ok=True)
        entry["animations"] = spec["animations"]
        clips = entry.setdefault("clips", {})
        for preset in spec["animations"]:
            clip = preset.rsplit(":", 1)[-1]
            anim_id = call("POST", "/animations/retarget", json={
                "input": rig_id, "animation": preset, "out_format": "glb",
                "bake_animation": True, "animate_in_place": True, "export_with_geometry": False,
            })["task_id"]
            print(f"[{name}] retarget {clip} {anim_id}")
            anim = wait_task(anim_id, f"{name}:{clip}")
            clips[clip] = {"task_id": anim_id, "credits": anim.get("credits_consumed")}
            download(anim["output"]["model_url"], ASSETS / "anim" / f"{clip}.glb")
            save_manifest(manifest)


def main(argv):
    force = "--force" in argv
    names = [a for a in argv if not a.startswith("--")] or list(ASSETS_SPEC)
    unknown = [n for n in names if n not in ASSETS_SPEC]
    if unknown:
        sys.exit(f"unknown assets: {unknown}; choose from {list(ASSETS_SPEC)}")
    (ASSETS / "previews").mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    bal = call("GET", "/account/balance")
    print(f"balance {bal['balance']} (frozen {bal['frozen']})")
    todo = []
    for name in names:
        if (ASSETS / f"{name}.glb").exists() and not force:
            print(f"[{name}] exists, skip")
        else:
            todo.append(name)

    def run(name):
        try:
            generate(name, ASSETS_SPEC[name], manifest)
            return None
        except Exception as e:  # keep going so one bad prompt doesn't block the batch
            print(f"[{name}] FAILED: {e}")
            return name

    # H-series concurrency is 10 per account; stay below it.
    with ThreadPoolExecutor(max_workers=6) as pool:
        failed = [n for n in pool.map(run, todo) if n]
    bal = call("GET", "/account/balance")
    print(f"balance {bal['balance']} (frozen {bal['frozen']})")
    if failed:
        sys.exit(f"failed: {failed}")


if __name__ == "__main__":
    main(sys.argv[1:])
