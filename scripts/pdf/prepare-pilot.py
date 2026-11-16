"""Prepare at most ten private PDF drafts from a visually reviewed extraction plan.

Requires local Poppler, pypdf and Pillow. No network requests or Firebase SDK.
The plan is deliberately separate from OCR: mathematical OCR is not trusted to
publish a condition, infer an answer, assign an exam number or invent a solution.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

from PIL import Image
from pypdf import PdfReader


def digest(data):
    return hashlib.sha256(data).hexdigest()


def save_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("plan", type=Path)
    parser.add_argument("--output", type=Path, default=Path(".local/pdf-imports/pilot"))
    args = parser.parse_args()
    root = Path.cwd().resolve()
    output = args.output.resolve()
    private_root = root / ".local/pdf-imports"
    if not output.is_relative_to(private_root):
        raise SystemExit("Drafts can only be written under .local/pdf-imports/; never public/ or Firebase")
    source_hash = digest(args.source.read_bytes())
    plan = json.loads(args.plan.read_text(encoding="utf-8"))
    if plan.get("sourceHash") != source_hash:
        raise SystemExit("The plan does not match this exact PDF")
    entries = plan.get("tasks", [])
    if not 5 <= len(entries) <= 10:
        raise SystemExit("Pilot only: provide 5–10 tasks. Mass import is not enabled.")
    reader = PdfReader(args.source)
    output.mkdir(parents=True, exist_ok=True)
    assets_dir = output / "assets"
    cache_dir = output / "render-cache"
    assets_dir.mkdir(exist_ok=True)
    cache_dir.mkdir(exist_ok=True)
    previous = {}
    manifest_file = output / "manifest.json"
    if manifest_file.exists():
        old = json.loads(manifest_file.read_text())
        if old.get("sourceId") != source_hash:
            raise SystemExit("This output belongs to a different PDF; choose another private folder")
        previous = {question["id"]: question for question in old.get("questions", [])}
    questions, rejected, seen = [], [], set()
    stats = {"added": 0, "updated": 0, "unchanged": 0}

    def asset(crop):
        page = crop["page"]
        if not isinstance(page, int) or not 1 <= page <= len(reader.pages):
            raise ValueError("Invalid source page")
        rendered = cache_dir / f"page-{page:03}.png"
        if not rendered.exists():
            subprocess.run(["pdftoppm", "-f", str(page), "-l", str(page), "-singlefile", "-scale-to", "1800", "-png", str(args.source), str(rendered.with_suffix(""))], check=True, capture_output=True)
        with Image.open(rendered) as image:
            box = crop["bbox"]
            if len(box) != 4 or not (0 <= box[0] < box[2] <= image.width and 0 <= box[1] < box[3] <= image.height):
                raise ValueError(f"Invalid crop on page {page}: {box} for {image.size}")
            selected = image.crop(tuple(box))
            import io
            encoded = io.BytesIO()
            selected.save(encoded, format="PNG", optimize=True)
            data = encoded.getvalue()
        sha = digest(data)
        filename = f"asset-{sha[:20]}.png"
        destination = assets_dir / filename
        if not destination.exists():
            destination.write_bytes(data)
        return {"id": sha[:20], "role": crop["role"], "url": f"/api/pdf-import-preview?asset={filename}", "alt": crop["alt"], "sha256": sha, "pdfPage": page, "bbox": box}

    for entry in entries:
        try:
            key = entry["key"]
            if not re.fullmatch(r"[a-z0-9-]+", key) or key in seen:
                raise ValueError("Duplicate or invalid stable task key")
            seen.add(key)
            if not entry.get("prompt", "").strip() or not entry.get("conditionChecked"):
                raise ValueError("Incomplete condition or transcription not checked against the scan")
            if entry.get("examNumber") and not entry.get("mappingEvidence"):
                raise ValueError("Do not infer an exam number without evidence")
            images = [asset(crop) for crop in entry.get("crops", [])]
            if entry.get("needsDiagram") and not any(image["role"] == "diagram" for image in images):
                raise ValueError("Required figure is missing")
            answer = entry.get("answer")
            if answer and not (entry.get("answerChecked") and entry.get("answerPage")):
                raise ValueError("Answer must be checked against a referenced source page")
            if entry.get("solution") and not entry.get("solutionPage"):
                raise ValueError("A solution must have a source page; do not invent missing solutions")
            question = {
                "id": f"pdf-{source_hash[:12]}-{key}", "origin": "pdf", "exam": "ЕГЭ",
                "examNumber": entry.get("examNumber"), "examYear": 2027 if entry.get("examNumber") else None,
                "mapping": {"status": "confirmed" if entry.get("examNumber") else "unmapped", "evidence": entry.get("mappingEvidence", "Номер ЕГЭ не подтверждён.")},
                "section": entry["section"], "topics": list(dict.fromkeys(entry["topics"])),
                "prompt": entry["prompt"], "assets": images, "answer": answer, "solution": entry.get("solution"),
                "source": {"id": source_hash, "title": plan["title"], "sha256": source_hash, "pdfPage": entry["page"], "printedPage": entry.get("printedPage"), "taskLabel": entry["label"], "answerPage": entry.get("answerPage"), "solutionPage": entry.get("solutionPage")},
                "rights": {"status": "unknown", "note": "В скане есть копирайт издательства. Разрешение на публикацию не установлено."},
                "review": {"status": "needs_review", "conditionComplete": True, "answerCheckedAgainstSource": bool(answer and entry.get("answerChecked")), "figuresChecked": bool(entry.get("figuresChecked")), "mathChecked": bool(entry.get("mathChecked")), "issues": entry.get("issues", []) + ["Ожидает проверки преподавателем и отдельного подтверждения прав."]},
            }
            question["version"] = digest(json.dumps(question, ensure_ascii=False, sort_keys=True).encode())[:16]
            prior = previous.get(question["id"])
            stats["unchanged" if prior and prior["version"] == question["version"] else "updated" if prior else "added"] += 1
            questions.append(question)
            save_json(output / "checkpoint.json", {"sourceId": source_hash, "planHash": digest(args.plan.read_bytes()), "completed": [item["id"] for item in questions], "rejected": rejected})
        except (KeyError, TypeError, ValueError, OSError, subprocess.CalledProcessError) as error:
            rejected.append({"key": entry.get("key"), "error": str(error)})
    manifest = {"manifestVersion": 1, "sourceId": source_hash, "title": plan["title"], "questions": questions,
                "summary": {"processed": len(questions), "rejected": len(rejected), "duplicateCount": 0, "reimport": stats, "warnings": ["Все записи остаются локальными черновиками; Firebase не используется.", "Права на публикацию не подтверждены.", "Обработан только пилотный набор. OCR остальных страниц не означает, что все задачи проверены.", "Решения включены только там, где они есть у выбранного задания в источнике."]}, "errors": rejected}
    save_json(manifest_file, manifest)
    save_json(output / "import-report.json", {"sourceId": source_hash, "pdfPages": len(reader.pages), "processed": len(questions), "rejected": rejected, "stats": stats, "published": 0})
    print(json.dumps({"processed": len(questions), "rejected": rejected, "stats": stats, "published": 0}, ensure_ascii=False))


if __name__ == "__main__":
    main()
