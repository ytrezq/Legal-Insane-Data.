## Juridiction(s)

<!-- ex. « BJ – Bénin » ou « US-NM – Nouveau-Mexique » -->

## Ce qui change

<!-- couleur / faits / sources / périmètre ; valeur précédente → nouvelle valeur -->

## Ce que vous avez lu

<!-- loi et articles, décision, version ou date ; liens -->

## Liste de vérification

- [ ] Seul `donnees/irresponsabilite_penale.json` est modifié, et la pull request vise la branche `francais`.
- [ ] Le mécanisme procédural décisif (qui statue, à quel stade, dans quel type d'audience) a été lu dans une
      source primaire ou une doctrine qui la cite ; sinon l'entrée reste blanche avec `couleur_hypothese`.
- [ ] Chaque entrée colorée a au moins une source avec une URL valide, les articles exacts dans
      `bases_legales` et un extrait de 25 mots au plus, copié mot pour mot dans la langue d'origine.
- [ ] Les champs dérivés (`synthese`, `cas_a_verifier`, comptes de la légende, `couleur_deduite_des_faits`)
      sont laissés tels quels.
- [ ] `python3 outils/donnees.py valider donnees/irresponsabilite_penale.json` passe.
