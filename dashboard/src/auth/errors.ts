/** Turns a Firebase error code into something a student can act on. */
export function authMessage(error: unknown): string | null {
  // The student started over or left the page: nothing to report.
  if (error instanceof DOMException && error.name === 'AbortError') return null;
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  switch (code) {
    // Closing the window is not an error worth showing.
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null;
    case 'desktop/timed-out':
      return 'Sign-in was not finished in the browser. Click the button to try again.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'That email and password do not match an account.';
    case 'auth/invalid-email':
      return 'That does not look like an email address.';
    case 'auth/missing-password':
      return 'Enter your password.';
    case 'auth/missing-email':
      return 'Enter your email first.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Sign in instead.';
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'That sign-in method is not switched on yet.';
    case 'auth/popup-blocked':
      return 'The sign-in window was blocked. Allow pop-ups for this page and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'You already have an account with that email. Sign in the way you did before.';
    case 'auth/requires-recent-login':
      return 'For your security, sign out, sign in again, and then retry.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Could not reach the sign-in service. Check your connection.';
    case 'auth/unauthorized-domain':
      return 'Sign-in is not allowed from this address yet.';
    default:
      return 'Sign-in did not work. Try again.';
  }
}
