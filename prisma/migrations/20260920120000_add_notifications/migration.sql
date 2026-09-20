-- Notifications reçues par un utilisateur.
--
-- Premier usage : prévenir quand quelqu'un s'abonne. La cloche de la barre
-- supérieure existait déjà, mais n'était qu'un pictogramme sans données
-- derrière.

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Liste du destinataire, la plus récente d'abord.
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- Se désabonner puis se réabonner réutilise la ligne au lieu d'en empiler une
-- nouvelle à chaque fois.
CREATE UNIQUE INDEX "Notification_userId_actorId_type_key" ON "Notification"("userId", "actorId", "type");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
