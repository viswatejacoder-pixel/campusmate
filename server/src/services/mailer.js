// Sends the verification email (T-075). Transports: `brevo` (HTTPS API through global fetch, no dependency) and `console`
// (development only: prints the link, which contains the token, to the server console; refused when NODE_ENV=production).
import { env } from '../config/env.js';
import { TOKEN_TTL_MINUTES } from '../utils/tokens.js';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10_000;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createMailer(config, fetchImpl = fetch) {
  async function sendVerificationEmail({ to, name, token }) {
    const link = `${config.appBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;

    if (config.transport === 'console') {
      if (config.nodeEnv === 'production') throw Object.assign(new Error('console mail transport refused'), { code: 'MAIL_CONSOLE_IN_PRODUCTION' });
      console.log(`[mail:console] To: ${to}\n  Verify link (development only): ${link}`);
      return;
    }

    const subject = 'Verify your CampusMate email address';
    const textContent =
      `Hello ${name},\n\nConfirm your email address to activate your CampusMate account:\n${link}\n\n` +
      `The link expires in ${TOKEN_TTL_MINUTES} minutes and can be used once. If you did not register, ignore this email.\n`;
    const htmlContent =
      `<p>Hello ${escapeHtml(name)},</p>` +
      `<p><a href="${escapeHtml(link)}">Confirm your email address</a> to activate your CampusMate account.</p>` +
      `<p>The link expires in ${TOKEN_TTL_MINUTES} minutes and can be used once. If you did not register, ignore this email.</p>`;

    const res = await fetchImpl(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': config.brevoApiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: config.fromName, email: config.fromEmail },
        to: [{ email: to }],
        subject,
        htmlContent,
        textContent,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw Object.assign(new Error('mail provider rejected the request'), { code: `BREVO_HTTP_${res.status}` });
  }
  return { sendVerificationEmail };
}

export const { sendVerificationEmail } = createMailer({ ...env.mail, nodeEnv: env.nodeEnv });
