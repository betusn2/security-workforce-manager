# 🧪 TEST AGENT CIN: BK517312

## 📅 Date du test: 9 février 2026

---

## 🎯 OBJECTIF DU TEST

Vérifier que l'agent avec CIN **BK517312** est **BLOQUÉ** si tous ses événements ont le statut **'scheduled'** (avant la fenêtre de check-in de 2h).

---

## 📋 INFORMATIONS AGENT

**CIN:** BK517312
**Nom:** _____________
**Événements assignés:** _____________

---

## 🔍 DIAGNOSTIC ÉTAPE PAR ÉTAPE

### Étape 1: Connexion Login
1. Ouvrir: https://security-guard-web.onrender.com/login
2. Cliquer "Agent / Superviseur"
3. Entrer CIN: **BK517312**
4. Cliquer "Accéder au Pointage"

**Observer dans la console (F12):**
```javascript
// Après login
✅ CheckIn login successful
✅ Assignments loaded: X assignment(s)
🔍 Fetching events for eventIds: [...]

// Pour CHAQUE événement
📅 Event loaded: { id: "...", name: "...", status: "..." }

// Calcul du statut
🧮 computeEventStatus() called for event: "..."
   - now: 2026-02-09T__:__
   - eventStart (checkInTime - 2h): 2026-02-__T__:__
   - eventEnd (checkOutTime): 2026-02-__T__:__
   - Result: 'scheduled' ou 'active'?

// Vérification accès
🔐 hasActiveOrUpcomingEvents() check:
   - Total events: X
   - Events with status 'active': Y
   - Result: true/false
```

### Étape 2: Résultat attendu selon statut

#### Cas A: Si événement(s) = 'scheduled' ❌
```
Toast: "Tous vos événements sont terminés. Accès au pointage refusé."
Redirect: /no-active-events
Page affichée: "Aucun événement actif"
```

#### Cas B: Si événement(s) = 'active' ✅
```
Toast: "Connexion réussie! Redirection vers le pointage..."
Redirect: /checkin
Page affichée: CheckIn avec liste événements
```

---

## 📊 RÉSULTATS OBSERVÉS

### Test effectué le: ____ / ____ / ____ à ____ h ____

**Événements chargés:**
```json
[
  {
    "id": "________________",
    "name": "________________",
    "startDate": "____-__-__",
    "checkInTime": "__:__",
    "checkOutTime": "__:__",
    "agentCreationBuffer": ___,
    "status_db": "________",
    "status_computed": "________"
  }
]
```

**Logs console:**
```
[Copier-coller les logs console ici]
```

**Comportement observé:**
- [ ] ✅ Bloqué sur /no-active-events (CORRECT si événement = 'scheduled')
- [ ] ❌ Accès autorisé /checkin (BUG si événement = 'scheduled')
- [ ] 🤔 Autre: ________________

---

## 🐛 SI BUG DÉTECTÉ

### Problème: Agent accède alors que statut = 'scheduled'

**Causes possibles:**

#### 1. computeEventStatus() calcule mal le statut
```javascript
// Vérifier dans console:
const event = { /* données événement */ };
const now = new Date();
console.log('Now:', now.toISOString());

// Calcul eventStart (2h avant checkInTime)
const eventStart = new Date(event.startDate);
const [hours, minutes] = event.checkInTime.split(':');
eventStart.setHours(hours - 2, minutes, 0, 0);
console.log('Event start (2h before):', eventStart.toISOString());

// Comparaison
console.log('now >= eventStart?', now >= eventStart);
console.log('Expected status:', now >= eventStart ? 'active' : 'scheduled');
```

#### 2. hasActiveOrUpcomingEvents() filtre mal
```javascript
// Dans Login.jsx ligne 74, ajouter console.log:
console.log('🔍 Events before filter:', events.map(e => ({
  name: e.name,
  status: computeEventStatus(e)
})));

const hasValidEvents = hasActiveOrUpcomingEvents(events);
console.log('✅ hasValidEvents:', hasValidEvents);
```

#### 3. Timing: agent se connecte exactement pile à 2h avant
```
Événement checkInTime = 10:00
Agent se connecte à 08:00:00.000

→ now === eventStart
→ Condition: now >= eventStart → TRUE
→ Statut = 'active' (limite inclusive)

Solution: Acceptable ou besoin de > strict?
```

---

## 🔧 SOLUTIONS SI BUG

### Option 1: Strictement après 2h (exclusif)
```javascript
// eventHelpers.js ligne 70
if (now > eventStart && now <= eventEnd) { // > au lieu de >=
  return 'active';
}
```

### Option 2: Buffer additionnel (ex: 2h - 1 minute)
```javascript
// eventHelpers.js ligne 32-37
export const getCheckInStartTime = (startDate, checkInTime, agentCreationBuffer = 120) => {
  const checkInDateTime = combineDateAndTime(startDate, checkInTime || '00:00');

  const bufferMinutes = (agentCreationBuffer || 120) - 1; // -1 minute de sécurité
  const bufferHours = bufferMinutes / 60;
  checkInDateTime.setHours(checkInDateTime.getHours() - bufferHours);

  return checkInDateTime;
};
```

### Option 3: Vérifier que l'événement n'est pas exactement à la limite
```javascript
// CheckIn.jsx ou Login.jsx
const isExactlyAtBoundary = (event) => {
  const now = new Date();
  const eventStart = getCheckInStartTime(event.startDate, event.checkInTime, event.agentCreationBuffer);
  const diff = Math.abs(now - eventStart);
  return diff < 60000; // Moins de 1 minute de différence
};

// Si exactement à la limite, afficher message spécial
if (isExactlyAtBoundary(event)) {
  toast.info('Fenêtre de check-in s\'ouvre dans quelques instants. Veuillez patienter.');
}
```

---

## ✅ VALIDATION FINALE

### Scénarios à tester:

| Heure actuelle | checkInTime | Buffer | eventStart | Statut attendu | Accès CheckIn |
|----------------|-------------|--------|------------|----------------|---------------|
| 06:00 | 08:00 | 120 min | 06:00 | scheduled | ❌ BLOQUÉ |
| 06:01 | 08:00 | 120 min | 06:00 | active | ✅ AUTORISÉ |
| 07:59 | 08:00 | 120 min | 06:00 | active | ✅ AUTORISÉ |
| 08:00 | 08:00 | 120 min | 06:00 | active | ✅ AUTORISÉ |
| 18:00 | 08:00 | - | - | completed | ❌ BLOQUÉ |

### Test avec BK517312:

**Événement:** ________________
**checkInTime:** __:__
**Buffer:** ___ minutes
**Heure connexion:** __:__
**eventStart calculé:** __:__
**Statut calculé:** ________
**Résultat:** ✅ / ❌

---

## 📝 NOTES ADDITIONNELLES

```
[Ajoutez vos observations ici]
```

---

**Testé par:** _________________
**Date:** ____ / ____ / ______
**Résultat:** ✅ CORRECT / ❌ BUG TROUVÉ
