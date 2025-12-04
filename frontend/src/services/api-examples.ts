/**
 * Examples of using the new OpenAPI-based API client
 *
 * This demonstrates how the 20-line client replaces 990 lines of manual code
 * while providing full type safety and IDE autocomplete.
 */

import { api } from './api';

// Example: Get all children for the current user
export async function getChildren() {
  const { data, error } = await api.GET('/children');

  if (error) {
    throw new Error(`Failed to fetch children: ${JSON.stringify(error)}`);
  }

  return data;
}

// Example: Update user profile
export async function updateProfile(profileData: { name?: string; timezone?: string }) {
  const { data, error } = await api.PUT('/auth/profile', {
    body: profileData
  });

  if (error) {
    throw new Error(`Failed to update profile: ${JSON.stringify(error)}`);
  }

  return data;
}


// Example: Request magic link for authentication
export async function requestMagicLink(email: string, codeChallenge: string) {
  const { data, error } = await api.POST('/auth/magic-link', {
    body: { email, code_challenge: codeChallenge }
  });

  if (error) {
    throw new Error(`Failed to request magic link: ${JSON.stringify(error)}`);
  }

  return data;
}

// Example: Delete user account request
export async function deleteAccountRequest() {
  const { data, error } = await api.POST('/auth/profile/delete-request', {});

  if (error) {
    throw new Error(`Failed to request account deletion: ${JSON.stringify(error)}`);
  }

  return data;
}

// Example: Confirm user account deletion
export async function deleteAccountConfirm(token: string, codeVerifier: string) {
  const { data, error } = await api.POST('/auth/profile/delete-confirm', {
    body: { token, code_verifier: codeVerifier }
  });

  if (error) {
    throw new Error(`Failed to delete account: ${JSON.stringify(error)}`);
  }

  return data;
}