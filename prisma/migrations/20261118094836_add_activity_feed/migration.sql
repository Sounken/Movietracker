-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "activityId" TEXT,
ADD COLUMN     "emoji" TEXT;

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "media" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "review" TEXT,
    "filmWatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityReaction" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Activity_filmWatchId_key" ON "Activity"("filmWatchId");

-- CreateIndex
CREATE INDEX "Activity_userId_media_createdAt_idx" ON "Activity"("userId", "media", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_userId_media_tmdbId_idx" ON "Activity"("userId", "media", "tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityReaction_activityId_userId_emoji_key" ON "ActivityReaction"("activityId", "userId", "emoji");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_filmWatchId_fkey" FOREIGN KEY ("filmWatchId") REFERENCES "FilmWatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReaction" ADD CONSTRAINT "ActivityReaction_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReaction" ADD CONSTRAINT "ActivityReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise : les notes des 60 derniers jours amorcent le fil, qui serait vide
-- au lancement. La date est celle de la dernière modification, faute de mieux.
INSERT INTO "Activity" ("id", "userId", "media", "tmdbId", "kind", "rating", "review", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "userId", 'movie', "tmdbId", 'rated', "rating", NULLIF("review", ''), "updatedAt", "updatedAt"
FROM "UserFilm"
WHERE "rating" IS NOT NULL AND "updatedAt" >= NOW() - INTERVAL '60 days';

INSERT INTO "Activity" ("id", "userId", "media", "tmdbId", "kind", "rating", "review", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "userId", 'tv', "tmdbId", 'rated', "rating", NULLIF("review", ''), "updatedAt", "updatedAt"
FROM "UserSeries"
WHERE "rating" IS NOT NULL AND "updatedAt" >= NOW() - INTERVAL '60 days';
