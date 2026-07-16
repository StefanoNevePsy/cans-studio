from __future__ import annotations

import argparse
import difflib
import json
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DETAILS_PATH = ROOT / "src" / "itemDetails.json"
DATA_PATH = ROOT / "src" / "cansData.ts"
MANUALS = {
    "cans-0-5": Path(
        r"E:\DOWNLOAD\FireFox\Manuale 0-5 Versione 3.0 2025-1.pdf"
    ),
    "cans-5-17": Path(
        r"E:\DOWNLOAD\FireFox\Manuale CANS 5-17+ versione 3.0_03.26-1.pdf"
    ),
}
PAGE_RANGES = {
    "cans-0-5": range(13, 57),
    "cans-5-17": range(16, 69),
}


@dataclass
class ManualBlock:
    source: str
    page: int
    title: str
    description: str
    score_hints: dict[str, str]
    raw_lines: list[str]
    raw_text: str


@dataclass
class LayoutBlock:
    source: str
    page: int
    title: str
    text: str


def load_details() -> dict[str, dict[str, object]]:
    details = json.loads(DETAILS_PATH.read_text(encoding="utf-8"))
    for detail in details.values():
        if "text" in detail:
            continue
        hints = detail.get("scoreHints", {})
        detail["text"] = "\n".join(
            [
                str(detail.get("description", "")),
                *(str(hint) for hint in hints.values()),
            ]
        )
    return details


def item_ids() -> list[str]:
    source = DATA_PATH.read_text(encoding="utf-8")
    return re.findall(r'item\("([^"]+)"', source)


def grid_items(source: str) -> list[tuple[str, str]]:
    text = DATA_PATH.read_text(encoding="utf-8")
    records = re.findall(
        r'item\(\s*"([^"]+)"\s*,\s*"([^"]+)"',
        text,
        flags=re.DOTALL,
    )
    prefix = "05-" if source == "cans-0-5" else "517-"
    return [(item_id, label) for item_id, label in records if item_id.startswith(prefix)]


def title_key(text: str) -> str:
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub(r"\b[A-Z]\d+(?:\s*bis)?\b", " ", text)
    return comparable_text(text)


def title_similarity(left: str, right: str) -> float:
    left_key = title_key(left)
    right_key = title_key(right)
    if not left_key or not right_key:
        return 0.0
    if left_key in right_key or right_key in left_key:
        return min(len(left_key), len(right_key)) / max(len(left_key), len(right_key))
    return difflib.SequenceMatcher(None, left_key, right_key).ratio()


def normalized_token(token: str) -> str:
    decomposed = unicodedata.normalize("NFKD", token.casefold())
    return "".join(
        character
        for character in decomposed
        if not unicodedata.combining(character) and character.isalnum()
    )


def token_spans(text: str) -> list[tuple[str, int, int]]:
    spans: list[tuple[str, int, int]] = []
    for match in re.finditer(r"[\wÀ-ÿ’'’-]+", text, flags=re.UNICODE):
        token = normalized_token(match.group())
        if token:
            spans.append((token, match.start(), match.end()))
    return spans


def normalized_char_map(text: str) -> tuple[str, list[int]]:
    characters: list[str] = []
    positions: list[int] = []
    for index, character in enumerate(text):
        for normalized in unicodedata.normalize("NFKD", character.casefold()):
            if unicodedata.combining(normalized) or not normalized.isalnum():
                continue
            characters.append(normalized)
            positions.append(index)
    return "".join(characters), positions


def content_overlap(left: str, right: str) -> float:
    left_tokens = {token for token, _, _ in token_spans(left)[:80]}
    right_tokens = {token for token, _, _ in token_spans(right)[:80]}
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / len(left_tokens | right_tokens)


def hungarian_max(scores: list[list[float]]) -> list[int]:
    row_count = len(scores)
    column_count = len(scores[0]) if scores else 0
    if row_count > column_count:
        raise ValueError("Hungarian assignment requires at least as many columns as rows")
    max_score = max(max(row) for row in scores) if scores else 0.0
    costs = [[max_score - value for value in row] for row in scores]
    u = [0.0] * (row_count + 1)
    v = [0.0] * (column_count + 1)
    p = [0] * (column_count + 1)
    way = [0] * (column_count + 1)
    for row in range(1, row_count + 1):
        p[0] = row
        column0 = 0
        min_values = [float("inf")] * (column_count + 1)
        used = [False] * (column_count + 1)
        while True:
            used[column0] = True
            current_row = p[column0]
            delta = float("inf")
            column1 = 0
            for column in range(1, column_count + 1):
                if used[column]:
                    continue
                current = (
                    costs[current_row - 1][column - 1]
                    - u[current_row]
                    - v[column]
                )
                if current < min_values[column]:
                    min_values[column] = current
                    way[column] = column0
                if min_values[column] < delta:
                    delta = min_values[column]
                    column1 = column
            for column in range(column_count + 1):
                if used[column]:
                    u[p[column]] += delta
                    v[column] -= delta
                else:
                    min_values[column] -= delta
            column0 = column1
            if p[column0] == 0:
                break
        while True:
            column1 = way[column0]
            p[column0] = p[column1]
            column0 = column1
            if column0 == 0:
                break
    assignment = [-1] * row_count
    for column in range(1, column_count + 1):
        if p[column]:
            assignment[p[column] - 1] = column - 1
    return assignment


def paired_blocks(source: str) -> list[tuple[LayoutBlock, ManualBlock]]:
    layout_blocks = extract_layout_blocks(source)
    reference_blocks = extract_blocks(source)
    if len(layout_blocks) != len(reference_blocks):
        raise ValueError(
            f"{source}: layout={len(layout_blocks)} reference={len(reference_blocks)}"
        )
    pairs: list[tuple[LayoutBlock, ManualBlock]] = []
    for page in PAGE_RANGES[source]:
        page_layouts = [block for block in layout_blocks if block.page == page]
        page_references = [block for block in reference_blocks if block.page == page]
        if len(page_layouts) != len(page_references):
            raise ValueError(
                f"{source} p.{page}: layout={len(page_layouts)} "
                f"reference={len(page_references)}"
            )
        scores: list[list[float]] = []
        for layout in page_layouts:
            target = comparable_text(layout.text)
            row: list[float] = []
            for reference in page_references:
                candidate = comparable_text(reference.raw_text)
                score = 0.0
                if target in candidate or candidate in target:
                    score += 100.0
                score += 20.0 * content_overlap(layout.text, reference.raw_text)
                score += 10.0 * title_similarity(layout.title, reference.title)
                row.append(score)
            scores.append(row)
        assignment = hungarian_max(scores)
        pairs.extend(
            (layout, page_references[assignment[index]])
            for index, layout in enumerate(page_layouts)
        )
    return pairs


def assignment_score(
    item_id: str,
    detail: dict[str, object],
    layout: LayoutBlock,
    reference: ManualBlock,
) -> float:
    target = comparable_text(str(detail["text"]))
    candidate = comparable_text(layout.text)
    score = 0.0
    if target == candidate:
        score += 140.0
    elif target in candidate or candidate in target:
        score += 115.0
    else:
        score += 30.0 * content_overlap(str(detail["text"]), layout.text)
    score += 55.0 * max(
        title_similarity(str(detail["title"]), layout.title),
        title_similarity(str(detail["title"]), layout.title),
    )
    score += 45.0 * max(
        title_similarity(str(detail["manualTitle"]), layout.title),
        title_similarity(str(detail["manualTitle"]), layout.title),
    )
    expected_pages = expected_page_range(item_id)
    if expected_pages is not None:
        score += 220.0 if layout.page in expected_pages else -220.0
    return score


def expected_page_range(item_id: str) -> range | None:
    item_overrides = {
        "05-risk-trauma-adjustment": range(30, 31),
        "517-emo-substances": range(47, 48),
        "517-emo-anger": range(47, 48),
        "517-emo-eating": range(48, 49),
        "517-emo-somatization": range(48, 49),
        "517-care-safety": range(38, 39),
        "517-danger-others": range(49, 50),
        "517-danger-sexual-aggression": range(54, 55),
        "517-danger-runaway": range(54, 55),
        "517-danger-delinquency": range(55, 56),
        "517-danger-fire": range(57, 58),
        "517-danger-social": range(58, 59),
        "517-danger-sexual-reactive": range(58, 59),
        "517-danger-bullying": range(58, 59),
    }
    if item_id in item_overrides:
        return item_overrides[item_id]
    prefixes = {
        "05-life-": range(13, 17),
        "05-risk-": range(16, 19),
        "05-str-": range(19, 22),
        "05-care-": range(22, 28),
        "05-emo-": range(28, 32),
        "05-danger-": range(32, 34),
        "05-dev-": range(34, 35),
        "05-motor-": range(35, 36),
        "05-com-": range(36, 38),
        "05-reg-": range(38, 40),
        "05-med-": range(40, 42),
        "05-school-": range(42, 44),
        "05-cult-": range(44, 47),
        "05-trauma-": range(47, 50),
        "05-ace-": range(49, 52),
        "05-abuse-": range(52, 53),
        "05-place-": range(53, 55),
        "05-current-": range(55, 57),
        "517-life-": range(16, 26),
        "517-school-": range(28, 30),
        "517-str-": range(29, 33),
        "517-care-": range(33, 38),
        "517-emo-": range(38, 41),
        "517-tr-": range(59, 65),
        "517-dev-": range(18, 19),
        "517-com-": range(19, 20),
        "517-cult-": range(20, 23),
        "517-med-": range(23, 26),
        "517-ind-": range(26, 28),
        "517-trauma-": range(41, 44),
        "517-ace-": range(43, 46),
        "517-abuse-": range(46, 47),
        "517-sub-": range(47, 49),
        "517-vio-": range(50, 54),
        "517-run-": range(54, 56),
        "517-justice-": range(55, 59),
        "517-parent-": range(59, 62),
        "517-work-": range(61, 63),
        "517-place-": range(65, 67),
        "517-current-": range(67, 69),
    }
    return next(
        (pages for prefix, pages in prefixes.items() if item_id.startswith(prefix)),
        None,
    )


def assign_items(
    source: str, details: dict[str, dict[str, object]]
) -> tuple[
    list[tuple[str, dict[str, object]]],
    list[tuple[LayoutBlock, ManualBlock]],
    list[int],
    list[list[float]],
]:
    items = [
        (item_id, detail)
        for item_id, detail in details.items()
        if detail["source"] == source
    ]
    blocks = paired_blocks(source)
    scores = [
        [
            assignment_score(item_id, detail, layout, reference)
            for layout, reference in blocks
        ]
        for item_id, detail in items
    ]
    if len(items) == len(blocks) + 1:
        for row in scores:
            row.append(max(row) - 35.0)
    assignment = hungarian_max(scores)
    if len(items) == len(blocks) + 1:
        dummy_index = len(blocks)
        for row_index, column_index in enumerate(assignment):
            if column_index == dummy_index:
                assignment[row_index] = max(
                    range(len(blocks)), key=lambda index: scores[row_index][index]
                )
                break
    return items, blocks, assignment, scores


def remove_score_markers(text: str) -> str:
    cleaned_lines: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        marker = re.match(r"^(?:[0-3]|NO|SI)(?:\s+(.*))?$", line)
        if marker:
            line = marker.group(1) or ""
        cleaned_lines.append(line)
    return join_manual_lines(cleaned_lines)


def find_sequence(
    haystack: list[tuple[str, int, int]],
    needle: list[tuple[str, int, int]],
    start: int,
) -> tuple[int, int] | None:
    needle_tokens = [token for token, _, _ in needle]
    if not needle_tokens:
        return None
    anchor_length = min(8, len(needle_tokens))
    anchor = needle_tokens[:anchor_length]
    for index in range(start, len(haystack) - anchor_length + 1):
        if [token for token, _, _ in haystack[index : index + anchor_length]] != anchor:
            continue
        end = index + len(needle_tokens)
        if end <= len(haystack) and [
            token for token, _, _ in haystack[index:end]
        ] == needle_tokens:
            return index, end
    return None


def trim_after_last_token(text: str, end: int) -> str:
    while end < len(text) and text[end] in " \t\r\n.,;:!?)]}”’'":
        end += 1
    return text[:end].strip()


def split_with_reference(
    raw_text: str, reference_hints: dict[str, str]
) -> tuple[str, dict[str, str]]:
    clean_text = remove_score_markers(raw_text)
    clean_normalized, clean_positions = normalized_char_map(clean_text)
    locations: dict[str, tuple[int, int]] = {}
    search_start = 0
    for score in sorted(reference_hints, key=int):
        reference_normalized, _ = normalized_char_map(reference_hints[score])
        normalized_start = clean_normalized.find(reference_normalized, search_start)
        if normalized_start < 0:
            raise ValueError(f"Unable to align score {score}")
        normalized_end = normalized_start + len(reference_normalized)
        locations[score] = (normalized_start, normalized_end)
        search_start = normalized_start + 1
    ordered_scores = sorted(locations, key=int)
    first_start = clean_positions[locations[ordered_scores[0]][0]]
    description = clean_text[:first_start].strip()
    hints: dict[str, str] = {}
    for index, score in enumerate(ordered_scores):
        normalized_start, normalized_end = locations[score]
        start_char = clean_positions[normalized_start]
        if index + 1 < len(ordered_scores):
            next_normalized_start = locations[ordered_scores[index + 1]][0]
            end_char = clean_positions[next_normalized_start]
            hints[score] = clean_text[start_char:end_char].strip()
        else:
            end_char = clean_positions[normalized_end - 1] + 1
            hints[score] = trim_after_last_token(
                clean_text[start_char:], end_char - start_char
            )
    return description, hints


def split_binary_reference(
    raw_text: str, reference: ManualBlock
) -> tuple[str, dict[str, str]]:
    flat = re.sub(r"\s+", " ", reference.raw_text).strip()
    no_match = re.search(r"\bNO\b\s+", flat)
    si_match = re.search(r"\bSI\b\s+", flat)
    if not no_match or not si_match or si_match.start() <= no_match.start():
        raise ValueError("Binary NO/SI markers not found")
    score0 = flat[no_match.end() : si_match.start()].strip()
    score1 = flat[si_match.end() :].strip()
    score1 = re.split(
        r"\s+Se la risposta\b", score1, maxsplit=1, flags=re.IGNORECASE
    )[0].strip()
    return split_with_reference(raw_text, {"0": score0, "1": score1})


def split_acculturation(raw_text: str) -> tuple[str, dict[str, str]]:
    clean_text = remove_score_markers(raw_text)
    starts = [
        "L'utente e la famiglia sono integrati nella cultura",
        "L'utente e la famiglia mostrano alcune differenze culturali",
        "L'utente e/o membri significativi della famiglia mostrano differenze culturali rilevanti",
        "L'utente e/o membri significativi della famiglia mostrano differenze culturali molto rilevanti",
    ]
    positions = [clean_text.find(start) for start in starts]
    if any(position < 0 for position in positions):
        raise ValueError("Unable to align acculturation criteria")
    description = clean_text[: positions[0]].strip()
    hints = {
        str(score): clean_text[
            positions[score] : (
                positions[score + 1] if score < 3 else clean_text.find(" MODULO", positions[score])
            )
        ].strip()
        for score in range(4)
    }
    if not hints["3"]:
        hints["3"] = clean_text[positions[3] :].strip()
    return description, hints


REFERENCE_ITEMS = {
    "517-tr-independent": (
        "Riportare il punteggio {score} attribuito al medesimo item nel modulo Vita indipendente."
    ),
    "517-tr-medication": (
        "Riportare il punteggio {score} attribuito all’item Aderenza alla cura farmacologica nel modulo Cure mediche."
    ),
}


def cleaned_manual_title(title: str, fallback: str) -> str:
    cleaned = re.sub(r"\s+", " ", title).strip()
    if (
        not cleaned
        or cleaned.startswith(
            (
                "Questo item",
                "ai punti",
                "delle arti",
                "derazione",
                "volgimento",
            )
        )
    ):
        return fallback
    return cleaned


def build_structured_details() -> tuple[dict[str, dict[str, object]], list[str]]:
    details = load_details()
    output: dict[str, dict[str, object]] = {}
    audit_lines: list[str] = []
    for source in MANUALS:
        items, blocks, assignment, scores = assign_items(source, details)
        used: Counter[int] = Counter(assignment)
        for row_index, ((item_id, detail), block_index) in enumerate(
            zip(items, assignment)
        ):
            layout, reference = blocks[block_index]
            raw_text = layout.text
            if item_id == "517-life-acculturation":
                description, score_hints = split_acculturation(raw_text)
            elif item_id in REFERENCE_ITEMS:
                description = remove_score_markers(raw_text)
                score_hints = {
                    str(score): REFERENCE_ITEMS[item_id].format(score=score)
                    for score in range(4)
                }
            elif "NO" in raw_text and "SI" in raw_text:
                description, score_hints = split_binary_reference(
                    raw_text, reference
                )
            else:
                if tuple(reference.score_hints) != ("0", "1", "2", "3"):
                    raise ValueError(
                        f"{item_id}: invalid reference markers "
                        f"{tuple(reference.score_hints)} at p.{reference.page}"
                    )
                try:
                    description, score_hints = split_with_reference(
                        raw_text, reference.score_hints
                    )
                except ValueError as error:
                    raise ValueError(
                        f"{item_id} -> p.{reference.page} {reference.title}: {error}"
                    ) from error
            score_hints = {
                score: trim_trailing_manual_sections(text)
                for score, text in score_hints.items()
            }
            description = trim_trailing_manual_sections(description)
            if not description or any(not text for text in score_hints.values()):
                raise ValueError(f"{item_id}: incomplete structured guidance")
            output[item_id] = {
                "title": detail["title"],
                "manualTitle": cleaned_manual_title(
                    layout.title, str(detail["manualTitle"])
                ),
                "source": source,
                "page": reference.page,
                "description": description,
                "scoreHints": score_hints,
                "match": 1.0,
            }
            audit_lines.append(
                f"{item_id}\tp.{reference.page}\t{layout.title}\t"
                f"{scores[row_index][block_index]:.3f}\tusage={used[block_index]}"
            )
    return output, audit_lines


def trim_trailing_manual_sections(text: str) -> str:
    cleaned = re.split(
        r"\s+(?:FINE DEL (?:MODULO|DOMINIO)\b|MODULO \(|PUNTI DI FORZA DELL|"
        r"BISOGNI E RISORSE COSTANTI|BISOGNI EMOTIVO-COMPORTAMENTALI|"
        r"ET[ÀA’'] DI TRANSIZIONE|FATTORI DI RISCHIO(?: STORICI)?|"
        r"SCUOLA(?:\s|$))",
        text,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0].strip()
    return re.sub(r"(?<!\.)\.\.(?!\.)", ".", cleaned)


def generate_structured_details() -> None:
    output, audit_lines = build_structured_details()
    if len(output) != len(item_ids()):
        raise ValueError(f"Generated {len(output)} of {len(item_ids())} items")
    DETAILS_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    report_path = ROOT / "tmp" / "pdfs" / "item-guidance-audit.tsv"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        "item\tpage\tmanual_title\tassignment_score\tusage\n"
        + "\n".join(audit_lines)
        + "\n",
        encoding="utf-8",
    )
    print(f"Generated {len(output)} structured item records")
    print(f"Audit report: {report_path}")


def validate_structured_details() -> None:
    details = json.loads(DETAILS_PATH.read_text(encoding="utf-8"))
    expected_ids = item_ids()
    expected_count = len(expected_ids)
    if len(details) != expected_count:
        raise ValueError(f"Expected {expected_count} items, found {len(details)}")
    if set(details) != set(expected_ids):
        missing = sorted(set(expected_ids) - set(details))
        extra = sorted(set(details) - set(expected_ids))
        raise ValueError(f"Item mismatch; missing={missing}, extra={extra}")
    allowed_keysets = {("0", "1"), ("0", "1", "2", "3")}
    trailing_headings = re.compile(
        r"(?:FINE DEL (?:MODULO|DOMINIO)\b|MODULO \(|PUNTI DI FORZA DELL|"
        r"BISOGNI E RISORSE COSTANTI|"
        r"BISOGNI EMOTIVO-COMPORTAMENTALI|ET[ÀA’'] DI TRANSIZIONE|"
        r"FATTORI DI RISCHIO STORICI)",
        flags=re.IGNORECASE,
    )
    for item_id, detail in details.items():
        expected_source = "cans-0-5" if item_id.startswith("05-") else "cans-5-17"
        if detail.get("source") != expected_source:
            raise ValueError(f"{item_id}: incorrect manual source")
        if detail.get("page") not in PAGE_RANGES[expected_source]:
            raise ValueError(f"{item_id}: page outside manual range")
        if not detail.get("manualTitle"):
            raise ValueError(f"{item_id}: missing manual title")
        if not detail.get("description"):
            raise ValueError(f"{item_id}: missing description")
        hints = detail.get("scoreHints", {})
        if tuple(hints) not in allowed_keysets:
            raise ValueError(f"{item_id}: invalid score keys {tuple(hints)}")
        if any(not text for text in hints.values()):
            raise ValueError(f"{item_id}: empty score hint")
        if trailing_headings.search(
            " ".join([detail["description"], *hints.values()])
        ):
            raise ValueError(f"{item_id}: trailing manual heading found")
        if any(
            re.search(r"(?<!\.)\.\.(?!\.)", text)
            for text in [detail["description"], *hints.values()]
        ):
            raise ValueError(f"{item_id}: duplicated full stop")
    print(f"Validated {len(details)} structured item records")


def join_manual_lines(lines: list[str]) -> str:
    result = ""
    for raw_line in lines:
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        if result.endswith("-") and line[:1].islower():
            result = result[:-1] + line
        else:
            result = f"{result} {line}".strip()
    return re.sub(r"\s+([,.;:?!])", r"\1", result).strip()


def find_score_marker(text: str, score: int, start: int) -> re.Match[str] | None:
    candidates = list(
        re.finditer(rf"(?<!\d){score}(?!\d)(?=\s+\D)", text[start:])
    )
    if not candidates:
        return None
    absolute = [
        (candidate, start + candidate.start(), start + candidate.end())
        for candidate in candidates
    ]
    if score == 0:
        candidate, _, _ = absolute[0]
        return candidate
    for candidate, marker_start, _ in absolute:
        previous = text[:marker_start].rstrip()
        if not previous or previous[-1] in ".?!:;)":
            return candidate
    return absolute[0][0]


def parse_flat_block(
    source: str, page: int, title: str, body: str
) -> ManualBlock:
    flat = re.sub(r"\s+", " ", body).strip()
    flat = re.split(
        r"\s+(?:Fine modulo|STANDARD CANS|CHILD AND ADOLESCENT NEEDS)",
        flat,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0].strip()
    markers: list[tuple[int, int, str]] = []
    lower_flat = flat.casefold()
    cues = [
        position
        for cue in (
            "valutare",
            "punteggiare utilizzando",
            "punteggiare considerando",
            "considerare",
        )
        if (position := lower_flat.find(cue)) >= 0
    ]
    search_start = min(cues) if cues else 0
    for score in range(4):
        marker = find_score_marker(flat, score, search_start)
        if marker is None:
            break
        marker_start = search_start + marker.start()
        marker_end = search_start + marker.end()
        markers.append((marker_start, marker_end, str(score)))
        search_start = marker_end
    score_hints: dict[str, str] = {}
    if markers:
        description = flat[: markers[0][0]].strip()
        for marker_index, (_, marker_end, score) in enumerate(markers):
            next_start = (
                markers[marker_index + 1][0]
                if marker_index + 1 < len(markers)
                else len(flat)
            )
            score_hints[score] = flat[marker_end:next_start].strip()
        last_score = markers[-1][2]
        score_hints[last_score] = re.split(
            r"\s+(?:MODULO \(|PUNTI DI FORZA DELL|"
            r"BISOGNI E RISORSE COSTANTI|BISOGNI EMOTIVO-COMPORTAMENTALI|"
            r"ET[ÀA’'] DI TRANSIZIONE|FATTORI DI RISCHIO STORICI|"
            r"SCUOLA(?:\s|$))",
            score_hints[last_score],
            maxsplit=1,
        )[0].strip()
    else:
        description = flat
    return ManualBlock(
        source=source,
        page=page,
        title=re.sub(r"\s+", " ", title).strip(),
        description=description,
        score_hints=score_hints,
        raw_lines=body.splitlines(),
        raw_text=body,
    )


def extract_blocks(source: str) -> list[ManualBlock]:
    blocks: list[ManualBlock] = []
    reader = PdfReader(MANUALS[source])
    for page_number in PAGE_RANGES[source]:
        page = reader.pages[page_number - 1]
        page_text = page.extract_text() or ""
        layout_text = page.extract_text(extraction_mode="layout") or ""
        segments = [
            segment
            for segment in re.split(r"(?=Punt\.?(?:\s|$))", page_text)
            if re.match(r"^Punt\.?(?:\s|$)", segment)
        ]
        titles = [
            re.sub(r"\s+", " ", re.sub(r"^.*?Punt\.?\s*", "", line)).strip()
            for line in layout_text.splitlines()
            if re.search(r"\bPunt\.?(?:\s|$)", line)
        ]
        for index, segment in enumerate(segments):
            content = re.sub(r"^Punt\.?\s*", "", segment, count=1)
            title = titles[index] if index < len(titles) else content[:120]
            blocks.append(
                parse_flat_block(source, page_number, title, content)
            )
    return blocks


def extract_layout_blocks(source: str) -> list[LayoutBlock]:
    blocks: list[LayoutBlock] = []
    with pdfplumber.open(MANUALS[source]) as pdf:
        for page_number in PAGE_RANGES[source]:
            lines = [
                line.strip()
                for line in (
                    pdf.pages[page_number - 1].extract_text(
                        x_tolerance=2, y_tolerance=3
                    )
                    or ""
                ).splitlines()
            ]
            headings: list[tuple[int, int, str, str]] = []
            for line_index, line in enumerate(lines):
                if not re.match(r"^Punt\.?(?:\s|$)", line):
                    continue
                inline_title = re.sub(r"^Punt\.?\s*", "", line).strip()
                inline_is_body = inline_title.startswith(
                    ("Questo item", "Questa item", "Si riferisce", "Se ")
                ) or bool(inline_title[:1].islower())
                if inline_title and not inline_is_body:
                    headings.append((line_index, line_index, inline_title, ""))
                    continue
                title_index = next(
                    (
                        candidate
                        for candidate in range(line_index - 1, max(-1, line_index - 7), -1)
                        if is_visual_item_heading(lines[candidate])
                    ),
                    line_index,
                )
                title = lines[title_index] if title_index != line_index else ""
                headings.append(
                    (
                        title_index,
                        line_index,
                        title,
                        inline_title if inline_is_body else "",
                    )
                )
            headings.sort(key=lambda heading: heading[0])
            for heading_position, (
                start_index,
                marker_index,
                title,
                marker_body,
            ) in enumerate(headings):
                next_index = (
                    headings[heading_position + 1][0]
                    if heading_position + 1 < len(headings)
                    else len(lines)
                )
                content: list[str] = []
                for index, line in enumerate(
                    lines[start_index + 1 : next_index],
                    start=start_index + 1,
                ):
                    if index == marker_index:
                        if marker_body:
                            content.append(marker_body)
                        continue
                    if (
                        re.fullmatch(r"\d+", line)
                        or "VERSIONE ITALIANA" in line
                        or line.startswith("A cura di ")
                        or line.startswith("Gruppo di Lavoro ")
                    ):
                        continue
                    content.append(line)
                while content and is_visual_item_heading(content[0]):
                    title = f"{title} {content.pop(0)}".strip()
                blocks.append(
                    LayoutBlock(
                        source=source,
                        page=page_number,
                        title=title,
                        text="\n".join(content).strip(),
                    )
                )
    return blocks


def is_visual_item_heading(line: str) -> bool:
    if not line or line.startswith(("MODULO ", "Fine modulo")):
        return False
    heading_part = line.split("(", 1)[0]
    letters = [character for character in heading_part if character.isalpha()]
    if len(letters) < 5:
        return False
    uppercase = sum(character.isupper() for character in letters)
    return uppercase / len(letters) >= 0.82


def comparable_text(text: str) -> str:
    lines = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        marker = re.match(r"^[0-3](?:\s+(.*))?$", line)
        if marker:
            line = marker.group(1) or ""
        lines.append(line)
    joined = join_manual_lines(lines).casefold()
    joined = (
        joined.replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
    )
    joined = re.sub(r"(?<!\d)[0-3](?!\d)", " ", joined)
    return re.sub(r"[^\w]+", "", joined, flags=re.UNICODE)


def block_text(block: ManualBlock) -> str:
    return " ".join(
        [block.description, *[block.score_hints[key] for key in sorted(block.score_hints)]]
    )


def match_details_to_blocks(
    source: str, details: dict[str, dict[str, object]]
) -> list[tuple[str, ManualBlock, float]]:
    blocks = extract_blocks(source)
    comparable_blocks = [(block, comparable_text(block.raw_text)) for block in blocks]
    exact_blocks: dict[str, list[ManualBlock]] = {}
    for block, text in comparable_blocks:
        exact_blocks.setdefault(text, []).append(block)
    matches: list[tuple[str, ManualBlock, float]] = []
    for item_id, detail in details.items():
        if detail["source"] != source:
            continue
        target = comparable_text(str(detail["text"]))
        contained = [
            block for block, candidate_text in comparable_blocks if target in candidate_text
        ]
        if contained:
            if len(contained) == 1:
                block = contained[0]
            else:
                manual_title = comparable_text(str(detail["manualTitle"]))
                block = max(
                    contained,
                    key=lambda candidate: difflib.SequenceMatcher(
                        None, manual_title, comparable_text(candidate.title)
                    ).ratio(),
                )
            matches.append((item_id, block, 1.0))
            continue
        if target in exact_blocks:
            matches.append((item_id, exact_blocks[target][0], 1.0))
            continue
        quick_candidates = sorted(
            (
                (
                    difflib.SequenceMatcher(
                        None, target, candidate_text, autojunk=False
                    ).quick_ratio(),
                    block,
                    candidate_text,
                )
                for block, candidate_text in comparable_blocks
            ),
            key=lambda candidate: candidate[0],
            reverse=True,
        )[:8]
        candidates = [
            (
                difflib.SequenceMatcher(
                    None, target, candidate_text, autojunk=False
                ).ratio(),
                block,
            )
            for _, block, candidate_text in quick_candidates
        ]
        score, block = max(candidates, key=lambda candidate: candidate[0])
        matches.append((item_id, block, score))
    return matches


def inventory() -> None:
    details = load_details()
    ids = item_ids()
    id_set = set(ids)
    detail_set = set(details)
    print(f"Item nelle griglie: {len(ids)} ({len(id_set)} univoci)")
    print(f"Item con testo manuale: {len(details)}")
    print(f"Mancanti: {len(id_set - detail_set)}")
    for item_id in sorted(id_set - detail_set):
        print(f"  - {item_id}")
    print(f"Orfani: {len(detail_set - id_set)}")
    for item_id in sorted(detail_set - id_set):
        print(f"  - {item_id}")
    print("Per manuale:")
    for source, count in sorted(
        Counter(str(entry["source"]) for entry in details.values()).items()
    ):
        print(f"  - {source}: {count}")
    print("Qualita match:")
    matches = Counter(float(entry["match"]) for entry in details.values())
    for match, count in sorted(matches.items()):
        print(f"  - {match:.3f}: {count}")


def extraction_report() -> None:
    details = load_details()
    for source in MANUALS:
        blocks = extract_blocks(source)
        print(f"\n{source}: {len(blocks)} blocchi")
        marker_counts = Counter(tuple(block.score_hints) for block in blocks)
        for markers, count in sorted(marker_counts.items(), key=lambda entry: entry[0]):
            print(f"  marker {markers or '(nessuno)'}: {count}")
        invalid = [
            block
            for block in blocks
            if tuple(block.score_hints) not in {("0", "1"), ("0", "1", "2", "3")}
        ]
        print(f"  blocchi con marker anomali: {len(invalid)}")
        for block in invalid[:30]:
            print(
                f"    p.{block.page} {block.title}: {tuple(block.score_hints)}"
            )
        matches = match_details_to_blocks(source, details)
        weak = sorted(
            (match for match in matches if match[2] < 0.98),
            key=lambda match: match[2],
        )
        print(f"  associazioni sotto 0.98: {len(weak)}")
        for item_id, block, score in weak[:50]:
            print(
                f"    {score:.3f} {item_id} -> p.{block.page} {block.title}"
            )
        usage = Counter((block.page, block.title) for _, block, _ in matches)
        duplicates = [key for key, count in usage.items() if count > 1]
        print(f"  blocchi usati da piu item: {len(duplicates)}")
        for key in duplicates[:30]:
            print(f"    {usage[key]}x p.{key[0]} {key[1]}")


def page_report() -> None:
    for source in MANUALS:
        reader = PdfReader(MANUALS[source])
        print(f"\n{source}")
        total_segments = 0
        total_titles = 0
        for page_number in PAGE_RANGES[source]:
            page = reader.pages[page_number - 1]
            page_text = page.extract_text() or ""
            layout_text = page.extract_text(extraction_mode="layout") or ""
            segments = [
                segment
                for segment in re.split(r"(?=Punt\.?(?:\s|$))", page_text)
                if re.match(r"^Punt\.?(?:\s|$)", segment)
            ]
            titles = [
                re.sub(
                    r"\s+", " ", re.sub(r"^.*?Punt\.?\s*", "", line)
                ).strip()
                for line in layout_text.splitlines()
                if re.search(r"\bPunt\.?(?:\s|$)", line)
            ]
            total_segments += len(segments)
            total_titles += len(titles)
            marker = " !" if len(segments) != len(titles) else ""
            print(
                f"  p.{page_number}: segmenti={len(segments)} titoli={len(titles)}{marker}"
            )
            if marker:
                for title in titles:
                    print(f"    - {title}")
        print(f"  Totale: segmenti={total_segments}, titoli={total_titles}")


def order_report() -> None:
    for source in MANUALS:
        items = grid_items(source)
        blocks = extract_blocks(source)
        print(f"\n{source}: item={len(items)}, blocchi={len(blocks)}")
        for index, ((item_id, label), block) in enumerate(zip(items, blocks), start=1):
            similarity = title_similarity(label, block.title)
            if similarity < 0.72:
                print(
                    f"  {index:03d} {similarity:.3f} {item_id} | {label} -> "
                    f"p.{block.page} {block.title}"
                )


def coverage_report() -> None:
    details = load_details()
    for source in MANUALS:
        blocks = extract_layout_blocks(source)
        by_text: dict[str, list[LayoutBlock]] = {}
        for block in blocks:
            by_text.setdefault(comparable_text(block.text), []).append(block)
        usage: Counter[tuple[int, str]] = Counter()
        unmatched: list[str] = []
        for item_id, detail in details.items():
            if detail["source"] != source:
                continue
            candidates = by_text.get(comparable_text(str(detail["text"])), [])
            if not candidates:
                unmatched.append(item_id)
                continue
            block = max(
                candidates,
                key=lambda candidate: title_similarity(
                    str(detail["manualTitle"]), candidate.title
                ),
            )
            usage[(block.page, block.title)] += 1
        unused = [
            block for block in blocks if usage[(block.page, block.title)] == 0
        ]
        duplicated = [
            (key, count) for key, count in usage.items() if count > 1
        ]
        print(f"\n{source}")
        print(f"  blocchi layout: {len(blocks)}")
        print(f"  item senza corrispondenza esatta: {len(unmatched)}")
        for item_id in unmatched:
            print(f"    - {item_id}")
        print(f"  blocchi non usati: {len(unused)}")
        for block in unused:
            print(f"    - p.{block.page} {block.title}")
        print(f"  blocchi usati piu volte: {len(duplicated)}")
        for (page, title), count in duplicated:
            print(f"    - {count}x p.{page} {title}")


def dump_page(manual: str, page_number: int) -> None:
    path = MANUALS[manual]
    with pdfplumber.open(path) as pdf:
        page = pdf.pages[page_number - 1]
        print(f"{path.name} - pagina PDF {page_number}")
        print("\n--- extract_text ---\n")
        print(page.extract_text(x_tolerance=2, y_tolerance=3) or "")
        print("\n--- righe con coordinate ---\n")
        words = page.extract_words(
            x_tolerance=2,
            y_tolerance=3,
            keep_blank_chars=False,
            use_text_flow=False,
        )
        rows: list[list[dict[str, object]]] = []
        for word in sorted(words, key=lambda value: (float(value["top"]), float(value["x0"]))):
            top = float(word["top"])
            row = next(
                (
                    candidate
                    for candidate in reversed(rows[-4:])
                    if abs(float(candidate[0]["top"]) - top) <= 2.5
                ),
                None,
            )
            if row is None:
                row = []
                rows.append(row)
            row.append(word)
        for row in rows:
            ordered = sorted(row, key=lambda value: float(value["x0"]))
            top = min(float(word["top"]) for word in ordered)
            text = " ".join(str(word["text"]) for word in ordered)
            positions = " ".join(
                f'{float(word["x0"]):.0f}:{word["text"]}' for word in ordered
            )
            print(f"{top:7.1f} | {text}")
            print(f"        | {positions}")


def dump_detail(item_id: str) -> None:
    detail = load_details()[item_id]
    print(json.dumps(detail, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("inventory")
    subparsers.add_parser("extract-report")
    subparsers.add_parser("page-report")
    subparsers.add_parser("order-report")
    subparsers.add_parser("coverage-report")
    subparsers.add_parser("generate")
    subparsers.add_parser("validate")
    page_parser = subparsers.add_parser("page")
    page_parser.add_argument("manual", choices=MANUALS)
    page_parser.add_argument("page", type=int)
    detail_parser = subparsers.add_parser("detail")
    detail_parser.add_argument("item_id")
    args = parser.parse_args()

    if args.command == "inventory":
        inventory()
    elif args.command == "extract-report":
        extraction_report()
    elif args.command == "page-report":
        page_report()
    elif args.command == "order-report":
        order_report()
    elif args.command == "coverage-report":
        coverage_report()
    elif args.command == "generate":
        generate_structured_details()
    elif args.command == "validate":
        validate_structured_details()
    elif args.command == "page":
        dump_page(args.manual, args.page)
    elif args.command == "detail":
        dump_detail(args.item_id)


if __name__ == "__main__":
    main()
