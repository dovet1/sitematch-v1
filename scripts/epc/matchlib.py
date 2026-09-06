"""Address normalisation and premises matching.

Shared primitives for the EPC matcher. Everything brand-specific — aliases,
operator families, rival detection, admissible property types — is configuration
built by build_config.py, not code, so this module stays brand-agnostic.

Two rules here carry most of the weight and are easy to get wrong:

  compatible()      Liberal rejection. Any disagreement on unit or house number
                    means different premises. Used to discard candidates.

  corroboration()   Strict acceptance. A house number only counts when it sits at
                    the start of an address component or follows Unit/No/Block.
                    "Junction 1 Retail Park" carries a digit that is part of a
                    name, not a street number; treating it as one matched a
                    McDonald's to a 9,672 m2 retail park anchor.
"""
import re

SUFFIX = {"ROAD":"RD","STREET":"ST","AVENUE":"AVE","DRIVE":"DR","LANE":"LN","CLOSE":"CL",
          "SQUARE":"SQ","PLACE":"PL","CRESCENT":"CRES","PARADE":"PDE","TERRACE":"TER",
          "CENTRE":"CTR","CENTER":"CTR","GARDENS":"GDNS","PARKWAY":"PKWY","NORTH":"N",
          "SOUTH":"S","EAST":"E","WEST":"W","SAINT":"ST","GREAT":"GT"}
NOISE = {"LTD","LIMITED","PLC","LLP","UK","GB","GMBH","THE","UNIT","UNITS","AND","STORES",
         "STORE","PART","GROUND","FIRST","SECOND","FLOOR","OF","AT","CO","PREMISES","SHOP",
         "BUILDING","RETAIL","PARK","LEVEL","BLOCK"}
PC_RE = re.compile(r"\b[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}\b")

def _clean(*parts):
    s = " ".join(p for p in parts if p)
    return re.sub(r"\s+", " ", s.upper().replace("&", " AND ").replace("'", "")).strip()

def norm_tokens(*parts):
    s = re.sub(r"[^A-Z0-9 ]+", " ", _clean(*parts))
    return [t for t in (SUFFIX.get(x, x) for x in s.split() if x) if t not in NOISE]

def units(*parts):
    txt, out = _clean(*parts), set()
    for m in re.finditer(r"\b(?:UNITS?|U)\s*([0-9]{1,4}[A-Z]?(?:\s*/\s*[0-9]{1,4}[A-Z]?)*|[A-Z])\b", txt):
        out |= {x.strip() for x in m.group(1).split("/") if x.strip()}
    return out

def numbers(*parts):
    raw, out = _clean(*parts), set()
    for a, b in re.findall(r"\b(\d{1,4})\s*[-/]\s*(\d{1,4})\b", raw):
        a, b = int(a), int(b)
        if 0 < b - a <= 200:
            out |= {str(n) for n in range(a, b + 1)}
    out |= {t for t in re.sub(r"[^A-Z0-9 ]", " ", raw).split() if t.isdigit() and len(t) <= 4}
    return out

def compatible(s_parts, c_parts):
    """False when the addresses name demonstrably different premises."""
    su, cu = units(*s_parts), units(*c_parts)
    if su and cu and not (su & cu): return False
    sn, cn = numbers(*s_parts), numbers(*c_parts)
    if sn and cn and not (sn & cn): return False
    return True

def addr_score(stoks, ctoks):
    if not stoks: return 0.0
    S, C = set(stoks), set(ctoks)
    shared = S & C
    if not {t for t in shared if not t.isdigit()}: return 0.0
    return len(shared) / len(S)

def store_addr_parts(s):
    return [PC_RE.sub(" ", _clean(x)) for x in (s["address_line_1"], s["address_line_2"]) if x]

def store_tokens(s):
    drop = set(norm_tokens(s.get("town"))) | set(norm_tokens(s.get("county")))
    toks = norm_tokens(*store_addr_parts(s))
    return [t for t in toks if t not in drop] or toks


# A certificate that explicitly names a different retail operator is that
# operator's certificate. Our unit is frequently a concession inside their
# building (a Greggs inside a Tesco), so the address agrees while the floor
# area describes the whole host store. Distinctive tokens only.
_LEAD = re.compile(r"^\s*(\d{1,4})(?:\s*[-/]\s*(\d{1,4}))?\b")
_AFTER = re.compile(r"\b(?:UNITS?|U|NO|NOS|BLOCK|SUITE|PLOT)\.?\s*(\d{1,4})(?:\s*[-/]\s*(\d{1,4}))?\b")

def house_numbers(*parts):
    out = set()
    for part in parts:
        if not part:
            continue
        for chunk in re.split(r"[,;]", _clean(part)):
            for m in (_LEAD.match(chunk.strip()),):
                if m: out |= _span(m)
            for m in _AFTER.finditer(chunk):
                out |= _span(m)
    return out

def _span(m):
    a = m.group(1); b = m.group(2)
    if b and 0 < int(b) - int(a) <= 200:
        return {str(n) for n in range(int(a), int(b) + 1)}
    return {a} | ({b} if b else set())

def corroboration(s_parts, cert_addr):
    """How strongly the certificate address confirms this is the same premises."""
    su, cu = units(*s_parts), units(cert_addr)
    if su and cu and su & cu:
        return "unit"
    sn, cn = house_numbers(*s_parts), house_numbers(cert_addr)
    if sn and cn and sn & cn:
        return "number"
    return "street-name-only"
