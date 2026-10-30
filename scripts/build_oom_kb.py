# -*- coding: utf-8 -*-
"""Build the ENCRYPTED knowledge base for the AI Agent from the Saudi Aramco
Offshore Operations Manual (OOM) PDF.

The OOM is a controlled Saudi Aramco document and this repo is PUBLIC, so the
plaintext NEVER goes into the repo. This script:
  1. extracts the manual text with PyMuPDF (drops page headers/footers and the
     left-margin line numbers 5/10/15...), splits it into numbered sections using
     the manual's own table of contents, and chunks each section for search;
  2. optionally merges curated Vietnamese key-facts from a PRIVATE json file
     (kept outside the repo);
  3. gzips the JSON and encrypts it with AES-256-GCM. The key is derived with
     HKDF-SHA256 from the Cloudflare Pages `SECRET` env var, so only the gated
     Pages Function (functions/kb/oom.js) can decrypt it.

Output: public/kb/oom-rev3.enc  (= 12-byte IV || ciphertext+tag)
Optional plaintext copy for review: --plain <path OUTSIDE the repo>

If SECRET is rotated on Cloudflare, re-run this script with the new value.

Usage:
  python scripts/build_oom_kb.py --pdf "<manual.pdf>" --secret-file "<WDT_SECRETS.txt>" \
      [--facts "<private facts.json>"] [--plain "<private review.json>"]
"""
import argparse
import gzip
import json
import os
import re
import sys

import fitz  # PyMuPDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

HKDF_SALT = b"offshore-fleet-kb"
HKDF_INFO = b"oom-rev3"
MARGIN_NUMS = {str(n) for n in range(5, 105, 5)}
TOC_LINE = re.compile(r"^\s*((?:\d+\.)*\d+)\.?\s+(.+?)\s*\.{3,}\s*(\d+)\s*$")
UNNUMBERED = ["Preface", "Approval section", "References", "Abbreviations", "Definitions"]
FIRST_CHAPTER_PAGE = 27  # printed page where chapter 1 starts (per the manual's TOC)


def clean_page(page) -> str:
    """Body text of one page without header/footer and left-margin line numbers."""
    out_lines = []
    d = page.get_text("dict")
    for block in d["blocks"]:
        for line in block.get("lines", []):
            spans = []
            for s in line["spans"]:
                x0, y0, x1, y1 = s["bbox"]
                txt = s["text"]
                if y0 < 55 or y0 > 780:  # running header / page number / footer
                    continue
                if x1 <= 78 and txt.strip() in MARGIN_NUMS:  # margin line numbers
                    continue
                spans.append(txt)
            text = "".join(spans).strip()
            if text:
                out_lines.append(text)
    return "\n".join(out_lines)


def parse_toc(doc, first=1, last=13):
    """Numbered section list from the manual's own table of contents."""
    toc = []
    for i in range(first, last + 1):
        for raw in doc[i].get_text().splitlines():
            m = TOC_LINE.match(raw)
            if m:
                toc.append((m.group(1), re.sub(r"\s+", " ", m.group(2)).strip(), int(m.group(3))))
    return toc


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def build(pdf_path):
    doc = fitz.open(pdf_path)
    toc = parse_toc(doc)
    toc_by_num = {}
    for num, title, page in toc:
        toc_by_num.setdefault(num, (title, page))

    # Body starts after the TOC pages; printed page number = PDF index (0-based) here
    # (PDF page N shows printed page N-1).
    sections = [{"id": "", "title": "Front matter", "page": 0}]
    current = 0
    buf = {0: []}
    body_start = 14
    for pi in range(body_start, doc.page_count):
        printed = pi  # PDF page (pi+1) shows printed page pi
        for line in clean_page(doc[pi]).splitlines():
            head = None
            m = re.match(r"^((?:\d+\.)*\d+)\.?\s+(.{3,140})$", line)
            if m and m.group(1) in toc_by_num:
                ttl, _ = toc_by_num[m.group(1)]
                a, b = norm(m.group(2))[:10], norm(ttl)[:10]
                if a and (a.startswith(b[: len(a)]) or b.startswith(a[: len(b)])):
                    head = (m.group(1), ttl)
            elif line.strip() in UNNUMBERED and printed < FIRST_CHAPTER_PAGE:
                # Front-matter headings only — "References"/"Definitions" also appear
                # as sub-headings inside later sections and must stay as content there.
                head = ("", line.strip())
            if head:
                sections.append({"id": head[0], "title": head[1], "page": printed})
                current = len(sections) - 1
                buf[current] = []
                continue
            buf.setdefault(current, []).append(line)

    # Re-join words hyphenated across a line break ("ap-\nproximately") — only when the
    # joined word appears elsewhere in the manual, so real compounds ("self-\nelevating")
    # keep their hyphen.
    vocab = set()
    for lines in buf.values():
        for ln in lines:
            vocab.update(w.lower() for w in re.findall(r"[A-Za-z]{3,}", ln))

    def dehyphen(text: str) -> str:
        def fix(m):
            a, b = m.group(1), m.group(2)
            return a + b if (a + b).lower() in vocab else a + "-" + b
        return re.sub(r"([A-Za-z]+)-\n([a-z]+)", fix, text)

    # Chunk every section into ~900-char passages (paragraph-ish boundaries).
    chunks = []
    for si, lines in buf.items():
        text = dehyphen("\n".join(lines).strip())
        if not text:
            continue
        paras = re.split(r"\n(?=[A-Z0-9•\-–(])", text)
        cur = ""
        for para in paras:
            para = re.sub(r"[ \t]+", " ", para).strip()
            if len(cur) + len(para) > 900 and cur:
                chunks.append({"s": si, "t": cur.strip()})
                cur = ""
            cur += ("\n" if cur else "") + para
        if cur.strip():
            chunks.append({"s": si, "t": cur.strip()})

    meta = {
        "title": "Saudi Aramco Marine Department — Offshore Operations Manual (General Operational Guidance for Chartered and Project Vessels)",
        "rev": "Revision 3",
        "date": "January 2023",
        "classification": "Saudi Aramco: Company General Use — Level 1 Controlled",
        "pages": doc.page_count,
    }
    return {"v": 1, "doc": meta, "sections": sections, "chunks": chunks, "facts": []}


def read_secret(path: str) -> str:
    txt = open(path, encoding="utf-8").read()
    m = re.search(r"^SECRET\s*=\s*(\S+)\s*$", txt, re.M)
    if not m:
        sys.exit("SECRET not found in secret file")
    return m.group(1)


def encrypt(payload: bytes, secret: str) -> bytes:
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=HKDF_SALT, info=HKDF_INFO).derive(secret.encode())
    iv = os.urandom(12)
    return iv + AESGCM(key).encrypt(iv, payload, None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--secret-file", required=True)
    ap.add_argument("--facts")
    ap.add_argument("--plain")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "public", "kb", "oom-rev3.enc"))
    a = ap.parse_args()

    kb = build(a.pdf)
    if a.facts:
        kb["facts"] = json.load(open(a.facts, encoding="utf-8"))
    raw = json.dumps(kb, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if a.plain:
        repo = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        if os.path.abspath(a.plain).startswith(repo):
            sys.exit("Refusing to write plaintext inside the (public) repo")
        open(a.plain, "w", encoding="utf-8").write(json.dumps(kb, ensure_ascii=False, indent=1))
    blob = encrypt(gzip.compress(raw, 9), read_secret(a.secret_file))
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    open(a.out, "wb").write(blob)
    print(f"sections={len(kb['sections'])} chunks={len(kb['chunks'])} facts={len(kb['facts'])} "
          f"json={len(raw)/1024:.0f}KB enc={len(blob)/1024:.0f}KB -> {os.path.abspath(a.out)}")


if __name__ == "__main__":
    main()
