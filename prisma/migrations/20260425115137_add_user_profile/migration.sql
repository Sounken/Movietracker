-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "bio" TEXT;

-- CreateTable
CREATE TABLE "UserFavoriteFilm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "UserFavoriteFilm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserFavoriteFilm_userId_position_key" ON "UserFavoriteFilm"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "UserFavoriteFilm_userId_tmdbId_key" ON "UserFavoriteFilm"("userId", "tmdbId");

-- AddForeignKey
ALTER TABLE "UserFavoriteFilm" ADD CONSTRAINT "UserFavoriteFilm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
