# Glodire Tech website

| Page | What it does |
| --- | --- |
| `index.html` | Public website. The contact form now saves **orders**, and the **Projects** section shows the work you publish. |
| `admin.html` | Staff area (also linked as "Staff login" in the footer). Log in to see orders and manage projects. |

## Trying it now (demo mode)

The site must be opened through a local web server (not by double-clicking the file), because it uses JavaScript modules:

```
cd C:\Users\Admin\Desktop\campany
python -m http.server 8000
```

Then open <http://localhost:8000> for the site and <http://localhost:8000/admin.html> for the staff area.

While `js/supabase-config.js` is empty, the site runs in **demo mode**:
- Orders and projects are saved only in *that* browser, so a client's order on their phone will **not** reach you yet.
- Staff login accepts any **staff email** (see below) with the password `admin123`. The Google and Apple buttons ask you to type an email instead of opening a real sign-in window.

## Who can log in

Only the emails in `STAFF_EMAILS` in `js/supabase-config.js` can open the staff area, whether they use Google, Apple, or email and password. Anyone else is turned away, even with a real Google or Apple account. `supabase/schema.sql` contains the same list (in the `is_staff` function), so the database also refuses everyone else. **When you add or remove a staff member, change both lists** and run the SQL again.

## Going live with Supabase (free)

1. Go to <https://supabase.com>, sign in (e.g. with glodiretech@gmail.com), and click **New project**. Name it `glodire-tech`, choose a strong database password, and pick a nearby region (e.g. *West EU*). Wait about a minute for it to start.
2. **SQL Editor -> New query**: paste everything from `supabase/schema.sql` and click **Run**. This creates the `orders` and `projects` tables and the security rules.
3. **Project Settings -> API**: copy the **Project URL** and the **anon public** key into `js/supabase-config.js`.
4. **Authentication -> URL Configuration**: set **Site URL** to your website address, and under **Redirect URLs** add your staff page, e.g. `https://www.glodiretech.com/admin.html` (and `http://localhost:8000/admin.html` for testing).
5. **Authentication -> Providers** (sign-in methods):
   - **Email**: on by default. Then on **Authentication -> Users -> Add user -> Create new user**, add each staff member who wants a password and tick **Auto Confirm User**.
   - **Google**: turn it on. It needs a Client ID and Secret from Google Cloud Console (APIs & Services -> Credentials -> OAuth client ID, type *Web application*), with the callback URL that Supabase shows you added as an authorised redirect URI.
   - **Apple** (optional): needs a paid Apple Developer account (US$99 a year). When staff sign in with Apple, they must choose **Share My Email**, because the "Hide My Email" address won't be on the staff list.
6. Upload the whole folder to your web host.

Once the config is filled in, the demo banner disappears and orders from any device show up live in `admin.html`.

## How it works

- **Orders:** anyone can submit one, but only logged-in staff can read, update, or delete them (enforced by the row-level security rules in `supabase/schema.sql`). Each order has a status of *New*, *In progress*, or *Done*, and the Orders tab shows a badge with the number of new orders.
- **Projects:** staff add a title, category, description, optional link, and photo. Photos are resized in the browser and stored with the project. Projects are visible to everyone on the website.
- If saving an order fails (for example, the visitor is offline), the form opens the visitor's email app with the order pre-filled, as before.
