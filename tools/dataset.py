"""Check and refresh the dataset (English edition).

  python3 tools/dataset.py validate data/insanity_procedure_map.json
      Exit code 1 on errors (used by the pull-request check). Warnings do not fail.

  python3 tools/dataset.py refresh data/insanity_procedure_map.json [--geo tools/geo/admin1_subset.geojson]
      Recompute the derived fields after edits: colour_derived_from_facts, the low_confidence flag,
      summary, legend counts (categories.*.n_countries / n_subdivisions), cases_to_check, meta.n_entries.

Standard library only (Python 3.8+).
"""
import argparse
import collections
import json
import re
import sys

COLOURS = ["green", "yellow", "purple", "blue", "black", "white"]
CONFIDENCE = ["high", "medium", "low"]
LEVELS = ["country", "subdivision"]
WHO = ["authorities", "defence", "mixed"]
STAGES = ["pretrial_phase", "special_trial", "ordinary_trial", "not_applicable"]
REPLACEMENT = ["none", "simple_dismissal", "reduced_procedure", "genuine_special_trial"]
FLAGS = ["incomplete_verification", "low_confidence", "confirmed_by_independent_check",
         "contradicted_by_independent_check", "manual_decision", "colour_differs_from_facts",
         "official_language_not_used", "whitened_for_lack_of_source"]
TO_CHECK_FLAGS = {"low_confidence", "incomplete_verification", "official_language_not_used",
                  "whitened_for_lack_of_source", "colour_differs_from_facts"}
FACT_BOOLS = ["recognises_non_responsibility", "accused_chooses_timing", "committal_without_trial",
              "trial_always_or_on_request"]
FACT_TEXTS = ["outcome", "replacement_procedure_detail", "unfitness_to_stand_trial"]
CODE_RE = re.compile(r"^[A-Z]{2}(-[A-Z0-9]{1,4})?$")
MAX_EXCERPT_WORDS = 25
MAX_NOTE_CHARS = 600


def derive(f):
    """Colour implied by the recorded facts (classification order: black, blue, yellow/purple, green)."""
    if f.get("recognises_non_responsibility") is False:
        return "black"
    if f.get("accused_chooses_timing") is True:
        return "blue"
    rp = f.get("replacement_procedure")
    if rp in ("simple_dismissal", "reduced_procedure"):
        return "purple" if f.get("trial_always_or_on_request") else "yellow"
    if rp == "genuine_special_trial":
        return "purple"
    if rp == "none":
        return "blue" if f.get("who_triggers_examination") == "defence" else "green"
    st = f.get("decision_stage")
    if st == "pretrial_phase":
        return "purple" if f.get("trial_always_or_on_request") else "yellow"
    if st == "special_trial":
        return "purple"
    if st == "ordinary_trial":
        return "blue" if f.get("who_triggers_examination") == "defence" else "green"
    return None


def validate(d):
    errors, warnings = [], []
    err = errors.append
    warn = warnings.append
    for k in ("title", "categories", "scope", "meta", "entities"):
        if k not in d:
            err(f"missing top-level key: {k}")
    if errors:
        return errors, warnings
    if sorted(d["categories"]) != sorted(COLOURS):
        err(f"categories must be exactly {COLOURS}")
    excluded = {x.get("code") for x in d["scope"].get("excluded", [])}
    seen = set()
    codes = {e.get("code") for e in d["entities"]}
    for i, e in enumerate(d["entities"]):
        c = e.get("code")
        where = f"entities[{i}] ({c})"
        if not isinstance(c, str) or not CODE_RE.match(c):
            err(f"{where}: invalid code (expected ISO 3166 alpha-2, or alpha-2 + '-' + up to 4 characters)")
        if c in seen:
            err(f"{where}: duplicate code")
        seen.add(c)
        if c in excluded:
            err(f"{where}: code is also listed in scope.excluded")
        for k in ("name", "legal_bases", "note"):
            if not isinstance(e.get(k), str) or not e.get(k).strip():
                err(f"{where}: '{k}' must be a non-empty string")
        if e.get("level") not in LEVELS:
            err(f"{where}: level must be one of {LEVELS}")
        if e.get("level") == "subdivision":
            p = e.get("parent")
            if not isinstance(p, str) or not CODE_RE.match(p):
                err(f"{where}: a subdivision needs a parent country code")
            elif p not in codes:
                warn(f"{where}: parent {p} has no entry of its own")
        elif e.get("parent") not in (None, ""):
            err(f"{where}: a country must have parent null")
        if e.get("colour") not in COLOURS:
            err(f"{where}: colour must be one of {COLOURS}")
        if e.get("confidence") not in CONFIDENCE:
            err(f"{where}: confidence must be one of {CONFIDENCE}")
        for k in ("official_languages", "research_languages"):
            v = e.get(k)
            if not isinstance(v, list) or not all(isinstance(x, str) for x in v):
                err(f"{where}: '{k}' must be a list of language codes")
        f = e.get("facts")
        if not isinstance(f, dict):
            err(f"{where}: missing facts")
            f = {}
        for k in FACT_BOOLS:
            if not isinstance(f.get(k), bool):
                err(f"{where}: facts.{k} must be true or false")
        for k in FACT_TEXTS:
            if not isinstance(f.get(k), str):
                err(f"{where}: facts.{k} must be a string")
        if f.get("who_triggers_examination") not in WHO:
            err(f"{where}: facts.who_triggers_examination must be one of {WHO}")
        if f.get("decision_stage") not in STAGES:
            err(f"{where}: facts.decision_stage must be one of {STAGES}")
        if f.get("replacement_procedure") not in REPLACEMENT:
            err(f"{where}: facts.replacement_procedure must be one of {REPLACEMENT}")
        ex = e.get("excerpt")
        if not isinstance(ex, str):
            err(f"{where}: excerpt must be a string (may be empty for white entries)")
        else:
            if len(ex.split()) > MAX_EXCERPT_WORDS:
                warn(f"{where}: excerpt longer than {MAX_EXCERPT_WORDS} words")
            if not ex.strip() and e.get("colour") != "white":
                warn(f"{where}: coloured entry without a verbatim excerpt")
        if isinstance(e.get("note"), str) and len(e["note"]) > MAX_NOTE_CHARS:
            warn(f"{where}: note longer than {MAX_NOTE_CHARS} characters")
        srcs = e.get("sources")
        if not isinstance(srcs, list):
            err(f"{where}: sources must be a list")
            srcs = []
        for j, s in enumerate(srcs):
            if not isinstance(s, dict) or not isinstance(s.get("title"), str) or not s.get("title").strip():
                err(f"{where}: sources[{j}] needs a title")
            elif not isinstance(s.get("url"), str) or not re.match(r"^https?://", s.get("url") or ""):
                err(f"{where}: sources[{j}] needs an http(s) url")
        if e.get("colour") != "white" and not srcs:
            err(f"{where}: a coloured entry needs at least one source")
        hyp = e.get("hypothetical_colour")
        if hyp is not None:
            if hyp not in COLOURS:
                err(f"{where}: hypothetical_colour must be one of {COLOURS}")
            if e.get("colour") != "white":
                err(f"{where}: hypothetical_colour is only for white entries")
        for fl in e.get("flags") or []:
            if fl not in FLAGS:
                warn(f"{where}: unknown flag {fl}")
        dv = derive(f)
        if e.get("colour") not in ("white", None) and dv and dv != e.get("colour") and not e.get("merge_decision"):
            warn(f"{where}: colour {e.get('colour')} differs from the colour implied by the facts ({dv}); "
                 "explain it in the note or align the facts")
    return errors, warnings


def refresh(d, geo_path):
    geo = json.load(open(geo_path, encoding="utf-8"))
    units = collections.defaultdict(set)
    for ft in geo["features"]:
        units[ft["properties"]["parent"]].add(ft["properties"]["code"])
    ents = d["entities"]
    by = {e["code"]: e for e in ents}
    for e in ents:
        e["colour_derived_from_facts"] = derive(e.get("facts") or {})
        fl = list(e.get("flags") or [])
        if e.get("confidence") == "low" and "low_confidence" not in fl:
            fl.insert(0, "low_confidence")
        elif e.get("confidence") != "low":
            fl = [x for x in fl if x != "low_confidence"]
        e["flags"] = fl
    drawn = lambda e: e["level"] == "subdivision" and e.get("parent") in units and e["code"] in units[e["parent"]]
    varies, unit_counts = set(), collections.Counter()
    for par in {e["parent"] for e in ents if drawn(e)}:
        cols = [(by.get(c) or by.get(par) or {}).get("colour", "white") for c in sorted(units[par])]
        if len(set(cols)) > 1:
            varies.add(par)
            unit_counts.update(cols)
    n_c = {k: sum(1 for e in ents if e["level"] == "country" and e["code"] not in varies and e["colour"] == k)
           for k in COLOURS}
    # a country drawn by units, ruled uniformly but without a national entry (Bosnia), counts once
    for par in {e["parent"] for e in ents if drawn(e)} - varies:
        if par not in by:
            cols = {(by.get(c) or {}).get("colour", "white") for c in units[par]}
            if len(cols) == 1:
                n_c[cols.pop()] += 1
    n_s = {k: unit_counts.get(k, 0) + sum(1 for e in ents if e["level"] == "subdivision" and not drawn(e)
                                          and e["colour"] == k) for k in COLOURS}
    d["summary"] = {
        "countries": n_c, "subdivisions": n_s,
        "federal_countries_with_differing_rules": sorted(varies),
        "codes_by_colour": {k: sorted(e["code"] for e in ents if e["colour"] == k) for k in COLOURS},
        "confidence": dict(collections.Counter(e["confidence"] for e in ents)),
    }
    for k in COLOURS:
        d["categories"][k]["n_countries"] = n_c[k]
        d["categories"][k]["n_subdivisions"] = n_s[k]
    d["cases_to_check"] = [{"code": e["code"], "name": e["name"], "colour": e["colour"],
                            "confidence": e["confidence"], "flags": e["flags"]}
                           for e in ents if set(e["flags"]) & TO_CHECK_FLAGS or e["colour"] == "white"]
    d["meta"]["n_entries"] = len(ents)
    return d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["validate", "refresh"])
    ap.add_argument("path")
    ap.add_argument("--geo", default="tools/geo/admin1_subset.geojson")
    a = ap.parse_args()
    try:
        d = json.load(open(a.path, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        sys.exit(f"ERROR: cannot read {a.path}: {exc}")
    if a.command == "validate":
        errors, warnings = validate(d)
        for w in warnings:
            print("WARNING:", w)
        for e in errors:
            print("ERROR:", e)
        print(f"{len(d.get('entities', []))} entities, {len(errors)} error(s), {len(warnings)} warning(s)")
        sys.exit(1 if errors else 0)
    errors, _ = validate(d)
    if errors:
        for e in errors:
            print("ERROR:", e)
        sys.exit("refresh aborted: fix the errors first")
    refresh(d, a.geo)
    with open(a.path, "w", encoding="utf-8") as fh:
        json.dump(d, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print("refreshed", a.path, d["summary"]["countries"], d["summary"]["subdivisions"])


if __name__ == "__main__":
    main()
