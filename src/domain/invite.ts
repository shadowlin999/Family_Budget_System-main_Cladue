/**
 * Generate a random 6-character alphanumeric invite code.
 * Pure function — no Firebase or React dependencies.
 */
export function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
