-- Note par saison, indépendante de la note globale de la série.
CREATE TABLE "UserSeason" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" INTEGER NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSeason_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserSeason_userId_seriesId_seasonNumber_key"
    ON "UserSeason"("userId", "seriesId", "seasonNumber");

CREATE INDEX "UserSeason_userId_seriesId_idx"
    ON "UserSeason"("userId", "seriesId");

ALTER TABLE "UserSeason" ADD CONSTRAINT "UserSeason_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
