# Setting up the app

Everything here is done in a web browser: the Cloudflare dashboard, the GitHub
web editor, Resend's website, and the app's own `/ops` page. Do the steps in
order. Cloudflare and Resend move their menus around now and then, so if a
name below doesn't match, look for the nearest one.

## 1. Create the Worker and connect it to GitHub

1. In the Cloudflare dashboard, open **Workers & Pages** and choose **Create**.
2. Choose to import a repository from GitHub, and pick **NoliCommoveri/Cooking**.
3. Name the project **`clean-plate-recipes`**. It must match the `name` in
   `wrangler.toml`.
4. Leave the build settings as they are, and deploy. From now on, every change
   merged into `main` deploys on its own.

## 2. Create the database

1. In the dashboard, open **Storage & Databases → D1** and choose **Create**.
2. Name it **`clean-plate-recipes`**.
3. Open the new database and copy its **Database ID**.
4. In GitHub, open `wrangler.toml` and press the pencil to edit it. Find the
   four lines that start with `# [[d1_databases]]`:
   - remove the `# ` at the start of each of the four lines
   - replace `PASTE-THE-DATABASE-ID-HERE` with the ID you copied
5. Commit the change to `main`. Cloudflare deploys it in a minute or two.

(Or send Claude the Database ID, and Claude makes this edit.)

## 3. Set the ops password

1. In the dashboard: **Workers & Pages → clean-plate-recipes → Settings →
   Variables and Secrets → Add**.
2. Type: **Secret**. Name: **`OPS_TOKEN`**. Value: a long password that only
   you know. Save it in your password manager.

## 4. Give it its address

In **Workers & Pages → clean-plate-recipes → Settings → Domains & Routes**,
add the custom domain **`cook.immotus.app`**.

## 5. Set up email (Resend)

This sends password-reset links, sign-up codes, and your note about each new
request. The app works without it: you can read codes off the owner screens
and pass them on yourself.

1. In Resend, add your sending domain (for example `immotus.app`). Resend lists
   DNS records. Add each one in the Cloudflare dashboard under **your domain →
   DNS → Records**, then press Verify in Resend.
2. In Resend, create an **API key** with sending access.
3. In the Cloudflare dashboard, add another **Secret** to the Worker (as in
   step 3), named **`RESEND_API_KEY`**, with that key as its value.
4. The sent-from address is `MAIL_FROM` in `wrangler.toml`. It's set to
   `Clean Plate Recipes <cook@immotus.app>`. If you verified a different domain,
   change it in the GitHub web editor.

## 6. First run on /ops

1. Open **`https://cook.immotus.app/ops`** and sign in with your `OPS_TOKEN`.
2. Under **Migrations**, press **Apply pending**.
3. Press **Make a sign-up code**, and copy the code.
4. Open **`https://cook.immotus.app`**, choose **Sign up**, and use the code to
   create your family. Set your parent PIN when it asks.
5. Back on `/ops`, type your email under **Sign-up codes and the owner** and
   press **Make this parent the owner**. The **Owner** tab now shows in the
   app's parent area.

## 7. Check it (the Phase 1b test)

1. From the Owner tab, make a second code and sign up a test family with it
   (in a private window, with another email).
2. Add a profile in each family. Each family sees only its own lockers.
3. On `/ops`, press **Download export.json**. That file is a full backup.

## Backups and recovery

- **Download export.json** saves everything. **Restore from export.json**
  puts it back into an empty database.
- **Clear everything** deletes every table. To bring it back: **Apply
  pending**, then **Restore from export.json**.
- **Remove…** next to a family deletes that family. Download it first
  (**Download** next to it); **Restore a family** puts it back from that file.
- If something on `/ops` fails, the page shows what the database said. The
  Worker's logs (**Workers & Pages → clean-plate-recipes → Logs**) show email
  failures too.
