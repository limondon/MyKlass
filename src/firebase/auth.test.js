import { describe, expect, it } from 'vitest';
import { isAllowedFirebaseUser } from './auth.js';

describe('Firebase teacher access policy', () => {
  const allowedEmails = ['teacher@example.com'];

  it('allows the verified teacher account regardless of email case', () => {
    expect(
      isAllowedFirebaseUser(
        {
          email: 'Teacher@example.com',
          emailVerified: true,
        },
        allowedEmails,
      ),
    ).toBe(true);
  });

  it('denies a different Google account', () => {
    expect(
      isAllowedFirebaseUser(
        {
          email: 'another@example.com',
          emailVerified: true,
        },
        allowedEmails,
      ),
    ).toBe(false);
  });

  it('denies an unverified account', () => {
    expect(
      isAllowedFirebaseUser(
        {
          email: 'Teacher@example.com',
          emailVerified: false,
        },
        allowedEmails,
      ),
    ).toBe(false);
  });
});
