# 🔍 ANALYSE STATUTS ÉVÉNEMENTS - CORRECTION REQUISE

## ❓ BESOIN DE CLARIFICATION

**Vous avez mentionné:** "le statut de l'événement est erroné"

Pour corriger le problème, j'ai besoin de comprendre:

### 1. Informations sur l'événement problématique

**EventId:** `______________________________________`

**Dates/Heures configurées:**
- `startDate`: _____ / _____ / _____ (Date de début)
- `checkInTime`: _____ h _____ (Heure d'arrivée/pointage)
- `checkOutTime`: _____ h _____ (Heure de départ)
- `endDate`: _____ / _____ / _____ (Date de fin)
- `agentCreationBuffer`: _______ minutes (buffer avant check-in, généralement 120 min = 2h)

**Statut actuel affiché:**
- [ ] `scheduled` (Planifié)
- [ ] `active` (En cours)
- [ ] `completed` (Terminé)
- [ ] `cancelled` (Annulé)
- [ ] `terminated` (Clos)
- [ ] Autre: ______________

**Statut attendu:** ______________

**Date/Heure actuelle lors du test:** _____ / _____ / _____ à _____ h _____

---

## 📊 LOGIQUE ACTUELLE DES STATUTS

### Fonction `computeEventStatus(event)`

Voici comment le statut est calculé **actuellement**:

```javascript
// 1. Si événement annulé/terminé manuellement → garder ce statut
if (status === 'cancelled' || status === 'terminated') {
  return status; // Ne jamais changer
}

// 2. Calculer fenêtre temporelle
eventStart = checkInTime - agentCreationBuffer (généralement -2h)
eventEnd = checkOutTime

// 3. Calculer statut selon l'heure actuelle
if (now > eventEnd) {
  return 'completed'; // Événement terminé
}

if (now >= eventStart && now <= eventEnd) {
  return 'active'; // ⚠️ En cours (dès 2h avant checkInTime!)
}

if (now < eventStart) {
  return 'scheduled'; // Futur
}
```

### ⚠️ PROBLÈME POTENTIEL IDENTIFIÉ

**Exemple concret:**

Un événement configuré comme suit:
```
startDate: 10 février 2026
checkInTime: 08:00
checkOutTime: 18:00
agentCreationBuffer: 120 min (2h)
```

**Statuts calculés:**
```
9 février à 20:00  →  scheduled ✅ (Planifié - correct)
10 février à 05:00  →  scheduled ✅ (Planifié - correct)
10 février à 06:00  →  active ⚠️ (En cours - mais événement pas encore commencé!)
10 février à 08:00  →  active ✅ (En cours - événement vraiment commencé)
10 février à 18:00  →  active ✅ (En cours - jusqu'à la fin)
10 février à 18:01  →  completed ✅ (Terminé)
10 février à 20:01  →  Caché (shouldDisplayEvent = false)
```

**Le problème:** Entre **06:00 et 08:00** (fenêtre de check-in), le statut est **"active"** (En cours) alors que l'événement n'a **pas encore vraiment commencé**.

---

## 💡 SOLUTIONS POSSIBLES

### Option 1: Garder la logique actuelle

**Justification:** Le statut "active" signifie "fenêtre de pointage ouverte", pas "événement en cours physiquement".

**Avantage:** Les agents comprennent qu'ils peuvent pointer.

**Inconvénient:** Trompeur pour les admins/superviseurs.

---

### Option 2: Statut plus précis basé sur startDate réel

**Nouvelle logique:**

```javascript
eventCheckInStart = checkInTime - agentCreationBuffer // -2h
eventRealStart = startDate + checkInTime // Début réel
eventEnd = endDate + checkOutTime // Fin

if (now > eventEnd) {
  return 'completed'; // Terminé
}

if (now >= eventCheckInStart && now < eventRealStart) {
  return 'pending'; // ✨ Nouveau: Fenêtre check-in ouverte
}

if (now >= eventRealStart && now <= eventEnd) {
  return 'active'; // En cours (vraiment)
}

if (now < eventCheckInStart) {
  return 'scheduled'; // Futur
}
```

**Avec cette logique:**
```
10 fév à 05:00  →  scheduled (Planifié)
10 fév à 06:00  →  pending ✨ (Check-in ouvert)
10 fév à 08:00  →  active (En cours)
10 fév à 18:00  →  completed (Terminé)
```

**Avantage:** Statut plus précis et moins trompeur.

**Inconvénient:** Nécessite ajuster l'UI pour afficher "pending" correctement + Badge couleur.

---

### Option 3: Statut basé uniquement sur startDate/endDate (ignorant checkInTime)

**Nouvelle logique:**

```javascript
eventStart = startDate (date complète)
eventEnd = endDate (date complète)

if (now > eventEnd) {
  return 'completed';
}

if (now >= eventStart && now <= eventEnd) {
  return 'active';
}

if (now < eventStart) {
  return 'scheduled';
}
```

**Avec cette logique:**
```
9 fév à 20:00  →  scheduled
10 fév à 00:00  →  active (dès minuit si startDate = 10 fév)
10 fév à 08:00  →  active
10 fév à 18:00  →  active
11 fév à 00:00  →  completed (si endDate = 10 fév)
```

**Avantage:** Très simple, basé sur les vraies dates.

**Inconvénient:** Ignore complètement checkInTime/checkOutTime, peut ne pas correspondre à la logique métier.

---

## 🎯 QUELLE OPTION CHOISIR?

**Cochez celle que vous préférez:**

- [ ] **Option 1:** Garder la logique actuelle (active = fenêtre check-in ouverte)
- [ ] **Option 2:** Ajouter statut "pending" pour fenêtre check-in (plus précis)
- [ ] **Option 3:** Basé uniquement sur startDate/endDate (simple)
- [ ] **Autre:** Décrivez votre logique souhaitée ci-dessous:

```
Votre logique:



```

---

## 📋 EXEMPLE RÉEL À ANALYSER

**Fournissez un exemple concret d'événement qui a le problème:**

```json
{
  "id": "______________________________________",
  "name": "_____________________________________",
  "startDate": "____-__-__",
  "endDate": "____-__-__",
  "checkInTime": "__:__",
  "checkOutTime": "__:__",
  "agentCreationBuffer": _____ (minutes),
  "status": "__________"
}
```

**Date/heure lors du test:** ____-__-__ à __:__

**Statut affiché:** __________

**Statut attendu:** __________

---

## 🚀 PROCHAINES ÉTAPES

1. ✅ **Remplissez ce formulaire** avec les informations demandées
2. ⏳ Je corrigerai la logique selon votre choix
3. ✅ Je committerai et pousserai la correction
4. ⏰ Render redéploiera (5 min)
5. ✅ Vous testerez et confirmerez

---

**Rempli par:** _____________________
**Date:** ____ / ____ / ______
