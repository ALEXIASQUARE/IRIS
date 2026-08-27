-- AlterTable
ALTER TABLE `users` ADD COLUMN `homeZoneId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_homeZoneId_fkey` FOREIGN KEY (`homeZoneId`) REFERENCES `zones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
