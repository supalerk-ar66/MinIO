-- Drop legacy table if it exists
DROP TABLE IF EXISTS "FileObject";

-- Create new FileMeta table
CREATE TABLE "FileMeta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileMeta_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FileMeta_bucket_objectKey_key" ON "FileMeta"("bucket", "objectKey");
CREATE INDEX "FileMeta_bucket_idx" ON "FileMeta"("bucket");
