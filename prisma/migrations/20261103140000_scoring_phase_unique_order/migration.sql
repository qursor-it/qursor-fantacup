-- `order` deve essere unico: due chiusure concorrenti non possono creare due
-- fasi con lo stesso ordine, altrimenti i punti della fase vengono contati due
-- volte nella classifica cumulativa.
--
-- Eventuali duplicati preesistenti possono derivare solo da questa race
-- condition. Questa migrazione NON cancella dati: se il CREATE UNIQUE INDEX
-- fallisce, risolvere manualmente i duplicati (unendo/eliminando le fasi in
-- eccesso) e riapplicare la migrazione. Per individuarli:
--   SELECT "order", COUNT(*) FROM "ScoringPhase" GROUP BY "order" HAVING COUNT(*) > 1;

-- DropIndex
DROP INDEX "ScoringPhase_order_idx";

-- CreateIndex
CREATE UNIQUE INDEX "ScoringPhase_order_key" ON "ScoringPhase"("order");
