// Email through Resend (plan §8.3): sign-up codes and password resets.
// Without RESEND_API_KEY nothing is sent and the caller is told.

export const emailReady = (env) => Boolean(env.RESEND_API_KEY && env.MAIL_FROM);

export async function sendEmail(env, { to, subject, text }) {
  if (!emailReady(env)) return { sent: false, reason: 'Email is not set up yet (RESEND_API_KEY or MAIL_FROM is missing).' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [].concat(to), subject, text }),
    });
    if (res.ok) return { sent: true };
    // The Worker logs (Cloudflare dashboard) are where the owner can read why.
    const detail = await res.text();
    console.log(`Resend refused the email: ${res.status} ${detail}`);
    return { sent: false, reason: `Resend refused the email (${res.status}).` };
  } catch (err) {
    console.log(`Resend unreachable: ${err?.message ?? err}`);
    return { sent: false, reason: 'Resend could not be reached.' };
  }
}

const SIGNOFF = '\n\nClean Plate Recipes';

export const resetEmail = (link) => ({
  subject: 'Reset your Clean Plate Recipes password',
  text: `Someone asked to reset the password for this email address.\n\nTo choose a new password, open this link within an hour:\n${link}\n\nIf it wasn't you, ignore this email and nothing changes.${SIGNOFF}`,
});

export const signupCodeEmail = (code, minutes) => ({
  subject: `${code} is your Clean Plate Recipes code`,
  text: `Your code to finish signing up is:\n\n${code}\n\nEnter it on the sign-up page. It works for ${minutes} minutes.\n\nIf you didn't sign up, ignore this email and nothing happens.${SIGNOFF}`,
});

// A safety or unclean-ingredient report (§6.11), sent to the owner right away.
export const fixReportEmail = ({ kind, lesson, where, note, change }) => ({
  subject: `${kind}: ${lesson}`,
  text: `A family sent a fix request marked "${kind}" on ${lesson}, ${where}.\n\nWhat's wrong:\n${note}\n${change ? `\nTheir suggestion:\n${change}\n` : ''}\nReview it in the app: Parents, then Owner, then Fix requests.${SIGNOFF}`,
});

// A report on a shared recipe for an unclean ingredient or a food-safety
// problem (§6.10), sent to the owner right away.
export const recipeReportEmail = ({ kind, title, note }) => ({
  subject: `${kind}: ${title} (a user-shared recipe)`,
  text: `A family reported the user-shared recipe "${title}" as "${kind}".\n\nWhat they said:\n${note}\n\nReview it in the app: Parents, then Menu, then Owner, then Reported recipes.${SIGNOFF}`,
});
