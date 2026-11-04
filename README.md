# Glodire Tech website

| Page | What it does |
| --- | --- |
| `index.html` | Public website. The contact form now saves **orders**, and the **Projects** section shows the work you publish. |
| `admin.html` | Staff area (also linked as "Staff login" in the footer). Log in to see orders and manage projects. |

## Status

The site is **connected to Supabase** (project `yolsetnpwambdqjjezng`): the database tables and security rules from `supabase/schema.sql` are installed, and orders from any device show up live in `admin.html`. Staff currently log in with **email and password**. The Google and Apple buttons appear on the login page by themselves once those sign-in methods are turned on in Supabase (step 5 below).

To preview it on your computer, open it through a local web server (not by double-clicking the file), because it uses JavaScript modules:

```
cd C:\Users\Admin\Desktop\campany
python -m http.server 8000
```

Then open <http://localhost:8000> for the site and <http://localhost:8000/admin.html> for the staff area.

**Demo mode:** if `SUPABASE_URL` in `js/supabase-config.js` is left empty, the site runs offline. Data is saved only in that browser, and any admin email logs in with the password `admin123`.

## Who can log in (Admins tab)

Admins are managed on the **Admins** tab of `admin.html`, and the list lives in the `admins` table in Supabase. Any admin can add another admin's email or remove one, but nobody can remove themselves. Anyone not on the list is turned away, even with a real Google or Apple account, and the database also refuses them (see `is_staff()` in `supabase/schema.sql`).

A newly added admin opens `admin.html` and either:
- clicks **Continue with Google** (once Google sign-in is turned on in Supabase), or
- clicks **New admin? Create your password**, enters their email and a password, then clicks the confirmation link Supabase emails them.

**Forgot password?** on the login form emails a reset link.

## Supabase setup checklist

Steps 1 to 3 are done. Steps 4 to 6 still need to be done in the Supabase dashboard and with your web host.

1. ✅ Go to <https://supabase.com>, sign in (e.g. with glodiretech@gmail.com), and click **New project**. Name it `glodire-tech`, choose a strong database password, and pick a nearby region (e.g. *West EU*). Wait about a minute for it to start.
2. ✅ **SQL Editor -> New query**: paste everything from `supabase/schema.sql` and click **Run**. This creates the `orders` and `projects` tables and the security rules.
3. ✅ **Project Settings -> API Keys**: copy the **Project URL** and the **publishable** key into `js/supabase-config.js`.
4. **Authentication -> URL Configuration**: set **Site URL** to your website address, and under **Redirect URLs** add your staff page, e.g. `https://www.glodiretech.com/admin.html` (and `http://localhost:8000/admin.html` for testing). **Do this first:** until it is done, the "confirm your email" and "reset password" links that Supabase emails will open the wrong address.
5. **Authentication -> Providers** (sign-in methods):
   - **Email**: on by default. Then on **Authentication -> Users -> Add user -> Create new user**, add each staff member who wants a password and tick **Auto Confirm User**.
   - **Google** (recommended, since most admins use Gmail): turn it on. It needs a Client ID and Secret from Google Cloud Console (APIs & Services -> Credentials -> OAuth client ID, type *Web application*), with the callback URL that Supabase shows you added as an authorised redirect URI.
   - **Apple** (optional): needs a paid Apple Developer account (US$99 a year). When staff sign in with Apple, they must choose **Share My Email**, because the "Hide My Email" address won't be on the staff list.
6. Upload the whole folder to your web host.

If you change `supabase/schema.sql` later, run the whole file again in the SQL Editor. It is safe to re-run and keeps your data.

## How it works

- **Orders:** anyone can submit one, but only logged-in staff can read, update, or delete them (enforced by the row-level security rules in `supabase/schema.sql`). Each order has a status of *New*, *In progress*, or *Done*, and the Orders tab shows a badge with the number of new orders.
- **Projects:** staff add a title, category, description, optional link, and photo. Photos are resized in the browser and stored with the project. Projects are visible to everyone on the website.
- If saving an order fails (for example, the visitor is offline), the form opens the visitor's email app with the order pre-filled, as before.
