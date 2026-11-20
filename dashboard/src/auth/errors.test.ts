import { expect, test } from 'vitest';
import { authMessage } from './errors.ts';

test('closing the sign-in window shows nothing', () => {
  expect(authMessage({ code: 'auth/popup-closed-by-user' })).toBeNull();
});

test('wrong credentials do not reveal whether the account exists', () => {
  const message = 'That email and password do not match an account.';
  expect(authMessage({ code: 'auth/invalid-credential' })).toBe(message);
  expect(authMessage({ code: 'auth/user-not-found' })).toBe(message);
  expect(authMessage({ code: 'auth/wrong-password' })).toBe(message);
});

test('a provider that is switched off says so, and unknown errors get a plain fallback', () => {
  expect(authMessage({ code: 'auth/operation-not-allowed' })).toBe('That sign-in method is not switched on yet.');
  expect(authMessage(new Error('boom'))).toBe('Sign-in did not work. Try again.');
});
