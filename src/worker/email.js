// Email through Resend (plan §8.3): password resets, sign-up codes, and the
// owner's note about a new request. Without RESEND_API_KEY nothing is sent and
// the caller is told, so the owner screens can show a code to pass on by hand.

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

export const codeEmail = (name, code, link) => ({
  subject: 'Your Clean Plate Recipes sign-up code',
  text: `Hi ${name},\n\nYou're in. Your sign-up code is:\n\n${code}\n\nOpen ${link}, choose Sign up, and enter the code. It works once.${SIGNOFF}`,
});

export const requestEmail = (req, link) => ({
  subject: `New sign-up request from ${req.name}`,
  text: `${req.name} (${req.email}) asked to join.\n\n${req.note ? `Their note: ${req.note}\n\n` : ''}Approve or decline it in the owner screens: ${link}${SIGNOFF}`,
});
