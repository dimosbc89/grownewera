"""Extract the Greek site copy from the Word doc into content/copy.json.

Usage: python3 -I tools/extract-copy.py content/site-copy.docx content/copy.json

Output is a flat list of blocks in document order:
  {"t": "Heading1|Heading2|Heading3|P|li", "b": bold?, "x": text, "list": numId, "ordered": bool}
  {"t": "table", "rows": [[cell, ...], ...]}
build.mjs turns that list into pages.
"""
import html
import json
import re
import sys
import zipfile

src, dst = sys.argv[1], sys.argv[2]
docx = zipfile.ZipFile(src)
xml = docx.read("word/document.xml").decode("utf8")
numbering = docx.read("word/numbering.xml").decode("utf8")
abstract_fmt = {
    a: re.search(r'w:numFmt w:val="(\w+)"', b).group(1)
    for a, b in re.findall(r'<w:abstractNum [^>]*w:abstractNumId="(\d+)"[^>]*>(.*?)</w:abstractNum>', numbering, re.S)
}
ordered = {
    int(n): abstract_fmt.get(a) == "decimal"
    for n, a in re.findall(r'<w:num w:numId="(\d+)"[^>]*>.*?<w:abstractNumId w:val="(\d+)"', numbering, re.S)
}
body = xml[xml.index("<w:body>"):]


def text(p):
    p = p.replace("<w:tab/>", "\t").replace("<w:br/>", "\n")
    return html.unescape("".join(re.findall(r"<w:t(?: [^>]*)?>([^<]*)</w:t>", p)))


blocks = []
for m in re.finditer(r"<w:tbl>.*?</w:tbl>|<w:p[ >].*?</w:p>", body, re.S):
    x = m.group(0)
    if x.startswith("<w:tbl>"):
        rows = []
        for r in re.findall(r"<w:tr[ >].*?</w:tr>", x, re.S):
            cells = re.findall(r"<w:tc>.*?</w:tc>", r, re.S)
            rows.append([" / ".join(text(p) for p in re.findall(r"<w:p[ >].*?</w:p>", c, re.S)).strip() for c in cells])
        blocks.append({"t": "table", "rows": rows})
        continue
    t = text(x).strip()
    if not t:
        continue
    style = re.search(r'w:pStyle w:val="([^"]+)"', x)
    style = style.group(1) if style else "P"
    block = {"t": style if style.startswith("Heading") else "P", "b": bool(re.search(r"<w:b/>|<w:b w:val=\"(1|true)\"", x)), "x": t}
    num = re.search(r'w:numId w:val="(\d+)"', x)
    if num:
        block["t"] = "li"
        block["list"] = int(num.group(1))
        block["ordered"] = ordered.get(block["list"], False)
    blocks.append(block)

json.dump(blocks, open(dst, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{len(blocks)} blocks -> {dst}")
