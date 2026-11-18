-- AlterTable
ALTER TABLE "User" ADD COLUMN     "watchProviders" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
