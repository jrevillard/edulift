## Cahier des Charges — Application de Gestion Collaborative de Trajets Scolaires : **EduLift**

---

### 1. Objectifs

L'application EduLift est conçue pour simplifier et centraliser l'organisation hebdomadaire des trajets domicile-école pour des groupes de parents. En s'appuyant sur un modèle collaboratif, elle permet de répartir équitablement les trajets entre familles, tout en assurant une visibilité claire sur les responsabilités et les disponibilités de chacun.

Chaque utilisateur peut gérer ses propres enfants, ses véhicules, et rejoindre un ou plusieurs groupes de coordination selon les niveaux scolaires concernés (par exemple : un groupe pour le primaire, un autre pour le collège). L’application met à disposition un système de planification souple et récurrente, capable de s’adapter aux variations hebdomadaires, avec une interface intuitive pensée pour des consultations fréquentes et des modifications rapides.
Pour résumer:

- Faciliter l’organisation hebdomadaire des trajets enfants/école pour une communauté de parents.
- Gérer dynamiquement les créneaux, conducteurs, véhicules et affectations d’enfants.
- Offrir une interface intuitive, responsive et collaborative.

---

### 2. Concepts Clés

- **Groupe** : ensemble d’utilisateurs (parents) partageant les mêmes trajets.
- **Parent** : utilisateur authentifié, gère ses enfants et ses véhicules.
- **Enfant** : entité liée à un parent, assignable à un trajet.
- **Véhicule** : entité liée à un parent, capacité configurable.
- **Créneau** : heure de départ pour un jour donné, définie chaque semaine.
- **Trajet** : occurrence à un jour/créneau, avec conducteur(s), véhicule et enfants.
- **Vue Semaine** : grille jour × créneau affichant tous les trajets.

---

### 3. Parcours Utilisateur

#### 3.1. Inscription & Configuration Initiale

1. Création de compte / connexion (email / magic link).
2. Rejoindre un groupe via invitation ou en créer un (réservé aux administrateurs de groupe).
3. Ajouter ou modifier ses enfants et véhicules (nom, capacité).
4. Optionnel : configurer notification email.

#### 3.2. Planification Hebdomadaire

1. À l’ouverture d’une nouvelle semaine :

   - Afficher en proposition les créneaux de la semaine précédente (copie en 1 clic).
   - Permettre d’ajouter/modifier/supprimer des créneaux par jour.

2. Validation des créneaux actifs pour la semaine.
3. Diffusion des créneaux validés aux membres.

#### 3.3. Organisation des Trajets

1. Accès à la **Vue Semaine** (grille : colonnes = jours, lignes = créneaux horaires).
2. Pour chaque créneau validé :

   - Deux trajets possibles : Aller et Retour (création à la première interaction).
   - Assignation d’un conducteur et d’un véhicule (proposition automatique selon disponibilités).
   - Affectation des enfants via sélection ou glisser-déposer.
   - Option « à pied » pour les enfants autonomes.

3. Visualisation instantanée :

   - Nombre de places restantes et remplies.
   - Alertes visuelles en cas de surcapacité ou de trajet non couvert.

4. Modifications jusqu’à J‑0 23h59 :

   - Changement de conducteur, véhicule ou affectations.
   - Annulation ou suppression de trajet si nécessaire.

---

### 3.4. UX Detaillée

#### A. Écran d’Accueil / Tableau de Bord

- **Header** avec navigation (Groupes, Enfants, Véhicules, Paramètres).
- **Vue synthèse** des trajets de la semaine en cours (mini-grille).
- **Bouton** « Planifier semaine » donnant accès au Planificateur de Créneaux.

#### B. Planificateur de Créneaux (Semaine)

- **Liste éditable** de jours (lundi–vendredi) avec créneaux en ligne.
- **Actions** : ajouter (+), modifier (✎), supprimer (🗑) un créneau.
- **Copier de la semaine précédente** : bouton global en haut.
- **Validation** : bouton « Valider et diffuser » fixe en bas.

#### C. Vue Semaine Principale

- **Grille interactive** affichant chaque jour et créneau avec trajet Aller/Retour.
- **Cartes de trajet** indiquant : conducteur, véhicule, places disponibles.
- **Interaction** :

  - Cliquer sur une carte pour ouvrir le détail et modifier conducteur, véhicule ou enfants.
  - Glisser-déposer ou sélectionner depuis une liste latérale d’enfants.

- **Filtres** : par groupe, parent, type de trajet.
- **Alertes** : icônes ou couleurs pour signaler surcapacité ou absence de conducteur.

#### D. Gestion des Enfants / Véhicules. Gestion des Enfants / Véhicules

- **Modals** de CRUD accessibles via la sidebar ou le profil.
- **Formulaire** simple : nom, photo optionnelle, classe/âge (enfant), nom, capacité (véhicule).
- **Notifications** contextuelles à la création/modification réussie.

#### E. Notifications & Alertes

- **Bannière** en haut pour alertes globales (créneaux non validés, places insuffisantes).
- **Toasts** pour actions (ajout d’enfant, affectation, annulation).

---

### 4. Fonctionnalités MVP

| Fonctionnalité      | Description courte                                                                |
| ------------------- | --------------------------------------------------------------------------------- |
| Authentification    | Email / magic link ; gestion mot de passe oublié                                  |
| Gestion Groupe      | Création/seuil d’administrateurs ; invitation ; multi-groupes par niveau scolaire |
| Gestion Enfants     | CRUD ; configuration d’âge/type d’école                                           |
| Gestion Véhicules   | CRUD ; capacité ; voiture partagée ou personnelle                                 |
| Planificateur Hebdo | Copie intelligente ; édition en ligne ; limite de créneaux par jour               |
| Vue Semaine         | Grille interactive ; indicateurs de charge ; filtres (par parent, véhicule)       |
| Assignation Enfants | Drag & drop ; mode "à pied" ; historique des modifications                        |

---

### 5. Rôles et Permissions

- **Administrateur de Groupe** :

  - Créer, modifier, supprimer des groupes.
  - Gérer invitations et rôles (promouvoir/rétrograder).
  - Configurer paramètres globaux (créneaux par défaut, jours ouvrés).

- **Parent** :

  - Rejoindre un ou plusieurs groupes.
  - Gérer ses propres enfants et véhicules.
  - Participer à la planification et affecter ses enfants.

---

### 6. Exigences Non-Fonctionnelles

- **Sécurité** : RGPD, authentification sécurisée.
- **Performance** : réponse UI <200 ms ; support de 20+ utilisateurs simultanés par groupe.
- **Disponibilité** : 99,9 % SLA ; sauvegardes nocturnes.
- **Scalabilité** : montée en charge via architecture cloud (k8s, autoscaling).
- **Accessibilité** : WCAG 2.1 AA ; support multi-langue (i18n) - Français et Anglais dans un 1er temps.

---

### 7. Contraintes Techniques

#### 7.1. Stack Technique Obligatoire

- Backend : Node.js + Express + TypeScript + Prisma ORM
- Base de données : SQLite (fichier unique, migration PostgreSQL préparée)
- Frontend : React + TypeScript + Vite + TailwindCSS
- Temps réel : Socket.io (WebSockets avec fallbacks automatiques)
- Authentication : Passport.js + JWT + express-session
- Validation : Zod pour input validation côté backend et frontend

#### 7.2. Containerisation Docker Obligatoire

- Multi-stage Dockerfiles : Backend et Frontend séparés
- Docker Compose Dev : Hot-reload, volumes montés, services isolés
- Docker Compose Prod : Nginx reverse proxy, SSL Certbot, healthchecks
- Optimisations : .dockerignore, utilisateurs non-root, cache layers

### 8. Anticipation des Questions Développement

1. **Gestion des fuseaux horaires** : tous les utilisateurs en même fuseau, config. unique.
2. **Limites de créneaux** : définir un max par jour/semaine.
3. **Conflits simultanés** : verrou pessimiste sur affectations.
4. **Historique et audit** : conserver log des modifications (user, timestamp).
5. **Export & Intégrations** : ICS, API REST pour apps tierces.
6. **Tests** : unitaires, e2e, performance.

---

### 9. Évolutions Futures

1. V2 : notifications push/email, suggestion automatique d’affectations.
2. V3 : export ICS, synchronisation agenda Google/Outlook.
3. V3 : mobile natif (iOS/Android).
4. V4 : module statistiques et participation.
