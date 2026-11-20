import { expect, test } from 'vitest';
import { looksLikeEmail, passwordChecks, passwordOk } from './onboarding.ts';

test('a new password needs length, a letter and a number', () => {
  expect(passwordOk('short1')).toBe(false);
  expect(passwordOk('longenoughbutnodigit')).toBe(false);
  expect(passwordOk('12345678')).toBe(false);
  expect(passwordOk('berkeley2027')).toBe(true);
  expect(passwordChecks('abc').map((c) => c.ok)).toEqual([false, true, false]);
});

test('email shape check', () => {
  expect(looksLikeEmail('maya@berkeley.edu')).toBe(true);
  expect(looksLikeEmail(' maya@berkeley.edu ')).toBe(true);
  expect(looksLikeEmail('maya@berkeley')).toBe(false);
  expect(looksLikeEmail('maya berkeley.edu')).toBe(false);
});
