-- CreateEnum for TokenType (only if not exists)
DO $$ BEGIN
    CREATE TYPE "TokenType" AS ENUM ('MAGIC_LINK', 'ACCOUNT_DELETION', 'EMAIL_MODIFICATION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "secure_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "codeChallenge" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,

    CONSTRAINT "secure_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "secure_tokens_token_key" ON "secure_tokens"("token");

-- CreateIndex
CREATE INDEX "secure_tokens_codeChallenge_idx" ON "secure_tokens"("codeChallenge");

-- CreateIndex
CREATE INDEX "secure_tokens_token_codeChallenge_idx" ON "secure_tokens"("token", "codeChallenge");

-- CreateIndex
CREATE INDEX "secure_tokens_type_token_idx" ON "secure_tokens"("type", "token");

-- CreateIndex
CREATE INDEX "secure_tokens_type_userId_expiresAt_idx" ON "secure_tokens"("type", "userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "secure_tokens" ADD CONSTRAINT "secure_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: migrate existing magic_links to secure_tokens
INSERT INTO "secure_tokens" (id, token, userId, expiresAt, used, codeChallenge, type)
SELECT id, token, userId, expiresAt, used, codeChallenge, 'MAGIC_LINK'::"TokenType"
FROM "magic_links";

-- Drop old table
DROP TABLE "magic_links";