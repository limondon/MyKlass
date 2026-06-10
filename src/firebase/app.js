let appPromise;

export function getFirebaseApp(firebaseConfig) {
  if (!appPromise) {
    appPromise = import('firebase/app').then((sdk) =>
      sdk.getApps().length ? sdk.getApp() : sdk.initializeApp(firebaseConfig),
    );
  }
  return appPromise;
}
