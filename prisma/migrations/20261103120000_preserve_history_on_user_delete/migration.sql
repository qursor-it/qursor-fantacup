-- Cancellare un utente non deve più cancellare in cascata voti MVP, fasi congelate,
-- finestre mercato e audit log: i riferimenti vengono messi a NULL.

-- Vote
ALTER TABLE "Vote" DROP CONSTRAINT "Vote_userId_fkey";
ALTER TABLE "Vote" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RosterEditWindow
ALTER TABLE "RosterEditWindow" DROP CONSTRAINT "RosterEditWindow_createdById_fkey";
ALTER TABLE "RosterEditWindow" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "RosterEditWindow" ADD CONSTRAINT "RosterEditWindow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ScoringPhase
ALTER TABLE "ScoringPhase" DROP CONSTRAINT "ScoringPhase_createdById_fkey";
ALTER TABLE "ScoringPhase" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "ScoringPhase" ADD CONSTRAINT "ScoringPhase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AdminAuditLog
ALTER TABLE "AdminAuditLog" DROP CONSTRAINT "AdminAuditLog_adminUserId_fkey";
ALTER TABLE "AdminAuditLog" ALTER COLUMN "adminUserId" DROP NOT NULL;
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
