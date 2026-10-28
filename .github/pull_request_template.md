## Jurisdiction(s)

<!-- e.g. "BJ – Benin" or "US-NM – New Mexico" -->

## What changes

<!-- colour / facts / sources / scope; previous value → new value -->

## What you read

<!-- statute and articles, decision, version or date; links -->

## Checklist

- [ ] Only `data/insanity_procedure_map.json` is modified.
- [ ] The decisive procedural mechanism (who decides, at what stage, in what kind of hearing) was read in a
      primary source or in scholarship quoting it; otherwise the entry stays white with `hypothetical_colour`.
- [ ] Each coloured entry has at least one source with a working URL, exact articles in `legal_bases`, and an
      excerpt of at most 25 words copied verbatim in the original language.
- [ ] Derived fields (`summary`, `cases_to_check`, legend counts, `colour_derived_from_facts`) are left as they were.
- [ ] `python3 tools/dataset.py validate data/insanity_procedure_map.json` passes.
