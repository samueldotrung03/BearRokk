// Whether a signed-in student has been through the "about you" steps, remembered per account on
// this device, and the rules for a new password.
const key = (uid: string) => `bearrok.onboarded.${uid}`;

export function isOnboarded(uid: string): boolean {
  try {
    return localStorage.getItem(key(uid)) === '1';
  } catch {
    return true; // storage unavailable: do not trap the student in setup
  }
}

export function markOnboarded(uid: string): void {
  try {
    localStorage.setItem(key(uid), '1');
  } catch {
    // Not remembered; they may be asked again next time.
  }
}

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

/** What a new password must have. Kept short so it is easy to meet and still not trivial. */
export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'A letter', ok: /[A-Za-z]/.test(password) },
    { label: 'A number', ok: /\d/.test(password) },
  ];
}

export const passwordOk = (password: string) => passwordChecks(password).every((c) => c.ok);
export const looksLikeEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
