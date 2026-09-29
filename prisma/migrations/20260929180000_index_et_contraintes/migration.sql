-- #33 : index des requêtes par propriétaire et des clés étrangères (aucun n'existait).
-- #32 : unicité du rappel URSSAF par période et des échéances de dépenses récurrentes
--       (vérifié le 29/09/2026 : aucun doublon en production). Migration purement additive.
-- CreateIndex
CREATE INDEX "CalendarEvent_userId_startDate_idx" ON "CalendarEvent"("userId", "startDate");
-- CreateIndex
CREATE INDEX "Client_userId_idx" ON "Client"("userId");
-- CreateIndex
CREATE INDEX "ClientFile_clientId_idx" ON "ClientFile"("clientId");
-- CreateIndex
CREATE INDEX "ConditionsTemplate_userId_idx" ON "ConditionsTemplate"("userId");
-- CreateIndex
CREATE INDEX "EmailLog_userId_idx" ON "EmailLog"("userId");
-- CreateIndex
CREATE INDEX "EmailLog_invoiceId_idx" ON "EmailLog"("invoiceId");
-- CreateIndex
CREATE UNIQUE INDEX "Expense_recurringExpenseId_date_key" ON "Expense"("recurringExpenseId", "date");
-- CreateIndex
CREATE INDEX "Interaction_clientId_idx" ON "Interaction"("clientId");
-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");
-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");
-- CreateIndex
CREATE INDEX "MonitoringCheck_postDevId_idx" ON "MonitoringCheck"("postDevId");
-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
-- CreateIndex
CREATE INDEX "Product_userId_idx" ON "Product"("userId");
-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
-- CreateIndex
CREATE INDEX "ProjectIdea_userId_idx" ON "ProjectIdea"("userId");
-- CreateIndex
CREATE INDEX "QuoteLine_quoteId_idx" ON "QuoteLine"("quoteId");
-- CreateIndex
CREATE INDEX "RecurringInvoice_userId_idx" ON "RecurringInvoice"("userId");
-- CreateIndex
CREATE INDEX "Reminder_clientId_idx" ON "Reminder"("clientId");
-- CreateIndex
CREATE INDEX "Renewal_postDevId_idx" ON "Renewal"("postDevId");
-- CreateIndex
CREATE UNIQUE INDEX "Task_userId_urssafPeriod_key" ON "Task"("userId", "urssafPeriod");
-- CreateIndex
CREATE INDEX "TimeEntry_userId_idx" ON "TimeEntry"("userId");
-- CreateIndex
CREATE INDEX "TimeEntry_taskId_idx" ON "TimeEntry"("taskId");
