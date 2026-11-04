// Paste your Supabase project details here (see README.md, "Going live with Supabase").
// Supabase dashboard -> Project Settings -> API: copy the "Project URL" and the
// "anon public" key. The anon key is safe to put in a website; the database
// rules in supabase/schema.sql decide what it may do.
// While SUPABASE_URL is empty the site runs in DEMO MODE: orders and projects are
// saved only in the current browser, and the demo staff password is "admin123".
export const SUPABASE_URL = 'https://yolsetnpwambdqjjezng.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_RBFb22-l7Hd0zuwBSIdv7g_9fpB4t9K'; // publishable key: safe in a website

// The first admins. Who can open the staff area is now managed on the Admins tab
// of admin.html (stored in the database); this list is only used in demo mode.
export const STAFF_EMAILS = [
  'gloria@glodiretech.com',
  'divinenamutaawe@gmail.com',
  'irenenairuba23@gmail.com',
  'glodiretech@gmail.com',
  'gloriamusimenta63@gmail.com',
];
