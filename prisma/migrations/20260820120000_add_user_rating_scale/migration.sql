-- Échelle d'affichage des notes choisie par l'utilisateur (10 ou 100).
-- Les notes elles-mêmes restent stockées sur 10 : rien à migrer côté données.
ALTER TABLE "User" ADD COLUMN "ratingScale" INTEGER NOT NULL DEFAULT 10;
