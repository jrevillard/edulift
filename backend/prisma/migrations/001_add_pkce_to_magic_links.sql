-- Add PKCE support to magic links for cross-user attack prevention
-- Following IETF RFC 7636 specification

-- Add code_challenge column to magic_links table
ALTER TABLE magic_links 
ADD COLUMN code_challenge VARCHAR(128) NOT NULL DEFAULT '';

-- Add index for efficient code_challenge lookups
CREATE INDEX idx_magic_links_code_challenge ON magic_links(code_challenge);

-- Add compound index for token and code_challenge validation
CREATE INDEX idx_magic_links_token_challenge ON magic_links(token, code_challenge);

-- Update existing records to have empty code_challenge (will be required for new records)
-- This migration allows backward compatibility during rollout
UPDATE magic_links SET code_challenge = '' WHERE code_challenge IS NULL;

-- Add comment documenting the PKCE security implementation
COMMENT ON COLUMN magic_links.code_challenge IS 'PKCE code_challenge - SHA256 hash of code_verifier, base64url encoded (43-128 chars). Prevents cross-user magic link attacks per RFC 7636.';