-- ============================================
-- SCRIPT DE NETTOYAGE COMPLET - Railway
-- À EXÉCUTER DANS MySQL Workbench AVANT RAILWAY-ALL-TABLES.sql
-- ============================================

-- Désactiver les vérifications de clés étrangères
SET FOREIGN_KEY_CHECKS = 0;

-- SUPPRIMER TOUTES LES TABLES EXISTANTES
DROP TABLE IF EXISTS `user_badges`;
DROP TABLE IF EXISTS `role_permissions`;
DROP TABLE IF EXISTS `user_permissions`;
DROP TABLE IF EXISTS `user_documents`;
DROP TABLE IF EXISTS `scheduled_backups`;
DROP TABLE IF EXISTS `messages`;
DROP TABLE IF EXISTS `conversations`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `tracking_alerts`;
DROP TABLE IF EXISTS `sos_alerts`;
DROP TABLE IF EXISTS `incidents`;
DROP TABLE IF EXISTS `liveness_logs`;
DROP TABLE IF EXISTS `fraud_attempts`;
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `gps_tracking`;
DROP TABLE IF EXISTS `geo_tracking`;
DROP TABLE IF EXISTS `attendance`;
DROP TABLE IF EXISTS `assignments`;
DROP TABLE IF EXISTS `zones`;
DROP TABLE IF EXISTS `badges`;
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `events`;
DROP TABLE IF EXISTS `users`;

-- Réactiver les vérifications
SET FOREIGN_KEY_CHECKS = 1;

-- Vérifier que toutes les tables sont supprimées
SELECT 
  CONCAT('✅ Toutes les tables supprimées. Tables restantes: ', COUNT(*)) as Status
FROM information_schema.tables 
WHERE table_schema = 'railway';

-- ============================================
-- MAINTENANT, EXÉCUTEZ LE FICHIER COMPLET:
-- File → Open SQL Script → RAILWAY-ALL-TABLES.sql
-- ============================================
