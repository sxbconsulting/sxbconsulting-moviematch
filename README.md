# 🎬 MovieMatch

Swipe & match de films (et séries) entre potes. Mobile-first, sans compte, sans build : du HTML/CSS/JS
vanilla servi tel quel par GitHub Pages, une base Supabase pour la synchro en direct entre téléphones,
TMDB pour le catalogue et les affiches, et Claude (via une Edge Function) pour les imports "intelligents"
(lien, photos, suggestions floues).

**URL de l'app** : https://sxbconsulting.github.io/sxbconsulting-moviematch/

## Stack

| Composant | Rôle |
|---|---|
| `index.html` + `/css` + `/js` | L'app elle-même, aucune étape de build |
| Supabase (Postgres + Realtime) | Salles de swipe, votes en direct, listes partagées |
| TMDB | Catalogue films/séries, affiches, fiches |
| Edge Function `claude-proxy` | Imports par lien/photos, suggestions floues (clé Anthropic protégée côté serveur) |
| GitHub Pages | Hébergement statique |
| GitHub Actions | Anti-pause Supabase (ping toutes les 48h) |

## Déploiement — étapes déjà faites pour ce dépôt

Cette section documente ce qui a été configuré, pour toi (si tu dois recommencer un jour) ou pour
quelqu'un qui reprendrait le projet.

1. **Repo GitHub** : `sxbconsulting/sxbconsulting-moviematch`, public.
2. **GitHub Pages** : activé sur la branche `main`, dossier racine — Settings → Pages.
3. **Projet Supabase** : projet dédié `moviematch` (plan gratuit).
4. **Base de données** : le fichier [`supabase_setup.sql`](supabase_setup.sql) à la racine de ce
   dépôt contient tout le schéma (tables `mm_sessions`/`mm_players`/`mm_shared_lists`, RLS, Realtime).
   Il est **idempotent** : tu peux le recoller entièrement dans le SQL Editor de Supabase sans
   risque, même si une partie existe déjà.
5. **Clés côté client** : le fichier [`config.js`](config.js) à la racine contient la clé TMDB et
   l'URL + la Publishable key de Supabase. Ces clés sont **volontairement publiques** (lecture
   protégée par RLS côté Supabase, lecture seule côté TMDB) — voir [`config.example.js`](config.example.js)
   si tu dois régénérer ce fichier.
6. **Edge Function `claude-proxy`** : déployée sur le projet Supabase (code dans
   [`supabase/functions/claude-proxy/index.ts`](supabase/functions/claude-proxy/index.ts)).
   Le secret `ANTHROPIC_API_KEY` est enregistré dans le tableau de bord Supabase
   (Edge Functions → Secrets) — **jamais dans le code, jamais dans ce dépôt**.
7. **Secrets GitHub Actions** (Settings → Secrets and variables → Actions, sur ce dépôt) :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   Utilisés uniquement par [`.github/workflows/keepalive.yml`](.github/workflows/keepalive.yml)
   pour empêcher le projet Supabase de se mettre en pause par inactivité.

### Si tu dois tout refaire depuis zéro un jour

1. Crée un nouveau projet Supabase, colle `supabase_setup.sql` dans le SQL Editor.
2. Récupère l'URL et la Publishable key du projet (Project Settings → API Keys), mets-les dans `config.js`.
3. Déploie l'Edge Function : `supabase functions deploy claude-proxy --project-ref TON_REF` (ou via
   le tableau de bord), puis ajoute le secret `ANTHROPIC_API_KEY` (Edge Functions → Secrets).
4. Ajoute les deux secrets `SUPABASE_URL`/`SUPABASE_ANON_KEY` dans les secrets GitHub Actions du dépôt.
5. Active GitHub Pages sur la branche `main`.

## Tester à deux téléphones

1. Ouvre l'app sur ton téléphone, mets ton prénom, crée une salle (un des 4 modes).
2. Note le code à 4 lettres affiché sur le ticket jaune.
3. Sur un deuxième téléphone (ou l'ordinateur d'un pote), ouvre la même URL, mets un autre prénom,
   entre le code pour rejoindre.
4. Swipez chacun de votre côté : l'écran "Résultats" du premier téléphone doit se mettre à jour
   **tout seul**, sans recharger la page, dès que le deuxième vote.
5. Si un film est liké par tout le monde, il remonte en haut avec une étiquette de match (✨).

## Résilience — ce qui a été prévu

- **Timeouts réseau** : 4 secondes sur les appels TMDB et Supabase (rapides par nature). Les appels
  à Claude (Edge Function) utilisent un délai plus long (20s) car une recherche web assistée par IA
  prend naturellement plus de temps — un timeout à 4s les ferait systématiquement échouer.
- **Mode hors-ligne** : si Supabase est injoignable au moment de créer une salle, l'app bascule
  automatiquement en solo (bannière ⚡ jaune) — tu peux quand même swiper, tes votes restent sur
  ton appareil. Testé en coupant volontairement l'accès à Supabase.
- **Realtime + repli automatique** : la synchro entre téléphones passe par Supabase Realtime ; si la
  connexion temps réel échoue ou met plus de 3 secondes à s'établir, l'app repasse sur un
  rafraîchissement toutes les 3,5 secondes, de façon transparente.
- Tous les boutons qui déclenchent un appel réseau affichent un état "…"/"Chargement" — aucun ne
  reste silencieux en cas de lenteur.

## 3 tests manuels avant d'envoyer aux potes

1. **Créer une salle sur ton téléphone, la rejoindre sur celui d'un pote, swiper chacun de votre
   côté, et vérifier que l'écran Résultats affiche bien un match** sur un film liké par les deux.
2. **Couper le Wi-Fi/la 4G au moment de créer une salle** (ou juste après) pour vérifier que la
   bannière hors-ligne apparaît et que tu peux quand même swiper sans que l'app se bloque.
3. **Tester "🎲 Décision éclair" sans prénom ni salle**, directement depuis l'accueil, pour confirmer
   que ce raccourci fonctionne bien sans configuration préalable.
