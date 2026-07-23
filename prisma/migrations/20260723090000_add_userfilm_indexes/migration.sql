-- CreateIndex
CREATE INDEX "UserFilm_userId_updatedAt_idx" ON "UserFilm"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "UserFilm_userId_rating_idx" ON "UserFilm"("userId", "rating");

-- CreateIndex
CREATE INDEX "UserFilm_userId_watchlist_idx" ON "UserFilm"("userId", "watchlist");

-- CreateIndex
CREATE INDEX "UserFilm_tmdbId_idx" ON "UserFilm"("tmdbId");

-- CreateIndex
CREATE INDEX "UserFilm_updatedAt_idx" ON "UserFilm"("updatedAt");
