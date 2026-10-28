# Legal Insane Data — édition française

**Discernement totalement aboli au moment des faits : juger d'abord, ou établir l'irresponsabilité d'abord ?**

Carte du monde et jeu de données sur le sort procédural d'une personne poursuivie pour un crime grave (par
exemple un homicide) dont le discernement, ou le contrôle de ses actes, était totalement aboli par un trouble
mental au moment des faits. Droit en vigueur au 28 octobre 2026. L'édition anglaise, traduite de celle-ci, est
sur la branche [`main`](https://github.com/ytrezq/Legal-Insane-Data./tree/main).

![Carte (projection de Mollweide)](cartes/irresponsabilite_penale.jpg)

La version SVG (`cartes/irresponsabilite_penale.svg`) affiche une infobulle sur chaque pays et chaque entité
fédérée : la règle, sa base légale, les nuances et le niveau de confiance.

## Couleurs

| Couleur | Signification | Pays | Subdivisions ou territoires |
|---|---|---:|---:|
| Vert | **On juge d'abord** : pas de filtre préalable ; le procès ordinaire établit les faits, puis la juridiction de jugement constate l'irresponsabilité et ordonne elle-même la mesure. | 83 | 23 |
| Jaune | **Irresponsabilité d'abord, sans vrai procès** : état mental examiné avant tout procès ; non-lieu, ou procédure amoindrie qui remplace le procès (France depuis 2008). | 22 | 23 |
| Violet | **Irresponsabilité d'abord, mais jugement** : voie spéciale, mais un vrai procès précède toujours la mesure, ou a lieu à la demande de l'accusé. | 25 | 5 |
| Bleu | **L'accusé choisit le moment** : la défense décide si et quand l'état mental est examiné (ex. Canada, arrêt Swain). | 3 | 53 |
| Noir | **Aucune irresponsabilité reconnue** : toute personne condamnée va en prison. | 0 | 1 |
| Blanc | **Pas de données / hors cadrage**. | 8 | 2 |

Les couleurs s'appliquent dans l'ordre noir, bleu, jaune, violet, vert ; l'altération partielle du discernement
et le plaider-coupable sont ignorés ; l'aptitude à être jugé est décrite mais ne décide jamais de la couleur. Les
États fédéraux sont découpés par entité quand la règle est infranationale (États-Unis, Australie, Royaume-Uni,
Argentine, Inde/Kerala, Tanzanie/Zanzibar, Bosnie-Herzégovine).

**Périmètre.** OCDE (hors Turquie), Amériques (hors Cuba), Océanie, Afrique (hors Maghreb, Égypte, Érythrée et
Sahel sauf Sénégal et Mauritanie), Balkans (hors Serbie), Ukraine et Moldavie (zones contrôlées), et une
sélection de pays d'Asie dont les Émirats arabes unis. Un régime autoritaire n'est pas exclu en tant que tel :
ce qui compte est que, pour le droit commun, la loi sur les droits de la défense reste suivie (hors
corruption). Là où l'absence d'État de droit fait que la loi n'est qu'indicative, pas une obligation, la
juridiction est écartée (voir [CONTRIBUTING.md](CONTRIBUTING.md)).

**Encore en blanc faute de texte de procédure lisible :** Bénin, Comores, Djibouti, Guinée, Guinée
équatoriale, Rwanda, Somalie, Soudan du Sud, Zanzibar et district de Brčko. Les infobulles et le JSON donnent
l'hypothèse non vérifiée quand il y en a une. Les contributions sont particulièrement bienvenues pour ceux-là.

## Fichiers

| Chemin | Contenu |
|---|---|
| `donnees/irresponsabilite_penale.json` | **Le jeu de données** : 253 entrées avec les faits, les bases légales, un extrait verbatim, des notes, les sources, la confiance, l'historique et les contrôles indépendants ; méthodologie, périmètre, description des champs (`meta.schema`) et règles de contribution. |
| `cartes/irresponsabilite_penale.svg` / `.jpg` | Carte : SVG interactif et JPG de 3740 × 2680 pixels (10 mégapixels). |
| `outils/` | Validation (`donnees.py`) et génération de la carte (`construire.sh`, Node.js + Python). |

## Comment les données ont été établies

Le jeu de données a été établi le 28 octobre 2026 par des agents de recherche d'IA (Claude, d'Anthropic) pour
le compte du propriétaire du dépôt. Les codes pénaux, codes de procédure pénale et la jurisprudence ont été lus
dans la ou les langues officielles de chaque juridiction. Une seconde passe a vérifié les entrées fragiles, et
des agents qui n'avaient pas rédigé les entrées en ont contrôlé 38 à fort enjeu (37 confirmées, 1 douteuse).
Une couleur n'a été retenue que si le mécanisme procédural décisif avait réellement été lu ; sinon l'entrée
reste blanche. C'est un jeu de données de recherche, pas un avis juridique : chaque entrée porte ses sources,
un extrait verbatim et un niveau de confiance ; vérifiez-les et corrigez-les par pull request.

## Contribuer

Pull requests sur le JSON uniquement. Lisez [CONTRIBUTING.md](CONTRIBUTING.md) pour les règles de classement,
le critère de périmètre et les preuves demandées. Chaque pull request est vérifiée automatiquement. Après une
fusion dans la branche `francais`, un workflow recalcule les champs dérivés et régénère la carte.

Pour reconstruire en local (Node.js 18+, Python 3 avec Pillow) :

```sh
python3 outils/donnees.py valider donnees/irresponsabilite_penale.json
python3 outils/donnees.py rafraichir donnees/irresponsabilite_penale.json
sh outils/construire.sh
```

## Crédits

Fond de carte : [Natural Earth](https://www.naturalearthdata.com/) (domaine public) via
[world-atlas](https://github.com/topojson/world-atlas) ; ligne de contrôle en Ukraine au 28 octobre 2026 :
données quotidiennes de DeepStateMap ([cyterat/deepstate-map-data](https://github.com/cyterat/deepstate-map-data)) ;
Transnistrie : unités administratives Natural Earth ; noms de pays :
[i18n-iso-countries](https://github.com/michaelwittig/node-i18n-iso-countries) ; projection :
[d3-geo-projection](https://github.com/d3/d3-geo-projection).
