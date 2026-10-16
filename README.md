# GestionTâches

Application de gestion de projets façon kanban : colonnes personnalisables, glisser-déposer, notifications en temps réel (Socket.IO) et permissions par équipe (admin / member / viewer).
Stack : React + TypeScript (Vite), Node.js (Express), PostgreSQL.

## Rôles
- **admin** : tout, y compris inviter des membres et supprimer des colonnes
- **member** : créer/modifier/déplacer des tâches, créer/renommer des colonnes, créer des tableaux
- **viewer** : lecture seule

## Installation (PowerShell)
1. Base de données (au choix)
   - Docker : `docker compose up -d` (le schéma est appliqué automatiquement)
   - PostgreSQL local : créez une base `gestiontaches`, adaptez `server/.env`, puis `cd server; npm install; npm run init-db`
2. API : `cd server; npm install; npm run dev` → http://localhost:4000
3. Client : `cd client; npm install; npm run dev` → http://localhost:5173

## Vérifier que tout marche
1. Créez un compte, puis une équipe et un tableau (3 colonnes par défaut).
2. Ajoutez des tâches et déplacez-les par glisser-déposer.
3. Ouvrez un second navigateur avec un autre compte, invitez-le (rôle `member`) : ses actions apparaissent en notification chez vous en direct.
4. Invitez un compte en `viewer` : il ne peut rien modifier.

Avant la mise en production : changez `JWT_SECRET` dans `server/.env`.
