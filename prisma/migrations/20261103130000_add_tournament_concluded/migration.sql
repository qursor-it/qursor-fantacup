-- Flag "torneo concluso": se true, i non-admin vengono rimandati a /torneo-concluso.
ALTER TABLE "AppSetting" ADD COLUMN "tournamentConcluded" BOOLEAN NOT NULL DEFAULT false;
