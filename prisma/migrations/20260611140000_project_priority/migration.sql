-- Add priority field to Project (reuses existing TaskPriority enum)
ALTER TABLE "Project" ADD COLUMN "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM';
