import { getFirebaseApp } from './app.js';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isAllowedFirebaseUser(user, allowedEmails) {
  const allowed = new Set(allowedEmails.map(normalizeEmail));
  return Boolean(
    user?.emailVerified &&
    allowed.has(normalizeEmail(user.email)),
  );
}

export function createFirebaseAuthController({
  firebaseConfig,
  allowedEmails,
}) {
  const subscribers = new Set();
  const authorizedWaiters = new Set();
  let deniedError = null;
  let state = {
    status: 'loading',
    user: null,
    error: null,
  };
  let authContextPromise;

  const emit = () => {
    subscribers.forEach((subscriber) => subscriber(state));
    if (state.status === 'authorized') {
      authorizedWaiters.forEach((resolve) => resolve(state.user));
      authorizedWaiters.clear();
    }
  };

  const setState = (next) => {
    state = next;
    emit();
  };

  const isAllowed = (user) =>
    isAllowedFirebaseUser(user, allowedEmails);

  const getContext = () => {
    if (!authContextPromise) {
      authContextPromise = Promise.all([
        getFirebaseApp(firebaseConfig),
        import('firebase/auth'),
      ]).then(async ([app, sdk]) => {
        const auth = sdk.getAuth(app);
        await sdk.setPersistence(auth, sdk.browserLocalPersistence);
        sdk.onAuthStateChanged(
          auth,
          async (user) => {
            if (!user) {
              if (deniedError) {
                setState({
                  status: 'denied',
                  user: null,
                  error: deniedError,
                });
                return;
              }
              setState({ status: 'signed-out', user: null, error: null });
              return;
            }
            if (!isAllowed(user)) {
              deniedError =
                `Аккаунт ${user.email || ''} не имеет доступа`;
              setState({
                status: 'denied',
                user: null,
                error: deniedError,
              });
              await sdk.signOut(auth);
              return;
            }
            deniedError = null;
            setState({ status: 'authorized', user, error: null });
          },
          (error) =>
            setState({ status: 'error', user: null, error: error.message }),
        );
        return { auth, sdk };
      });
    }
    return authContextPromise;
  };

  getContext().catch((error) =>
    setState({ status: 'error', user: null, error: error.message }),
  );

  return {
    get state() {
      return state;
    },

    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },

    async signIn() {
      deniedError = null;
      setState({ status: 'loading', user: null, error: null });
      try {
        const { auth, sdk } = await getContext();
        const provider = new sdk.GoogleAuthProvider();
        provider.setCustomParameters({
          login_hint: allowedEmails[0] || '',
          prompt: 'select_account',
        });
        const result = await sdk.signInWithPopup(auth, provider);
        if (!isAllowed(result.user)) {
          deniedError =
            `Аккаунт ${result.user.email || ''} не имеет доступа`;
          await sdk.signOut(auth);
          setState({
            status: 'denied',
            user: null,
            error: deniedError,
          });
        }
      } catch (error) {
        setState({
          status: 'signed-out',
          user: null,
          error: error.message,
        });
      }
    },

    async signOut() {
      deniedError = null;
      const { auth, sdk } = await getContext();
      await sdk.signOut(auth);
    },

    waitForAuthorizedUser() {
      if (state.status === 'authorized') {
        return Promise.resolve(state.user);
      }
      return new Promise((resolve) => authorizedWaiters.add(resolve));
    },
  };
}
