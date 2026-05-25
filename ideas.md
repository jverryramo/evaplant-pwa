# Idées de design — PWA Evaplant Opérations Terrain

## Contexte
Application de terrain pour techniciens Ramo. Utilisée en extérieur, sur mobile, souvent avec les mains sales ou gantées. Charte graphique Ramo : vert foncé (#003D39), vert chartreuse (#DCF21E), brun (#8A7049), beige (#DDCCBF).

---

<response>
<text>

## Approche 1 — Terrain Industriel (Brutalisme Fonctionnel)

**Design Movement** : Brutalisme fonctionnel adapté au terrain — honnêteté des matériaux, lisibilité maximale.

**Core Principles** :
- Typographie massive et contrastée pour lecture en plein soleil
- Zones de toucher généreuses (min 56px), jamais de petits éléments
- Hiérarchie visuelle par la taille et le poids, pas par la couleur
- Aucune décoration superflue — chaque pixel a une fonction

**Color Philosophy** : Fond beige chaud (#DDCCBF) pour réduire la fatigue oculaire en extérieur. Vert foncé (#003D39) pour les en-têtes et actions primaires. Chartreuse (#DCF21E) uniquement pour les CTA critiques et les indicateurs d'état. Brun (#8A7049) pour le texte secondaire.

**Layout Paradigm** : Colonnes asymétriques larges. Navigation fixe en bas (thumb-friendly). Chaque section du wizard occupe 100% de la hauteur visible. Pas de sidebar — tout est vertical et scrollable.

**Signature Elements** :
- Bordures épaisses (3-4px) en vert foncé sur les cartes actives
- Numéros de section en très grand format (64px) en arrière-plan semi-transparent
- Barre de progression épaisse et visible en haut de chaque étape wizard

**Interaction Philosophy** : Feedback immédiat et exagéré — les boutons s'enfoncent visuellement, les champs cochés changent de fond entier. Pas d'animation subtile — tout est franc et direct.

**Animation** : Transitions de page en glissement horizontal rapide (150ms). Pas d'effets de fondu. Les checkboxes cochées déclenchent un flash de fond chartreuse.

**Typography System** : IBM Plex Mono pour les numéros et codes (section numbers, report IDs). IBM Plex Sans Bold pour les titres. IBM Plex Sans Regular pour le corps. Taille de base 16px minimum.

</text>
<probability>0.08</probability>
</response>

---

<response>
<text>

## Approche 2 — Terrain Professionnel (Minimalisme Structuré)

**Design Movement** : Minimalisme suisse adapté au terrain — grille stricte, clarté absolue, professionnalisme.

**Core Principles** :
- Grille à 8px — tout s'aligne sur cette grille
- Couleur comme signal, pas comme décoration
- Navigation toujours visible, jamais perdue
- Densité d'information contrôlée — ni trop ni trop peu

**Color Philosophy** : Fond blanc cassé (#F8F6F3) pour la lisibilité. Vert foncé (#003D39) comme couleur primaire dominante (header, boutons, accents). Chartreuse (#DCF21E) pour les états actifs et les alertes positives. Brun et beige pour les surfaces secondaires.

**Layout Paradigm** : Header fixe vert foncé avec logo et contexte (client/site/système). Navigation par onglets en bas. Contenu en cartes blanches avec ombres légères. Wizard avec sidebar de navigation des étapes sur desktop, drawer sur mobile.

**Signature Elements** :
- Header vert foncé avec texte chartreuse pour le contexte actif
- Cartes avec coin supérieur gauche coloré selon le statut (brouillon = brun, en cours = chartreuse, finalisé = vert)
- Indicateur de progression circulaire en chartreuse

**Interaction Philosophy** : Transitions douces et prévisibles. Les formulaires donnent un feedback visuel clair (bordure verte = valide, rouge = erreur). Le drawer "Aller directement à" glisse depuis la droite.

**Animation** : Framer Motion — entrées en fade+slide (200ms). Transitions de wizard en glissement. Drawer avec spring animation.

**Typography System** : DM Sans pour l'interface (lisibilité terrain). Fraunces pour les titres de section (contraste avec le fonctionnel). Taille base 15px, titres 20-28px.

</text>
<probability>0.07</probability>
</response>

---

<response>
<text>

## Approche 3 — Terrain Naturel (Organique Structuré)

**Design Movement** : Design biophilique industriel — connexion à la nature (phytoremédiation) avec rigueur technique.

**Core Principles** :
- Textures douces évoquant la terre et la végétation
- Formes légèrement arrondies mais pas génériques
- Couleurs tirées directement de la nature (vert, terre, beige)
- Interface qui "respire" — espacement généreux

**Color Philosophy** : Beige (#DDCCBF) comme fond principal — évoque la terre, réduit la fatigue. Vert foncé (#003D39) pour ancrer l'identité Ramo. Chartreuse (#DCF21E) utilisée avec parcimonie pour les actions clés. Brun (#8A7049) pour les accents et séparateurs.

**Layout Paradigm** : Navigation latérale fixe sur desktop (icônes + labels). Sur mobile, barre de navigation en bas avec 4 onglets. Les wizards utilisent un stepper horizontal en haut. Cartes avec coins arrondis (12px) et ombres douces.

**Signature Elements** :
- Fond de l'écran d'accueil avec texture subtile évoquant le sol
- Icônes personnalisées en style "ligne épaisse" cohérentes avec l'identité terrain
- Séparateurs de section en forme de trait brun organique

**Interaction Philosophy** : Micro-animations naturelles — les éléments apparaissent comme s'ils "poussaient". Les formulaires complétés affichent une coche animée. Le scroll est fluide avec momentum.

**Animation** : Entrées en scale+fade depuis le bas (comme une plante qui pousse). Transitions de page en crossfade doux (250ms). Hover states avec légère élévation des cartes.

**Typography System** : Nunito pour l'interface (arrondi, accessible). Playfair Display pour les titres principaux (élégance naturelle). Taille base 15px mobile, 14px desktop.

</text>
<probability>0.06</probability>
</response>
