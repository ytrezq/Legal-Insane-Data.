"""Vérifier et rafraîchir le jeu de données (édition française).

  python3 outils/donnees.py valider donnees/irresponsabilite_penale.json
      Code de sortie 1 en cas d'erreur (utilisé par la vérification des pull requests). Les avertissements
      ne bloquent pas.

  python3 outils/donnees.py rafraichir donnees/irresponsabilite_penale.json [--geo outils/geo/admin1_sous_ensemble.geojson]
      Recalcule les champs dérivés après modification : couleur_deduite_des_faits, le drapeau confiance_faible,
      synthese, comptes de la légende (categories.*.n_pays / n_subdivisions), cas_a_verifier, meta.nb_entrees.

Bibliothèque standard uniquement (Python 3.8+).
"""
import argparse
import collections
import json
import re
import sys

COULEURS = ["vert", "jaune", "violet", "bleu", "noir", "blanc"]
CONFIANCE = ["élevée", "moyenne", "faible"]
NIVEAUX = ["pays", "subdivision"]
QUI = ["autorites", "defense", "mixte"]
STADES = ["phase_preparatoire", "proces_special", "proces_ordinaire", "sans_objet"]
REMPLACEMENT = ["aucune", "non_lieu_simple", "procedure_amoindrie", "vrai_proces_special"]
DRAPEAUX = ["verification_incomplete", "confiance_faible", "confirme_par_le_controle", "contredit_par_le_controle",
            "decision_manuelle", "couleur_differente_des_faits", "langue_officielle_non_utilisee",
            "couleur_blanchie_faute_de_source"]
DRAPEAUX_A_VERIFIER = {"confiance_faible", "verification_incomplete", "langue_officielle_non_utilisee",
                       "couleur_blanchie_faute_de_source", "couleur_differente_des_faits"}
FAITS_BOOLEENS = ["reconnait_irresponsabilite", "accuse_choisit_moment", "internement_sans_proces",
                  "proces_toujours_ou_sur_demande"]
FAITS_TEXTES = ["issue", "procedure_remplacement_detail", "inaptitude_a_etre_juge"]
CODE_RE = re.compile(r"^[A-Z]{2}(-[A-Z0-9]{1,4})?$")
MOTS_EXTRAIT_MAX = 25
CARACTERES_NOTE_MAX = 600


def deduire(f):
    """Couleur impliquée par les faits (ordre de classement : noir, bleu, jaune/violet, vert)."""
    if f.get("reconnait_irresponsabilite") is False:
        return "noir"
    if f.get("accuse_choisit_moment") is True:
        return "bleu"
    pr = f.get("procedure_remplacement")
    if pr in ("non_lieu_simple", "procedure_amoindrie"):
        return "violet" if f.get("proces_toujours_ou_sur_demande") else "jaune"
    if pr == "vrai_proces_special":
        return "violet"
    if pr == "aucune":
        return "bleu" if f.get("qui_declenche_examen") == "defense" else "vert"
    stade = f.get("stade_decision")
    if stade == "phase_preparatoire":
        return "violet" if f.get("proces_toujours_ou_sur_demande") else "jaune"
    if stade == "proces_special":
        return "violet"
    if stade == "proces_ordinaire":
        return "bleu" if f.get("qui_declenche_examen") == "defense" else "vert"
    return None


def valider(d):
    erreurs, avertissements = [], []
    err = erreurs.append
    avert = avertissements.append
    for k in ("titre", "categories", "perimetre", "meta", "entites"):
        if k not in d:
            err(f"clé de premier niveau manquante : {k}")
    if erreurs:
        return erreurs, avertissements
    if sorted(d["categories"]) != sorted(COULEURS):
        err(f"categories doit contenir exactement {COULEURS}")
    exclus = {x.get("code") for x in d["perimetre"].get("exclus", [])}
    vus = set()
    codes = {e.get("code") for e in d["entites"]}
    for i, e in enumerate(d["entites"]):
        c = e.get("code")
        ou = f"entites[{i}] ({c})"
        if not isinstance(c, str) or not CODE_RE.match(c):
            err(f"{ou} : code invalide (ISO 3166 alpha-2, ou alpha-2 + « - » + 4 caractères au plus)")
        if c in vus:
            err(f"{ou} : code en double")
        vus.add(c)
        if c in exclus:
            err(f"{ou} : code également listé dans perimetre.exclus")
        for k in ("nom", "bases_legales", "note"):
            if not isinstance(e.get(k), str) or not e.get(k).strip():
                err(f"{ou} : « {k} » doit être une chaîne non vide")
        if e.get("niveau") not in NIVEAUX:
            err(f"{ou} : niveau doit valoir {NIVEAUX}")
        if e.get("niveau") == "subdivision":
            p = e.get("parent")
            if not isinstance(p, str) or not CODE_RE.match(p):
                err(f"{ou} : une subdivision doit indiquer le code de son pays (parent)")
            elif p not in codes:
                avert(f"{ou} : le pays {p} n'a pas d'entrée propre")
        elif e.get("parent") not in (None, ""):
            err(f"{ou} : un pays doit avoir parent null")
        if e.get("couleur") not in COULEURS:
            err(f"{ou} : couleur doit valoir {COULEURS}")
        if e.get("confiance") not in CONFIANCE:
            err(f"{ou} : confiance doit valoir {CONFIANCE}")
        for k in ("langues_officielles", "langues_recherche"):
            v = e.get(k)
            if not isinstance(v, list) or not all(isinstance(x, str) for x in v):
                err(f"{ou} : « {k} » doit être une liste de codes de langue")
        f = e.get("faits")
        if not isinstance(f, dict):
            err(f"{ou} : faits manquants")
            f = {}
        for k in FAITS_BOOLEENS:
            if not isinstance(f.get(k), bool):
                err(f"{ou} : faits.{k} doit valoir true ou false")
        for k in FAITS_TEXTES:
            if not isinstance(f.get(k), str):
                err(f"{ou} : faits.{k} doit être une chaîne")
        if f.get("qui_declenche_examen") not in QUI:
            err(f"{ou} : faits.qui_declenche_examen doit valoir {QUI}")
        if f.get("stade_decision") not in STADES:
            err(f"{ou} : faits.stade_decision doit valoir {STADES}")
        if f.get("procedure_remplacement") not in REMPLACEMENT:
            err(f"{ou} : faits.procedure_remplacement doit valoir {REMPLACEMENT}")
        ex = e.get("extrait")
        if not isinstance(ex, str):
            err(f"{ou} : extrait doit être une chaîne (vide possible pour une entrée blanche)")
        else:
            if len(ex.split()) > MOTS_EXTRAIT_MAX:
                avert(f"{ou} : extrait de plus de {MOTS_EXTRAIT_MAX} mots")
            if not ex.strip() and e.get("couleur") != "blanc":
                avert(f"{ou} : entrée colorée sans extrait verbatim")
        if isinstance(e.get("note"), str) and len(e["note"]) > CARACTERES_NOTE_MAX:
            avert(f"{ou} : note de plus de {CARACTERES_NOTE_MAX} caractères")
        srcs = e.get("sources")
        if not isinstance(srcs, list):
            err(f"{ou} : sources doit être une liste")
            srcs = []
        for j, s in enumerate(srcs):
            if not isinstance(s, dict) or not isinstance(s.get("titre"), str) or not s.get("titre").strip():
                err(f"{ou} : sources[{j}] doit avoir un titre")
            elif not isinstance(s.get("url"), str) or not re.match(r"^https?://", s.get("url") or ""):
                err(f"{ou} : sources[{j}] doit avoir une url http(s)")
        if e.get("couleur") != "blanc" and not srcs:
            err(f"{ou} : une entrée colorée doit avoir au moins une source")
        hyp = e.get("couleur_hypothese")
        if hyp is not None:
            if hyp not in COULEURS:
                err(f"{ou} : couleur_hypothese doit valoir {COULEURS}")
            if e.get("couleur") != "blanc":
                err(f"{ou} : couleur_hypothese est réservée aux entrées blanches")
        for dr in e.get("drapeaux") or []:
            if dr not in DRAPEAUX:
                avert(f"{ou} : drapeau inconnu {dr}")
        dv = deduire(f)
        if e.get("couleur") not in ("blanc", None) and dv and dv != e.get("couleur") and not e.get("decision_fusion"):
            avert(f"{ou} : la couleur {e.get('couleur')} diffère de celle qu'impliquent les faits ({dv}) ; "
                  "expliquez-le dans la note ou alignez les faits")
    return erreurs, avertissements


def rafraichir(d, chemin_geo):
    geo = json.load(open(chemin_geo, encoding="utf-8"))
    unites = collections.defaultdict(set)
    for ft in geo["features"]:
        unites[ft["properties"]["parent"]].add(ft["properties"]["code"])
    ents = d["entites"]
    par_code = {e["code"]: e for e in ents}
    for e in ents:
        e["couleur_deduite_des_faits"] = deduire(e.get("faits") or {})
        dr = list(e.get("drapeaux") or [])
        if e.get("confiance") == "faible" and "confiance_faible" not in dr:
            dr.insert(0, "confiance_faible")
        elif e.get("confiance") != "faible":
            dr = [x for x in dr if x != "confiance_faible"]
        e["drapeaux"] = dr
    dessinee = lambda e: (e["niveau"] == "subdivision" and e.get("parent") in unites
                          and e["code"] in unites[e["parent"]])
    varie, comptes_unites = set(), collections.Counter()
    for par in {e["parent"] for e in ents if dessinee(e)}:
        cols = [(par_code.get(c) or par_code.get(par) or {}).get("couleur", "blanc") for c in sorted(unites[par])]
        if len(set(cols)) > 1:
            varie.add(par)
            comptes_unites.update(cols)
    n_pays = {k: sum(1 for e in ents if e["niveau"] == "pays" and e["code"] not in varie and e["couleur"] == k)
              for k in COULEURS}
    # un pays dessiné par unités, de règle uniforme mais sans entrée nationale (Bosnie), compte une fois
    for par in {e["parent"] for e in ents if dessinee(e)} - varie:
        if par not in par_code:
            cols = {(par_code.get(c) or {}).get("couleur", "blanc") for c in unites[par]}
            if len(cols) == 1:
                n_pays[cols.pop()] += 1
    n_subs = {k: comptes_unites.get(k, 0) + sum(1 for e in ents if e["niveau"] == "subdivision" and not dessinee(e)
                                                 and e["couleur"] == k) for k in COULEURS}
    d["synthese"] = {
        "pays": n_pays, "subdivisions": n_subs,
        "pays_federaux_a_regles_differentes": sorted(varie),
        "codes_par_couleur": {k: sorted(e["code"] for e in ents if e["couleur"] == k) for k in COULEURS},
        "confiance": dict(collections.Counter(e["confiance"] for e in ents)),
    }
    for k in COULEURS:
        d["categories"][k]["n_pays"] = n_pays[k]
        d["categories"][k]["n_subdivisions"] = n_subs[k]
    d["cas_a_verifier"] = [{"code": e["code"], "nom": e["nom"], "couleur": e["couleur"],
                            "confiance": e["confiance"], "drapeaux": e["drapeaux"]}
                           for e in ents if set(e["drapeaux"]) & DRAPEAUX_A_VERIFIER or e["couleur"] == "blanc"]
    d["meta"]["nb_entrees"] = len(ents)
    return d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("commande", choices=["valider", "rafraichir"])
    ap.add_argument("chemin")
    ap.add_argument("--geo", default="outils/geo/admin1_sous_ensemble.geojson")
    a = ap.parse_args()
    try:
        d = json.load(open(a.chemin, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        sys.exit(f"ERREUR : lecture impossible de {a.chemin} : {exc}")
    if a.commande == "valider":
        erreurs, avertissements = valider(d)
        for w in avertissements:
            print("AVERTISSEMENT :", w)
        for e in erreurs:
            print("ERREUR :", e)
        print(f"{len(d.get('entites', []))} entités, {len(erreurs)} erreur(s), {len(avertissements)} avertissement(s)")
        sys.exit(1 if erreurs else 0)
    erreurs, _ = valider(d)
    if erreurs:
        for e in erreurs:
            print("ERREUR :", e)
        sys.exit("rafraîchissement interrompu : corrigez d'abord les erreurs")
    rafraichir(d, a.geo)
    with open(a.chemin, "w", encoding="utf-8") as fh:
        json.dump(d, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print("rafraîchi", a.chemin, d["synthese"]["pays"], d["synthese"]["subdivisions"])


if __name__ == "__main__":
    main()
