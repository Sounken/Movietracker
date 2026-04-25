-- AlterTable
ALTER TABLE "UserFilm" ADD COLUMN     "runtime" INTEGER,
ADD COLUMN     "watched" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "watchedAt" TIMESTAMP(3);
