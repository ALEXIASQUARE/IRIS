-- AlterTable
ALTER TABLE `service_options` ADD COLUMN `pricingUnit` ENUM('FLAT', 'HOURLY') NOT NULL DEFAULT 'FLAT';
