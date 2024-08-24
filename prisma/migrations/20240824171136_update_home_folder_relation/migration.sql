/*
  Warnings:

  - A unique constraint covering the columns `[homeFolderId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `size` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "File" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "size" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "homeFolderId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "User_homeFolderId_key" ON "User"("homeFolderId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_homeFolderId_fkey" FOREIGN KEY ("homeFolderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
