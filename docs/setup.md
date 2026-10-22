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
add the custom domain **`cleanplate.immotus.app`**.

## 5. Set up email (Resend)

Sign-up emails each new family a code, so **nobody can sign up until this
is done**, you included. It also sends password-reset links.

Resend's free plan stops sending after **100 emails a day**. If you post the
link to a big group, choose a paid plan in Resend first (its Pro plan has no
daily cap), or sign-ups will stall partway through the day.

1. In Resend, add your sending domain (for example `immotus.app`). Resend lists
   DNS records. Add each one in the Cloudflare dashboard under **your domain →
   DNS → Records**, then press Verify in Resend.
2. In Resend, create an **API key** with sending access.
3. In the Cloudflare dashboard, add another **Secret** to the Worker (as in
   step 3), named **`RESEND_API_KEY`**, with that key as its value.
4. Emails come from `cleanplate@immotus.app`, so the domain you verify in
   step 1 is **`immotus.app`**.

There's no photo storage (R2) to set up. Photos stay off until you turn them on
for your own family, and that comes with Phase 4.

## 6. First run

1. Open **`https://cleanplate.immotus.app/ops`** and sign in with your `OPS_TOKEN`.
   The setup list at the top shows what's still missing.
2. Under **Migrations**, press **Apply pending**.
3. Open **`https://cleanplate.immotus.app`**, choose **Sign up**, and enter your
   email and a password. Enter the code from the email, then your family name
   and parent PIN.
4. Back on `/ops`, type your email under **The owner** and press **Make this
   parent the owner**. The **Owner** tab now shows in the app's parent area.
5. To test in the wild first: in the app, **Parents → Owner → Beta word**, set
   a word and share it only with your testers. Turn it off when you're ready
   for everyone.

## 7. Check it (the Phase 1b test)

1. In a private window, sign up a second test family with another email.
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
