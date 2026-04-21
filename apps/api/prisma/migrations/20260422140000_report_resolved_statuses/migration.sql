-- AlterEnum (append-only; run once per database)
ALTER TYPE "ReportStatus" ADD VALUE 'resolved_keep';
ALTER TYPE "ReportStatus" ADD VALUE 'resolved_delete';
