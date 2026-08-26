-- AlterTable
ALTER TABLE `partner_profiles` ADD COLUMN `currentLat` DOUBLE NULL,
    ADD COLUMN `currentLng` DOUBLE NULL,
    ADD COLUMN `locationUpdatedAt` DATETIME(3) NULL;
