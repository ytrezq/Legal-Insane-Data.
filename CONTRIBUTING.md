# Contributing

Thank you for helping to make this map more accurate. Corrections from people who know a jurisdiction's
law and practice are the most valuable contributions. (Contributions in French go to the `francais` branch,
which has its own dataset and guide.)

## Pull requests: the JSON data only

- Pull requests may only modify the dataset **`data/insanity_procedure_map.json`**.
- Do not edit the maps (`maps/`), the tools (`tools/`) or the documentation in a pull request: an automatic
  check rejects pull requests that touch anything other than JSON files under `data/`. After a merge, the
  maps are regenerated from the JSON.
- Do not edit the derived fields either; they are recomputed after the merge (`tools/dataset.py refresh`):
  `summary`, `cases_to_check`, `categories.*.n_countries`, `categories.*.n_subdivisions`,
  `colour_derived_from_facts`, `meta.n_entries`.
- One jurisdiction (or one coherent group, e.g. the states of one federation) per pull request. In the
  description, say what you read (statute, decision, version or date) and why the colour follows from it.

## What the map shows

**Reference scenario.** An adult is prosecuted for a serious crime (for example a homicide). The psychiatric
evidence indicates that at the time of the act a mental disorder totally abolished their discernment or the
control of their acts.

**Question.** Is criminal non-responsibility established before a trial (which then does not take place, or
not really), during the ordinary trial, at the accused's choice, or not recognised at all?

**Colours.** Apply them in this order; the first that fits wins:

1. **black**: no non-responsibility recognised; every convicted person goes to prison.
2. **blue**: the accused (the defence) chooses whether and when the mental state is examined; the prosecution
   or the judge cannot impose it on a fit accused (e.g. Canada, R. v. Swain).
3. **yellow**: the mental state is examined before any trial and, if discernment was abolished, the case ends
   without a real trial, through a dismissal (*non-lieu*) or a reduced procedure that replaces the trial
   (e.g. France since 2008). A trial only takes place if the person is found responsible.
4. **purple**: the mental state is examined first and routes the case to a special track, but a real trial
   (adversarial hearing before the trial court, same evidence and standard of proof) always precedes the
   measure, or the accused can obtain a full trial on request.
5. **green**: no pretrial gate; the ordinary trial establishes the facts, then the trial court finds the accused
   not responsible and orders the measure itself.
6. **white**: insufficient data, or outside the scope.

Ignore diminished responsibility (partial impairment) and plea bargaining. Fitness to stand trial (the state
at the time of the trial) is described in `facts.unfitness_to_stand_trial` but never decides the colour. The
prosecution's mere discretion to drop a case is not enough for yellow, and a non-criminal care hearing (civil
or administrative commitment) is never "the trial". Where two routes coexist, describe the ordinary route of
the reference scenario; routes based on an agreement of the parties are treated like a plea.

## Scope: which jurisdictions are included

An authoritarian regime is not a reason for exclusion in itself. Some authoritarian countries keep, for
ordinary criminal cases, a justice system in which the law on the rights of the defence is still followed
(corruption aside): they are included. In others, the absence of the rule of law means that the law is only a
hint, not a requirement to follow: they are left out (white), listed in `scope.excluded` with the reason.
Some jurisdictions are also left out by editorial choice (for example Bahrain, Singapore and Brunei); every
exclusion is listed in `scope.excluded` with its reason.

To propose including or excluding a jurisdiction, edit `scope.excluded` or the entity, and justify the change
in the pull request against this criterion, with sources on how ordinary criminal cases are actually handled.

## Evidence rules

- **The white criterion.** A colour other than white requires the decisive procedural mechanism (who decides,
  at what stage, in what kind of hearing) to have been read in a primary source (statute, decision) or in
  scholarship that quotes it. Without that, the entry stays white and the suggested colour goes in
  `hypothetical_colour`. No classification by analogy with another country's model.
- **Sources.** At least one source with a working URL for any coloured entry; prefer official texts in the
  official language(s) of the jurisdiction, and say which version or date you read.
- **`legal_bases`.** Exact statutes and article numbers.
- **`excerpt`.** At most 25 words, copied verbatim in the original language (no translation).
- **`note`.** Your reasoning and nuances, in English, about 400 characters (600 at most).
- **`confidence`.** `high`: statute and practice read; `medium`: statute read, practice or recent amendments
  not verified; `low`: indirect sources only.
- **Federal states.** When the rule is sub-national, give one entry per unit (`level: "subdivision"`,
  `parent`: the country code; codes are ISO 3166-2 or the custom codes already used in the file, such as
  `GB-ENG`, `TZ-ZAN` or `BA-BRC`).
- **Language.** Free text in English. Statutory quotations and native legal terms stay in the original language.
- **Facts.** Keep `facts` consistent with the colour. The check warns when the colour differs from the colour
  implied by the facts; explain any deliberate difference in the note.

The meaning and allowed values of every field are listed in `meta.schema` inside the JSON file.

## Checking your change

```sh
python3 tools/dataset.py validate data/insanity_procedure_map.json
```

The same check runs automatically on every pull request. To preview the map locally (optional; needs
Node.js 18+ and Python 3 with Pillow): `sh tools/build.sh`, then open `maps/insanity_procedure_map.svg`.
