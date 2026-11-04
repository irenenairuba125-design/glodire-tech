// Paste your Supabase project details here (see README.md, "Going live with Supabase").
// Supabase dashboard -> Project Settings -> API: copy the "Project URL" and the
// "anon public" key. The anon key is safe to put in a website; the database
// rules in supabase/schema.sql decide what it may do.
// While SUPABASE_URL is empty the site runs in DEMO MODE: orders and projects are
// saved only in the current browser, and the demo staff password is "admin123".
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

// Only these accounts can open the staff area, whether they sign in with
// email + password, Google, or Apple. Keep this list the same as in supabase/schema.sql.
export const STAFF_EMAILS = [
  'gloria@glodiretech.com',
  'divinenamutaawe@gmail.com',
  'irenenairuba23@gmail.com',
];
