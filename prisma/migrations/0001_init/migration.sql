-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
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
CREATE TABLE "excel_files" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "rowCount" INTEGER DEFAULT 0,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalStructure" JSONB,

    CONSTRAINT "excel_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excel_rows" (
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
CREATE TABLE "aggregated_items" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "fileId" TEXT,
    "sourceFiles" TEXT,
    "count" INTEGER DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aggregated_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "excel_files_uploadDate_idx" ON "excel_files"("uploadDate");

-- CreateIndex
CREATE INDEX "excel_rows_itemId_name_unit_idx" ON "excel_rows"("itemId", "name", "unit");

-- CreateIndex
CREATE INDEX "excel_rows_fileId_idx" ON "excel_rows"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "aggregated_items_itemId_name_unit_key" ON "aggregated_items"("itemId", "name", "unit");

-- CreateIndex
CREATE INDEX "aggregated_items_itemId_name_unit_idx" ON "aggregated_items"("itemId", "name", "unit");

-- CreateIndex
CREATE INDEX "aggregated_items_fileId_idx" ON "aggregated_items"("fileId");

-- AddForeignKey
ALTER TABLE "excel_rows" ADD CONSTRAINT "excel_rows_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "excel_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aggregated_items" ADD CONSTRAINT "aggregated_items_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "excel_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;