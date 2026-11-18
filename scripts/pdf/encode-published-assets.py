"""Encode only approved exercise fragments, preserving every RGB pixel."""
import hashlib
import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image


def encode(item):
    source, target = map(Path, item)
    original = Image.open(source).convert("RGB")
    if not target.exists():
        original.save(target, format="WEBP", lossless=True, method=4)
    encoded = Image.open(target).convert("RGB")
    if original.size != encoded.size or original.tobytes() != encoded.tobytes():
        raise ValueError(f"Image changed during export: {source.name}")
    return {"file": target.name, "width": original.width, "height": original.height,
            "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "bytes": target.stat().st_size}


if __name__ == "__main__":
    plan = json.loads(Path(sys.argv[1]).read_text())
    with ProcessPoolExecutor(max_workers=4) as pool:
        assets = []
        for index, result in enumerate(pool.map(encode, plan), 1):
            assets.append(result)
            if index % 200 == 0:
                print(f"Verified images: {index}/{len(plan)}", flush=True)
    Path(sys.argv[2]).write_text(json.dumps(assets, indent=2) + "\n")
    print(f"Verified images: {len(assets)}/{len(plan)}", flush=True)
