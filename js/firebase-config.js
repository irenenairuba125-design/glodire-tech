// Paste your Firebase web app config here (see README.md, "Going live").
// While apiKey is empty the site runs in DEMO MODE: orders and projects are
// saved only in the current browser, and the demo admin password is "admin123".
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// Only these accounts can open the staff area, whether they sign in with
// email + password, Google, or Apple. Keep this list the same as in firestore.rules.
export const STAFF_EMAILS = [
  'gloria@glodiretech.com',
  'divinenamutaawe@gmail.com',
  'irenenairuba23@gmail.com',
];
