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

While `js/firebase-config.js` is empty, the site runs in **demo mode**:
- Orders and projects are saved only in *that* browser, so a client's order on their phone will **not** reach you yet.
- Staff login accepts any **staff email** (see below) with the password `admin123`. The Google and Apple buttons ask you to type an email instead of opening a real sign-in window.

## Who can log in

Only the emails in `STAFF_EMAILS` in `js/firebase-config.js` can open the staff area, whether they use Google, Apple, or email and password. Anyone else is turned away, even with a real Google or Apple account. `firestore.rules` contains the same list, so the database also refuses everyone else. **When you add or remove a staff member, change both lists.**

## Going live with Firebase (free)

1. Go to <https://console.firebase.google.com>, click **Add project**, and name it (e.g. `glodire-tech`).
2. **Build → Authentication → Get started**, then on **Sign-in method** enable:
   - **Google**: click it, turn it on, choose a support email, and save. That's all it needs.
   - **Email/Password**: turn it on. On the **Users** tab, click **Add user** for each staff member who wants a password. The first time they log in, they get a verification email and must click the link before they can get in.
   - **Apple** (optional): this needs a paid Apple Developer account (US$99 a year). Follow the steps Firebase shows when you click **Apple** to create a Services ID and key in your Apple account. When staff sign in with Apple, they must choose **Share My Email**, because the "Hide My Email" address won't be on the staff list.
3. **Build → Firestore Database → Create database** (production mode, pick a nearby location such as `europe-west`).
   Open the **Rules** tab, paste in everything from `firestore.rules`, and click **Publish**.
4. **Project settings (gear icon) → General → Your apps → Web (`</>`)**, register the app, and copy the `firebaseConfig` values into `js/firebase-config.js`.
5. **Authentication → Settings → Authorized domains**: add `glodiretech.com` (and `www.glodiretech.com`).
6. Upload the whole folder to your web host.

Once the config is filled in, the demo banner disappears and orders from any device show up live in `admin.html`.

## How it works

- **Orders:** anyone can submit one, but only logged-in staff can read, update, or delete them (enforced by `firestore.rules`). Each order has a status of *New*, *In progress*, or *Done*, and the Orders tab shows a badge with the number of new orders.
- **Projects:** staff add a title, category, description, optional link, and photo. Photos are resized in the browser and stored with the project. Projects are visible to everyone on the website.
- If saving an order fails (for example, the visitor is offline), the form opens the visitor's email app with the order pre-filled, as before.
