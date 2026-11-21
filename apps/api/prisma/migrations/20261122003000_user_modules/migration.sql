-- AlterTable
ALTER TABLE "User" ADD COLUMN "modules" TEXT[] NOT NULL DEFAULT ARRAY['transactions', 'investments', 'budgets', 'goals', 'recurring', 'reports']::TEXT[];
