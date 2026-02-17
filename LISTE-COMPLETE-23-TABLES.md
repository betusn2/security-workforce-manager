# 📊 LISTE COMPLÈTE DES 23 TABLES - Security Workforce Manager

## ✅ VÉRIFICATION: TOUTES LES TABLES INCLUSES

---

## 🎯 CATÉGORIE 1: TABLES PRINCIPALES (3)

### 1. **users** - Utilisateurs
- **Description:** Gestion complète des utilisateurs (admin, superviseur, agent)
- **Colonnes clés:**
  - `id`, `cin`, `name`, `email`, `password`
  - `role`: admin/supervisor/agent
  - `status`: active/inactive/suspended
  - `facial_descriptor`: Reconnaissance faciale
  - `points`, `level`: Gamification
  - `latitude`, `longitude`: Position GPS
  - `refresh_token`, `last_login`
- **Relations:** Clé primaire pour: events, assignments, attendance, tracking

### 2. **events** - Événements
- **Description:** Événements et missions à superviser
- **Colonnes clés:**
  - `id`, `name`, `description`, `type`
  - `location`, `latitude`, `longitude`, `geo_radius`
  - `start_date`, `end_date`
  - `check_in_time`, `check_out_time`, `late_threshold`
  - `status`: draft/scheduled/active/completed/cancelled
  - `required_agents`, `supervisor_id`
  - `recurrence_type`, `recurrence`
- **Relations:** Parent de: zones, assignments, attendance

### 3. **zones** - Zones géographiques
- **Description:** Zones spécifiques à l'intérieur d'événements
- **Colonnes clés:**
  - `id`, `event_id`, `name`, `description`
  - `color`, `capacity`, `required_agents`
  - `geo_fence`: Périmètre JSON
  - `latitude`, `longitude`, `radius`
  - `priority`: low/normal/high/critical
  - `supervisors`: Array JSON
- **Relations:** Liée à: events, assignments

---

## 🎯 CATÉGORIE 2: AFFECTATIONS ET POINTAGES (2)

### 4. **assignments** - Affectations agents/zones
- **Description:** Attribution d'agents aux événements et zones
- **Colonnes clés:**
  - `id`, `agent_id`, `event_id`, `zone_id`
  - `assigned_by`, `role`: primary/backup/supervisor
  - `status`: pending/confirmed/declined/cancelled
  - `confirmed_at`, `notification_sent`
- **Relations:** Joint: users, events, zones

### 5. **attendance** - Pointages check-in/check-out
- **Description:** Système de pointage avec reconnaissance faciale et GPS
- **Colonnes clés:**
  - `id`, `agent_id`, `event_id`, `assignment_id`
  - `check_in_time`, `check_out_time`
  - `check_in_latitude/longitude`, `check_out_latitude/longitude`
  - `check_in_photo`, `check_out_photo`
  - `check_in_method`: facial/manual/qrcode/nfc
  - `facial_match_score`: Précision reconnaissance
  - `status`: present/late/absent/excused
  - `is_within_geofence`, `distance_from_location`
  - `total_hours`, `overtime_hours`
- **Relations:** Joint: users, events, assignments

---

## 🎯 CATÉGORIE 3: TRACKING GPS TEMPS RÉEL (4)

### 6. **geo_tracking** - Tracking GPS enrichi
- **Description:** Suivi GPS en temps réel avec métadonnées complètes
- **Colonnes clés:**
  - `id`, `agent_id`, `event_id`, `zone_id`
  - `latitude`, `longitude`, `accuracy`
  - `altitude`, `speed`, `heading`
  - `battery_level`, `is_moving`, `activity_type`
  - `device_id`, `network_type`, `provider`
  - `is_mock_location`: Détection de falsification
  - `address`, `city`, `country`: Géocodage
  - `timestamp`, `status`
- **Relations:** Parent de: tracking_alerts

### 7. **gps_tracking** - Tracking GPS simple (legacy)
- **Description:** Version simplifiée du tracking GPS
- **Colonnes clés:**
  - `id`, `agent_id`, `event_id`
  - `latitude`, `longitude`, `accuracy`
  - `speed`, `heading`, `altitude`
  - `battery_level`, `is_moving`
  - `timestamp`
- **Relations:** Joint: users, events

### 8. **tracking_alerts** - Alertes de tracking
- **Description:** Alertes automatiques basées sur tracking GPS
- **Colonnes clés:**
  - `id`, `tracking_id`, `agent_id`, `event_id`
  - `alert_type`: zone_entry/zone_exit/geofence_violation/speed_alert/low_battery/signal_lost/mock_location
  - `severity`: info/warning/critical
  - `title`, `message`, `metadata`
  - `acknowledged`, `acknowledged_by`, `acknowledged_at`
  - `resolved`, `resolved_by`, `resolution_notes`
- **Relations:** Enfant de: geo_tracking

### 9. **sos_alerts** - Alertes SOS d'urgence
- **Description:** Système d'alerte SOS pour situations d'urgence
- **Colonnes clés:**
  - `id`, `user_id`, `event_id`
  - `alert_type`: sos/medical/security/fire/other
  - `status`: active/acknowledged/responding/resolved/false_alarm
  - `latitude`, `longitude`, `accuracy`
  - `photo`, `voice_note_url`, `description`
  - `acknowledged_by`, `responder_id`
  - `response_time`, `resolution_time`
- **Relations:** Joint: users, events

---

## 🎯 CATÉGORIE 4: COMMUNICATION (3)

### 10. **notifications** - Notifications multi-canal
- **Description:** Système de notifications email/SMS/push/WhatsApp
- **Colonnes clés:**
  - `id`, `user_id`
  - `type`: assignment/reminder/attendance/late_alert/schedule_change
  - `title`, `message`
  - `channel`: email/sms/whatsapp/push/in_app
  - `status`: pending/sent/delivered/failed/read
  - `sent_at`, `delivered_at`, `read_at`
  - `retry_count`, `max_retries`
  - `priority`: low/normal/high/urgent
  - `scheduled_for`
- **Relations:** Joint: users

### 11. **conversations** - Conversations/Threads
- **Description:** Discussions de groupe ou directs
- **Colonnes clés:**
  - `id`, `title`
  - `type`: direct/group/event/support
  - `event_id`, `participants`: Array JSON
  - `last_message_at`, `created_by`
  - `is_active`
- **Relations:** Parent de: messages

### 12. **messages** - Messages dans conversations
- **Description:** Messages texte, images, voix, vidéo
- **Colonnes clés:**
  - `id`, `conversation_id`, `sender_id`
  - `content`, `type`: text/image/voice/video/file/location
  - `attachments`: Array JSON
  - `read_by`, `delivered_to`: Arrays JSON
  - `is_edited`, `edited_at`
  - `is_deleted`, `reply_to_id`
- **Relations:** Enfant de: conversations

---

## 🎯 CATÉGORIE 5: SÉCURITÉ ET AUDIT (4)

### 13. **fraud_attempts** - Tentatives de fraude
- **Description:** Détection et audit de tentatives de fraude
- **Colonnes clés:**
  - `id`, `agent_id`, `event_id`
  - `attempt_type`: wrong_person/fake_photo/location_spoof/time_manipulation/duplicate_checkin
  - `severity`: low/medium/high/critical
  - `description`, `evidence`: JSON
  - `photo_url`, `facial_match_score`
  - `expected_location`, `actual_location`, `distance_discrepancy`
  - `detected_by`: system/supervisor/admin
  - `status`: pending/investigating/confirmed/false_positive
  - `investigated_by`, `resolution`, `action_taken`
- **Relations:** Joint: users, events

### 14. **liveness_logs** - Vérification de présence
- **Description:** Logs de tests de vie (anti-spoofing)
- **Colonnes clés:**
  - `id`, `user_id`, `event_id`
  - `test_type`: blink/smile/head_turn/passive
  - `result`: passed/failed/inconclusive
  - `confidence_score`, `image_url`
  - `metadata`: JSON
- **Relations:** Joint: users, events

### 15. **activity_logs** - Logs d'audit système
- **Description:** Traçabilité complète des actions utilisateur
- **Colonnes clés:**
  - `id`, `user_id`
  - `action`, `entity_type`, `entity_id`
  - `description`
  - `old_values`, `new_values`: JSON diff
  - `ip_address`, `user_agent`, `device_info`
  - `location`: JSON
  - `status`: success/failure/warning
  - `error_message`, `metadata`
- **Relations:** Joint: users

### 16. **incidents** - Incidents signalés
- **Description:** Rapports d'incidents sur le terrain
- **Colonnes clés:**
  - `id`, `event_id`, `zone_id`
  - `reported_by`, `incident_type`: theft/violence/damage/medical/safety
  - `severity`: low/medium/high/critical
  - `title`, `description`
  - `latitude`, `longitude`
  - `photos`, `witnesses`: Arrays JSON
  - `status`: reported/investigating/resolved/closed
  - `assigned_to`, `resolution`
- **Relations:** Joint: events, zones, users

---

## 🎯 CATÉGORIE 6: GAMIFICATION (3)

### 17. **badges** - Badges de récompense
- **Description:** Système de badges pour gamification
- **Colonnes clés:**
  - `id`, `name`, `description`
  - `icon`, `color`
  - `category`: performance/attendance/experience/special/training
  - `criteria`: JSON rules
  - `points`, `is_active`
- **Relations:** Parent de: user_badges

### 18. **user_badges** - Badges obtenus
- **Description:** Association users ↔ badges
- **Colonnes clés:**
  - `id`, `user_id`, `badge_id`
  - `earned_at`, `awarded_by`
  - `reason`
- **Relations:** Junction: users, badges

### 19. **permissions** - Permissions système
- **Description:** Définition des permissions disponibles
- **Colonnes clés:**
  - `id`, `name`, `description`
  - `module`: users/events/attendance/tracking/reports
  - `is_active`
- **Relations:** Parent de: role_permissions, user_permissions

---

## 🎯 CATÉGORIE 7: SYSTÈME DE PERMISSIONS (2)

### 20. **role_permissions** - Permissions par rôle
- **Description:** Permissions attribuées aux rôles (admin/supervisor/agent)
- **Colonnes clés:**
  - `id`
  - `role`: admin/supervisor/agent
  - `permission_id`
- **Relations:** Joint: permissions

### 21. **user_permissions** - Permissions spécifiques utilisateurs
- **Description:** Permissions additionnelles par utilisateur
- **Colonnes clés:**
  - `id`, `user_id`, `permission_id`
  - `granted_by`, `granted_at`
- **Relations:** Joint: users, permissions

---

## 🎯 CATÉGORIE 8: DOCUMENTS ET BACKUPS (2)

### 22. **user_documents** - Documents utilisateurs
- **Description:** Gestion des documents (CIN, contrat, certificats)
- **Colonnes clés:**
  - `id`, `user_id`
  - `document_type`: id_card/passport/contract/certificate/training/medical
  - `title`, `file_url`, `file_name`
  - `file_size`, `file_type`
  - `issue_date`, `expiry_date`
  - `is_verified`, `verified_by`, `verified_at`
- **Relations:** Joint: users

### 23. **scheduled_backups** - Backups planifiés
- **Description:** Système de backup automatique
- **Colonnes clés:**
  - `id`
  - `backup_type`: full/incremental/differential
  - `status`: pending/running/completed/failed
  - `file_path`, `file_size`
  - `start_time`, `end_time`, `duration`
  - `error_message`, `metadata`
  - `created_by`
- **Relations:** Standalone

---

## 📊 RÉSUMÉ STATISTIQUE

### Par catégorie:
- **Core:** 3 tables (users, events, zones)
- **Affectations:** 2 tables (assignments, attendance)
- **Tracking GPS:** 4 tables (geo_tracking, gps_tracking, tracking_alerts, sos_alerts)
- **Communication:** 3 tables (notifications, conversations, messages)
- **Sécurité:** 4 tables (fraud_attempts, liveness_logs, activity_logs, incidents)
- **Gamification:** 3 tables (badges, user_badges, permissions)
- **Permissions:** 2 tables (role_permissions, user_permissions)
- **Documents:** 2 tables (user_documents, scheduled_backups)

### Total: **23 TABLES**

### Fonctionnalités couvertes:
✅ Gestion utilisateurs complète
✅ Événements et zones géographiques
✅ Affectations dynamiques
✅ Pointage biométrique (facial + GPS)
✅ Tracking GPS temps réel
✅ Alertes automatiques et SOS
✅ Notifications multi-canal
✅ Messagerie intégrée
✅ Détection de fraude
✅ Audit complet
✅ Gestion d'incidents
✅ Système de gamification
✅ Permissions granulaires
✅ Gestion documentaire
✅ Backups automatisés

---

## ✅ VÉRIFICATION SQL

```sql
-- Compter les tables
SELECT COUNT(*) AS total 
FROM information_schema.tables 
WHERE table_schema = 'railway';
-- Attendu: 23

-- Lister toutes les tables
SHOW TABLES;

-- Statistiques complètes
SELECT 
  table_name, 
  table_rows,
  ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
FROM information_schema.tables
WHERE table_schema = 'railway'
ORDER BY table_name;
```

---

## 🎉 CONFIRMATION

**Toutes les 23 tables de votre projet Security Workforce Manager sont incluses dans:**
- ✅ `RAILWAY-ALL-TABLES.sql`
- ✅ Rien n'a été oublié
- ✅ Relations et contraintes complètes
- ✅ Indexes optimisés
- ✅ Données par défaut (admin, permissions, badges)

**Prêt pour production!** 🚀
