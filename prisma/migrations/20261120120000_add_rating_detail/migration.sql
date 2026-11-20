-- CreateTable
CREATE TABLE "RatingDetail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "media" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "state" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RatingDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RatingDetail_userId_media_tmdbId_key" ON "RatingDetail"("userId", "media", "tmdbId");

-- AddForeignKey
ALTER TABLE "RatingDetail" ADD CONSTRAINT "RatingDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
