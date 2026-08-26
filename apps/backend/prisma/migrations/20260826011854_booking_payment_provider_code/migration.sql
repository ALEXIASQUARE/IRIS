-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `paymentProviderCode` VARCHAR(191) NOT NULL DEFAULT 'mtn_momo';
