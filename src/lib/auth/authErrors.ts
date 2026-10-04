/**
 * Turns Firebase auth failures into something a person can act on.
 *
 * Firebase surfaces machine codes like `auth/too-many-requests`; showing those
 * verbatim leaves users with no next step. Anything already carrying a
 * human-written message (AuthContext raises a few of its own) is passed
 * through unchanged.
 */

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password. Check both and try again.',
  'auth/invalid-login-credentials': 'Incorrect email or password. Check both and try again.',
  'auth/wrong-password': 'Incorrect email or password. Check both and try again.',
  'auth/user-not-found': 'Incorrect email or password. Check both and try again.',
  'auth/invalid-email': 'That email address is not formatted correctly.',
  'auth/missing-password': 'Enter your password to continue.',
  'auth/user-disabled': 'This account has been disabled. Contact support if you think that is wrong.',
  'auth/too-many-requests':
    'Too many attempts from this device. Wait a few minutes, or reset your password to sign in again.',
  'auth/network-request-failed':
    'Serenity could not reach the authentication service. Check your connection and try again.',
  'auth/email-already-in-use':
    'An account already exists for this email address. Sign in instead, or reset the password.',
  'auth/weak-password': 'Choose a longer password — at least 8 characters.',
  'auth/popup-closed-by-user': 'The sign-in window closed before it finished. Try again.',
  'auth/cancelled-popup-request': 'The sign-in window closed before it finished. Try again.',
  'auth/popup-blocked':
    'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
  'auth/operation-not-allowed':
    'That sign-in method is not enabled for this Serenity deployment. Use email and password instead.',
  'auth/account-exists-with-different-credential':
    'This email is already registered with a different sign-in method. Use that method to sign in.',
  'auth/unauthorized-continue-uri':
    'Serenity could not send the verification email for this domain. Contact the site operator.',
  'auth/requires-recent-login': 'For security, sign in again before making this change.',
};

export function describeAuthError(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && MESSAGES[code]) return MESSAGES[code];
  }

  if (error instanceof Error && error.message) {
    // Never surface a raw Firebase code, even when it arrives as the message.
    if (/^auth\//.test(error.message) || error.message.includes('Firebase:')) return fallback;
    return error.message;
  }

  return fallback;
}
