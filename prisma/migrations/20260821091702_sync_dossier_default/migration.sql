-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "dossier" TEXT NOT NULL,
    "interet" TEXT NOT NULL,
    "valeurAjoutee" TEXT NOT NULL,
    "republicationJson" TEXT NOT NULL,
    "embedding" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Article_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Article" ("categorie", "createdAt", "dossier", "embedding", "id", "interet", "republicationJson", "sourceId", "titre", "valeurAjoutee") SELECT "categorie", "createdAt", "dossier", "embedding", "id", "interet", "republicationJson", "sourceId", "titre", "valeurAjoutee" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
