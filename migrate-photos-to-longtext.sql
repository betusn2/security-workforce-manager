-- Migration: Augmenter la taille des colonnes de photos/vecteurs faciaux
-- Raison: Les photos base64 haute résolution dépassent la limite de TEXT (64KB)
-- Solution: Migrer vers LONGTEXT (4GB max)

-- Modifier la colonne profile_photo
ALTER TABLE `users` 
MODIFY COLUMN `profile_photo` LONGTEXT NULL 
COMMENT 'Photo de profil base64 - LONGTEXT pour images haute résolution';

-- Modifier la colonne facial_vector  
ALTER TABLE `users`
MODIFY COLUMN `facial_vector` LONGTEXT NULL
COMMENT 'Encrypted facial recognition vector - LONGTEXT';

-- Modifier la colonne facial_descriptor
ALTER TABLE `users`
MODIFY COLUMN `facial_descriptor` LONGTEXT NULL
COMMENT 'Facial descriptor JSON array for face-api.js recognition - LONGTEXT';

-- Vérifier les modifications
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'users' 
AND COLUMN_NAME IN ('profile_photo', 'facial_vector', 'facial_descriptor');
