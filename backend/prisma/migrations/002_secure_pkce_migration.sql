-- SECURITY FIX: Secure PKCE Migration - Phase 2
-- This migration removes the security gap from the previous migration
-- by enforcing non-empty code_challenge values

-- Remove the insecure default that allows empty code_challenge
ALTER TABLE magic_links 
ALTER COLUMN code_challenge DROP DEFAULT;

-- Add constraint to prevent empty code_challenge values
ALTER TABLE magic_links 
ADD CONSTRAINT chk_code_challenge_not_empty 
CHECK (LENGTH(code_challenge) >= 43 AND LENGTH(code_challenge) <= 128);

-- Update any existing records with empty code_challenge to be expired
-- This ensures no security gaps during deployment
UPDATE magic_links 
SET expires_at = NOW() - INTERVAL '1 day' 
WHERE code_challenge = '' AND expires_at > NOW();

-- Add comment documenting the security fix
COMMENT ON CONSTRAINT chk_code_challenge_not_empty ON magic_links IS 
'SECURITY: Ensures PKCE code_challenge is never empty, preventing cross-user attacks. Length must be 43-128 chars per RFC 7636.';