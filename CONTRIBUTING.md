# Contribuer

Merci d'aider à rendre cette carte plus exacte. Les corrections de personnes qui connaissent le droit et la
pratique d'une juridiction sont les contributions les plus précieuses. (Les contributions en anglais vont sur la
branche `main`, qui a son propre jeu de données et son propre guide.)

## Pull requests : le JSON uniquement

- Les pull requests ne peuvent modifier que le jeu de données **`donnees/irresponsabilite_penale.json`**, en
  visant la branche `francais`.
- Ne modifiez ni les cartes (`cartes/`), ni les outils (`outils/`), ni la documentation dans une pull request :
  une vérification automatique rejette toute pull request qui touche autre chose qu'un fichier JSON de
  `donnees/`. Après la fusion, la carte est régénérée à partir du JSON.
- Ne modifiez pas non plus les champs dérivés ; ils sont recalculés après la fusion
  (`outils/donnees.py rafraichir`) : `synthese`, `cas_a_verifier`, `categories.*.n_pays`,
  `categories.*.n_subdivisions`, `couleur_deduite_des_faits`, `meta.nb_entrees`.
- Une juridiction (ou un ensemble cohérent, par exemple les États d'une même fédération) par pull request.
  Dans la description, indiquez ce que vous avez lu (loi, décision, version ou date) et pourquoi la couleur en
  découle.

## Ce que montre la carte

**Scénario de référence.** Un adulte est poursuivi pour un crime grave (par exemple un homicide). Les éléments
psychiatriques indiquent qu'au moment des faits un trouble mental a totalement aboli son discernement ou le
contrôle de ses actes.

**Question.** L'irresponsabilité pénale est-elle établie avant un procès (qui n'a alors pas lieu, ou pas
vraiment), pendant le procès ordinaire, au choix de l'accusé, ou n'est-elle pas reconnue ?

**Couleurs.** À appliquer dans cet ordre ; la première qui convient l'emporte :

1. **noir** : aucune irresponsabilité reconnue ; toute personne condamnée va en prison.
2. **bleu** : l'accusé (la défense) choisit si et quand l'état mental est examiné ; le parquet ou le juge ne
   peuvent pas l'imposer à un accusé apte (ex. Canada, arrêt Swain).
3. **jaune** : l'état mental est examiné avant tout procès et, si le discernement était aboli, l'affaire se
   termine sans vrai procès, par un non-lieu ou par une procédure amoindrie qui remplace le procès (ex. France
   depuis 2008). Un procès n'a lieu que si la personne est jugée responsable.
4. **violet** : l'état mental est examiné d'abord et oriente vers une voie spéciale, mais un vrai procès (débat
   contradictoire devant la juridiction de jugement, mêmes preuves, même standard de preuve) précède toujours
   la mesure, ou l'accusé peut obtenir un procès complet sur demande.
5. **vert** : pas de filtre préalable ; le procès ordinaire établit les faits, puis la juridiction de jugement
   constate l'irresponsabilité et ordonne elle-même la mesure.
6. **blanc** : données insuffisantes, ou hors périmètre.

Ignorez l'altération partielle du discernement et le plaider-coupable. L'aptitude à être jugé (l'état au moment
du procès) se décrit dans `faits.inaptitude_a_etre_juge` mais ne décide jamais de la couleur. Le simple pouvoir
du parquet de classer une affaire ne suffit pas pour le jaune, et une audience de soins non pénale
(hospitalisation civile ou administrative) n'est jamais « le jugement ». Quand deux voies coexistent, décrivez
la voie ordinaire du scénario de référence ; les voies fondées sur un accord des parties sont assimilées à un
plaider-coupable.

## Périmètre : quelles juridictions sont incluses

Un régime autoritaire n'est pas, à lui seul, une raison d'exclusion. Certains pays autoritaires conservent,
pour les affaires de droit commun, une justice où la loi sur les droits de la défense reste suivie (hors
corruption) : ils sont inclus. Pour d'autres, l'absence d'État de droit fait que la loi n'est qu'indicative,
pas une obligation à suivre : ils sont écartés (en blanc) et listés dans `perimetre.exclus` avec la raison.
Certaines juridictions sont aussi écartées par choix du cadrage (par exemple Bahreïn, Singapour et Brunei) ;
chaque exclusion figure dans `perimetre.exclus` avec sa raison.

Pour proposer d'inclure ou d'exclure une juridiction, modifiez `perimetre.exclus` ou l'entité, et justifiez le
changement dans la pull request au regard de ce critère, avec des sources sur la façon dont les affaires de
droit commun sont réellement traitées.

## Règles de preuve

- **Le critère du blanc.** Une couleur autre que blanc suppose d'avoir lu le mécanisme procédural décisif (qui
  statue, à quel stade, dans quel type d'audience) dans une source primaire (loi, décision) ou une doctrine qui
  la cite. À défaut, l'entrée reste blanche et la couleur suggérée va dans `couleur_hypothese`. Pas de
  classement par analogie avec le modèle d'un autre pays.
- **Sources.** Au moins une source avec une URL valide pour toute entrée colorée ; préférez les textes
  officiels dans la ou les langues officielles de la juridiction, et précisez la version ou la date lue.
- **`bases_legales`.** Textes et numéros d'articles exacts.
- **`extrait`.** 25 mots au plus, copiés mot pour mot dans la langue d'origine (sans traduction).
- **`note`.** Votre raisonnement et les nuances, en français, environ 400 caractères (600 au maximum).
- **`confiance`.** `élevée` : loi et pratique lues ; `moyenne` : loi lue, pratique ou réformes récentes non
  vérifiées ; `faible` : sources indirectes seulement.
- **États fédéraux.** Quand la règle est infranationale, une entrée par entité (`niveau : "subdivision"`,
  `parent` : le code du pays ; codes ISO 3166-2 ou codes propres déjà utilisés dans le fichier, comme `GB-ENG`,
  `TZ-ZAN` ou `BA-BRC`).
- **Langue.** Texte libre en français. Les citations de textes et les termes juridiques natifs restent dans
  leur langue d'origine.
- **Faits.** Gardez `faits` cohérent avec la couleur. La vérification signale une couleur qui diffère de celle
  qu'impliquent les faits ; expliquez tout écart voulu dans la note.

Le sens et les valeurs permises de chaque champ sont décrits dans `meta.schema`, dans le fichier JSON.

## Vérifier sa modification

```sh
python3 outils/donnees.py valider donnees/irresponsabilite_penale.json
```

La même vérification s'exécute automatiquement sur chaque pull request. Pour prévisualiser la carte en local
(facultatif ; Node.js 18+ et Python 3 avec Pillow) : `sh outils/construire.sh`, puis ouvrez
`cartes/irresponsabilite_penale.svg`.
