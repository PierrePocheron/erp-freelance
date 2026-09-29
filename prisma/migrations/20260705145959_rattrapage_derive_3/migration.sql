-- Rattrapage de dérive (#9) : objets créés en production par `prisma db push`, jamais décrits
-- dans une migration. Sans eux, une base reconstruite depuis les migrations échouait à la
-- migration suivante. IDEMPOTENT (IF NOT EXISTS / exceptions ignorées) : sans effet sur la
-- production, où tout existe déjà. Généré depuis le schéma, colonnes/index/valeurs d'enum
-- ajoutés par les migrations suivantes exclus.

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "userId" TEXT;
