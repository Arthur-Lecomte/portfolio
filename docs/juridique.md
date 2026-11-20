# Conformité juridique — sources et points à vérifier

Rédigé en novembre 2026 d'après les textes en vigueur. Je ne suis pas juriste :
les sources primaires sont listées ici, et la section « À vérifier par Arthur »
récapitule ce qui doit être contrôlé par lui (ou un professionnel) avant et
après la mise en ligne.

## Choix retenus

- **Mentions légales** : l'obligation relève de l'article 1-1 de la LCEN
  (loi n° 2004-575), réécrit par la loi SREN n° 2024-449 du 21 mai 2024.
  Le II de cet article permet à un éditeur **non professionnel** de ne tenir à
  disposition du public que le nom et l'adresse de l'hébergeur, à condition
  d'avoir communiqué ses éléments d'identification personnelle (nom, prénoms,
  domicile, téléphone) à cet hébergeur. Le site affiche volontairement le nom
  d'Arthur et son e-mail de contact, mais ni adresse postale ni téléphone :
  le texte n'impose pas ces deux derniers dans le régime du II. Afficher son
  nom tout en restant sous ce régime est défendable (le II fixe un minimum,
  pas un maximum) mais n'est pas tranché par la jurisprudence — risque
  résiduel accepté en connaissance de cause.
- **Pas de bandeau cookies** : le site ne dépose aucun cookie ni traceur
  soumis à consentement. Le `localStorage` des démos (sauvegardes et
  préférences, jamais transmis) est exempté au titre de l'article 82,
  alinéa final, 2° de la loi 78-17 (stockage strictement nécessaire au
  service expressément demandé — délibération CNIL n° 2020-091, art. 1 et 5).
- **Coordonnées Cloudflare** : le téléphone affiché (+1 650 319 8930) est
  celui de la privacy policy officielle, vérifié en ligne le 20/11/2026
  (le +1 888 993 5273 parfois cité est la ligne commerciale).
- **Pas de mesure d'audience** : choix d'Arthur (2026-11-20). Si Plausible
  (ou autre) est activé un jour : refaire l'évaluation avec les critères CNIL
  en vigueur et l'outil d'auto-évaluation (cnil.fr), consigner le résultat
  dans decisions.md et mettre à jour la page Confidentialité AVANT activation.
- **Transferts UE → États-Unis** : Cloudflare, Inc. est certifiée au
  Data Privacy Framework (décision d'adéquation (UE) 2023/1795). Le recours
  Latombe (T-553/23) a été rejeté par le Tribunal de l'UE le 3 septembre 2025 ;
  un pourvoi (C-703/25 P) est pendant devant la CJUE.

## Sources primaires

- Art. 1-1 LCEN : legifrance.gouv.fr/loda/article_lc/LEGIARTI000049568614
- Art. 82 loi 78-17 : legifrance.gouv.fr/loda/article_lc/LEGIARTI000037813978
- Lignes directrices cookies, délib. 2020-091 : legifrance.gouv.fr/cnil/id/CNILTEXT000042398005
- CNIL, « Cookies : solutions pour les outils de mesure d'audience » (04/07/2025)
- Décision d'adéquation (UE) 2023/1795 ; Trib. UE, T-553/23, 3 sept. 2025 ;
  pourvoi CJUE C-703/25 P
- Cloudflare : privacy policy (coordonnées + certification DPF),
  trust hub GDPR (cloudflare.com/trust-hub/gdpr/)
- AFNIC, diffusion restreinte du WHOIS pour les particuliers (afnic.fr)

## À vérifier par Arthur (avec dates)

1. **Avant la mise en ligne** : relire l'article 1-1 LCEN sur Légifrance
   (lien ci-dessus) pour vérifier qu'il n'a pas été modifié depuis nov. 2026.
2. **Avant la mise en ligne, puis à chaque déménagement ou changement de
   numéro** : vérifier que ton compte Cloudflare (et le compte OVH du
   domaine) contient ton identité complète et exacte — nom, prénoms,
   adresse, téléphone. C'est la condition expresse du régime d'anonymat
   partiel du II, et elle est **continue** : des coordonnées périmées le
   feraient tomber.
3. **Avant la mise en ligne** : confirmer les coordonnées de Cloudflare, Inc.
   (adresse, téléphone) sur cloudflare.com, et le statut « Active » de sa
   certification sur dataprivacyframework.gov (recherche « Cloudflare »).
4. **Après la mise en ligne** : vérifier dans le WHOIS d'arthurlecomte.fr que
   ton adresse n'apparaît pas (la diffusion restreinte AFNIC est automatique
   pour les particuliers, mais vérifier coûte une minute).
5. **En continu (1×/an suffit)** : surveiller l'issue du pourvoi C-703/25 P ;
   si le Data Privacy Framework tombait, la page Confidentialité devrait
   basculer sur les clauses contractuelles types comme base de transfert.
6. **Si activation de statistiques un jour** : voir « Pas de mesure
   d'audience » ci-dessus — évaluation CNIL d'abord, page Confidentialité
   ensuite, activation en dernier.
7. **Après le déploiement, et après tout changement de réglage Cloudflare** :
   vérifier dans les DevTools (onglet Application) qu'aucun cookie n'est
   réellement posé. Attention : activer Bot Fight Mode ou un « challenge »
   Cloudflare poserait des cookies (`__cf_bm`, `cf_clearance`) et rendrait
   fausse la page Confidentialité — ne pas activer ces options sans la
   mettre à jour.
8. **Si une démo future transmet quoi que ce soit** (scores en ligne,
   télémétrie…) : refaire l'analyse de l'article 82 pour cette démo avant
   publication — l'exemption actuelle repose sur « jamais transmis ».
