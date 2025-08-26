-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."excel_files" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "rowCount" INTEGER DEFAULT 0,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalStructure" JSONB,
    "columnMapping" JSONB,
    "detectedHeaders" JSONB,

    CONSTRAINT "excel_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."excel_rows" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "originalRowIndex" INTEGER,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excel_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."aggregated_items" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "fileId" TEXT,
    "sourceFiles" JSONB,
    "count" INTEGER DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aggregated_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."column_mappings" (
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
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "excel_files_uploadDate_idx" ON "public"."excel_files"("uploadDate");

-- CreateIndex
CREATE INDEX "excel_rows_itemId_name_unit_idx" ON "public"."excel_rows"("itemId", "name", "unit");

-- CreateIndex
CREATE INDEX "excel_rows_fileId_idx" ON "public"."excel_rows"("fileId");

-- CreateIndex
CREATE INDEX "excel_rows_name_idx" ON "public"."excel_rows"("name");

-- CreateIndex
CREATE INDEX "excel_rows_createdAt_idx" ON "public"."excel_rows"("createdAt");

-- CreateIndex
CREATE INDEX "excel_rows_fileId_originalRowIndex_idx" ON "public"."excel_rows"("fileId", "originalRowIndex");

-- CreateIndex
CREATE INDEX "aggregated_items_itemId_name_unit_idx" ON "public"."aggregated_items"("itemId", "name", "unit");

-- CreateIndex
CREATE INDEX "aggregated_items_fileId_idx" ON "public"."aggregated_items"("fileId");

-- CreateIndex
CREATE INDEX "aggregated_items_name_idx" ON "public"."aggregated_items"("name");

-- CreateIndex
CREATE INDEX "aggregated_items_quantity_idx" ON "public"."aggregated_items"("quantity");

-- CreateIndex
CREATE INDEX "aggregated_items_updatedAt_idx" ON "public"."aggregated_items"("updatedAt");

-- CreateIndex
CREATE INDEX "aggregated_items_count_idx" ON "public"."aggregated_items"("count");

-- CreateIndex
CREATE UNIQUE INDEX "aggregated_items_itemId_name_unit_key" ON "public"."aggregated_items"("itemId", "name", "unit");

-- CreateIndex
CREATE INDEX "column_mappings_isDefault_idx" ON "public"."column_mappings"("isDefault");

-- CreateIndex
CREATE INDEX "column_mappings_usageCount_idx" ON "public"."column_mappings"("usageCount");

-- CreateIndex
CREATE INDEX "column_mappings_lastUsed_idx" ON "public"."column_mappings"("lastUsed");

-- AddForeignKey
ALTER TABLE "public"."excel_rows" ADD CONSTRAINT "excel_rows_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."excel_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."aggregated_items" ADD CONSTRAINT "aggregated_items_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."excel_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
