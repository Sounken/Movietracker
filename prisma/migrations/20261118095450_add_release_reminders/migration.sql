-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "detail" TEXT,
ADD COLUMN     "media" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "tmdbId" INTEGER,
ALTER COLUMN "actorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ReleaseReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "ReleaseReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReleaseReminder_notifiedAt_idx" ON "ReleaseReminder"("notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseReminder_userId_tmdbId_key" ON "ReleaseReminder"("userId", "tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- AddForeignKey
ALTER TABLE "ReleaseReminder" ADD CONSTRAINT "ReleaseReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

