-- CreateTable
CREATE TABLE "UserFavoriteSeries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "UserFavoriteSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserFavoriteSeries_userId_position_key" ON "UserFavoriteSeries"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "UserFavoriteSeries_userId_tmdbId_key" ON "UserFavoriteSeries"("userId", "tmdbId");

-- AddForeignKey
ALTER TABLE "UserFavoriteSeries" ADD CONSTRAINT "UserFavoriteSeries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
