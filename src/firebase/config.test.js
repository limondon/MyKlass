import { describe, expect, it } from 'vitest';
import { getFirebaseRuntimeConfig } from './config.js';

describe('Firebase runtime config', () => {
  it('keeps Firebase disabled unless explicitly requested', () => {
    const runtime = getFirebaseRuntimeConfig({
      VITE_FIREBASE_API_KEY: 'key',
      VITE_FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'project',
      VITE_FIREBASE_APP_ID: 'app',
      VITE_FIREBASE_DATABASE_URL: 'https://example.firebaseio.com',
      VITE_FIREBASE_ALLOWED_EMAILS: 'teacher@example.com',
    });

    expect(runtime.enabled).toBe(false);
  });

  it('requires the Realtime Database URL', () => {
    const runtime = getFirebaseRuntimeConfig({
      VITE_DATA_REPOSITORY: 'firebase',
      VITE_FIREBASE_API_KEY: 'key',
      VITE_FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'project',
      VITE_FIREBASE_APP_ID: 'app',
      VITE_FIREBASE_ALLOWED_EMAILS: 'teacher@example.com',
    });

    expect(runtime.enabled).toBe(false);
    expect(runtime.missing).toContain('databaseURL');
  });

  it('enables a complete Firebase configuration', () => {
    const runtime = getFirebaseRuntimeConfig({
      VITE_DATA_REPOSITORY: 'firebase',
      VITE_FIREBASE_API_KEY: 'key',
      VITE_FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'project',
      VITE_FIREBASE_APP_ID: 'app',
      VITE_FIREBASE_DATABASE_URL: 'https://example.firebaseio.com',
      VITE_FIREBASE_DATABASE_PATH: '/workspaces/teacher/',
      VITE_FIREBASE_ALLOWED_EMAILS: 'Teacher@Example.com',
    });

    expect(runtime.enabled).toBe(true);
    expect(runtime.databasePath).toBe('workspaces/teacher');
    expect(runtime.allowedEmails).toEqual(['teacher@example.com']);
  });

  it('requires at least one allowed teacher email', () => {
    const runtime = getFirebaseRuntimeConfig({
      VITE_DATA_REPOSITORY: 'firebase',
      VITE_FIREBASE_API_KEY: 'key',
      VITE_FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'project',
      VITE_FIREBASE_APP_ID: 'app',
      VITE_FIREBASE_DATABASE_URL: 'https://example.firebaseio.com',
    });

    expect(runtime.enabled).toBe(false);
    expect(runtime.missing).toContain('allowedEmails');
  });
});
