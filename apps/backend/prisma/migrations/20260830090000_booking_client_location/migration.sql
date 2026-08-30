-- AlterTable
ALTER TABLE `bookings`
  ADD COLUMN `clientLat` DOUBLE NULL,
  ADD COLUMN `clientLng` DOUBLE NULL,
  ADD COLUMN `clientLocationUpdatedAt` DATETIME(3) NULL;
