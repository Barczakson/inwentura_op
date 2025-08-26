-- AlterTable
ALTER TABLE "excel_files" ADD COLUMN "columnMapping" JSONB;
ALTER TABLE "excel_files" ADD COLUMN "detectedHeaders" JSONB;

-- AlterTable  
ALTER TABLE "aggregated_items" ALTER COLUMN "sourceFiles" TYPE JSONB USING "sourceFiles"::JSONB;

-- CreateTable
CREATE TABLE "column_mappings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "mapping" JSONB NOT NULL,
    "headers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP(3),

    CONSTRAINT "column_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "excel_rows_name_idx" ON "excel_rows"("name");
CREATE INDEX "excel_rows_createdAt_idx" ON "excel_rows"("createdAt");
CREATE INDEX "excel_rows_fileId_originalRowIndex_idx" ON "excel_rows"("fileId", "originalRowIndex");

-- CreateIndex
CREATE INDEX "aggregated_items_name_idx" ON "aggregated_items"("name");
CREATE INDEX "aggregated_items_quantity_idx" ON "aggregated_items"("quantity");
CREATE INDEX "aggregated_items_updatedAt_idx" ON "aggregated_items"("updatedAt");
CREATE INDEX "aggregated_items_count_idx" ON "aggregated_items"("count");

-- CreateIndex
CREATE INDEX "column_mappings_isDefault_idx" ON "column_mappings"("isDefault");
CREATE INDEX "column_mappings_usageCount_idx" ON "column_mappings"("usageCount");
CREATE INDEX "column_mappings_lastUsed_idx" ON "column_mappings"("lastUsed");