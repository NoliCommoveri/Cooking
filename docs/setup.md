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
3. It's already connected: its ID is in `wrangler.toml`.

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

## 8. After an update that adds a migration

When an update adds a database change, `/ops` shows it under **Migrations** as
pending. Press **Download export.json** first, then **Apply pending**. Nothing
already in the database is changed or removed.

## 9. Check it (the Phase 2b test)

1. In a family with two profiles, open a lesson from one profile's kitchen and
   tap the other profile under **Cooking with someone?**
2. Cook it through to **Plate it**. Both profiles' kitchens show **Cooked once**
   on that lesson.
3. A parent signing in for the first time sees **Before your kids cook** above
   the lockers. **Got it** closes it for that parent, on every device.

## 10. Check it (the Phase 2c test)

Use an Android phone or tablet with Chrome.
1. In the app, **Parents → Family**, tick **Turn on voice step control** and
   press **Save**. Until then, no mic button shows anywhere.
2. Open a lesson and go into cook mode. Tap the mic button on the step card
   and allow the microphone when Chrome asks.
3. Say "next," "back," and "again." On the thermometer step, "next" reads the
   temperature aloud and stays on that step; tap **Next step** to move on.
4. Turn Wi-Fi off: the button says "Voice paused, no connection" and the
   on-screen buttons still work. Turn it back on and voice picks up again.

## 11. Check it (the Phase 2e test)

1. In a test family (not yours), open a lesson from a kid's kitchen. Tap
   **Suggest a fix** on a step, enter the parent PIN, pick the part (say, a
   timer), type what it should be, say what's wrong, and **Send**. The lesson
   card now says the fix is waiting.
2. In your family, **Parents → Fix requests**. Press **Apply**. The test
   family's lesson shows the new value, and its card says "Fixed".
3. Under **Live fixes**, press **Revert**. The lesson is back the way it was,
   and the request is waiting again.
4. A fix that names an unclean food, or lowers a thermometer target, can't be
   applied: the screen says why.

## 12. Check it (the Phase 3a test)

After this update deploys, press **Apply pending** on `/ops` (migration 0006).

1. In a test family, open a lesson from a kid's kitchen and tap **I want to
   make this**. In **Parents → Queue**, the request is at the top. Open
   **Safety review**, then **Approve**. The kid's kitchen shows it under
   **Up next**.
2. On an adult profile, tap **Cook this**. It goes straight into the queue.
3. In **Parents → Family**, pick **Homeschool** and save. In **Parents →
   Courses**, **Set up a course** for two profiles, starting this week, 1 a
   week. The Queue screen shows this week's lesson, due Friday, and both kids
   see it.
4. Press **Cook another recipe**: the next lesson joins this week. **Undo**
   takes it away. **Skip this recipe** brings in the next one; **Undo** puts
   it back. **Skip this week** empties the week; **Put this week back**
   undoes it.
5. Press **I've test-cooked this** on a lesson. **Unmark** undoes it.

## 13. Check it (the Phase 3b test)

After this update deploys, press **Apply pending** on `/ops` (migrations 0007
and 0008).

1. In a test family, queue two lessons, or set up a course.
2. **Parents → Shopping**: **What you'll need** shows the lessons week by week,
   with the ingredients each week uses.
3. Under **Make a shopping list**, pick **2 lessons**: their names show. Press
   **Next**, tick something you have, and press **Create shopping list**.
4. Tick a few items, close the app, and open the list again: they're still
   ticked. **You have these** lists what you ticked as on hand; **Put on the
   list** brings one back.
5. **Kitchen staples**: tick salt and olive oil, save. On the next list they're
   grouped under **May already have**, still on the list.
6. Open a lesson that was on the list from a kid's kitchen and change the
   serving count: the card says "You shopped for 6."

## 14. Check it (the first part of Phase 4)

After this update deploys, press **Apply pending** on `/ops` (migration 0009).

1. Cook a lesson to the end and press **Plate it**. The Reflect screen asks how
   it turned out (gems in Kitchen Quest, chef's hats in Chef's Passport), what
   you'd change, and the optional "what other dish could use this move?".
   Cooking with someone? Each of you gets your own. **Save**.
2. **Parents → Progress**: the lesson is there with its rating. **Print**
   (or save as PDF from the print window), and **Download CSV**.
3. On `/ops`, each family says **photos off**. **Turn photos on** for your
   family. Nothing shows yet: the camera and gallery come once the photo
   storage below exists.

## 15. Check it (Didn't make it)

After this update deploys, press **Apply pending** on `/ops` (migration 0015).

1. Queue a lesson for a kid, then cook it to the end from their kitchen.
2. **Parents → Progress**: the lesson is there. Press **Didn't make it** on
   its row and OK. It's gone from Progress, it's back on the **Queue**, and
   the kid's kitchen no longer shows it cooked.
3. Press **Undo**: it's back on Progress, and off the Queue again.

## Before photos: create the photo storage (R2)

Photos need a storage bucket that only you can create:

1. In the Cloudflare dashboard, open **R2 Object Storage**. If it asks, turn R2
   on for the account (there's a free monthly allowance).
2. **Create bucket**. Name it `clean-plate-photos`, leave the location on
   Automatic, and create it.
3. Tell Claude it's done. The app connects to it in its settings file, so the
   next deploy picks it up; there's nothing else to set.

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
