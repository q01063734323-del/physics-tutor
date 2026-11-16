"""Summarize a complete local OCR inventory without importing any exercises."""
import argparse
import hashlib
import json
import re
from pathlib import Path

from pypdf import PdfReader

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("ocr", type=Path)
args = parser.parse_args()
source_hash = hashlib.sha256(args.source.read_bytes()).hexdigest()
pdf = PdfReader(args.source)
pages = []
chapters = {}
for index, page in enumerate(pdf.pages, 1):
    recognized = args.ocr / f"page-{index:03}.json"
    data = json.loads(recognized.read_text()) if recognized.exists() else {}
    if data and data.get("sourceHash") != source_hash:
        raise SystemExit("OCR inventory belongs to another file")
    text = data.get("text", "")
    for match in re.finditer(r"ТЕМА\s+(\d+)\.\s*([^\n]+)", text[:350]):
        chapters.setdefault(match[1], {"number": int(match[1]), "title": match[2], "firstPdfPage": index})
    pages.append({"pdfPage": index, "nativeTextCharacters": len(page.extract_text() or ""), "ocrComplete": bool(data), "ocrConfidence": data.get("confidence"), "mentionsFigure": bool(re.search(r"рисунк|график|схем", text, re.I)), "reviewRequired": not data or data.get("confidence", 0) < 85})
report = {"sourceHash": source_hash, "pages": len(pdf.pages), "ocrPages": sum(page["ocrComplete"] for page in pages),
          "nativeTextPages": sum(page["nativeTextCharacters"] > 0 for page in pages),
          "chapters": sorted(chapters.values(), key=lambda item: item["number"]),
          "pagesMentioningFigures": sum(page["mentionsFigure"] for page in pages),
          "lowConfidencePages": [page["pdfPage"] for page in pages if page["reviewRequired"]],
          "exerciseCount": {"verifiedExact": None, "coverClaim": "Более 1600 заданий", "note": "OCR не даёт надёжного точного подсчёта: повторная нумерация, составные задания и таблицы ответов. Число на обложке не является результатом автоматического подсчёта."},
          "pagesInventory": pages}
destination = args.ocr.parent / "document-analysis.json"
destination.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({key: value for key, value in report.items() if key != "pagesInventory"}, ensure_ascii=False, indent=2))
