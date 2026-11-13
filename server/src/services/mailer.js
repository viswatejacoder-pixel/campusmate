// Sends the verification email (T-075) and the password-reset email. Transports: `brevo` (HTTPS API through global fetch, no dependency)
// and `console` (development only; refused when NODE_ENV=production). The console transport prints the VERIFICATION link (existing
// development convention) but never a password-reset link: reset tokens and URLs are not logged anywhere.
import { env } from '../config/env.js';
import { TOKEN_TTL_MINUTES, RESET_TTL_MINUTES } from '../utils/tokens.js';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10_000;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createMailer(config, fetchImpl = fetch) {
  const refuseConsoleInProduction = () => {
    if (config.nodeEnv === 'production') throw Object.assign(new Error('console mail transport refused'), { code: 'MAIL_CONSOLE_IN_PRODUCTION' });
  };

  async function deliver({ to, subject, htmlContent, textContent }) {
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

  async function sendVerificationEmail({ to, name, token }) {
    const link = `${config.appBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;

    if (config.transport === 'console') {
      refuseConsoleInProduction();
      console.log(`[mail:console] To: ${to}\n  Verify link (development only): ${link}`);
      return;
    }

    const textContent =
      `Hello ${name},\n\nConfirm your email address to activate your CampusMate account:\n${link}\n\n` +
      `The link expires in ${TOKEN_TTL_MINUTES} minutes and can be used once. If you did not register, ignore this email.\n`;
    const htmlContent =
      `<p>Hello ${escapeHtml(name)},</p>` +
      `<p><a href="${escapeHtml(link)}">Confirm your email address</a> to activate your CampusMate account.</p>` +
      `<p>The link expires in ${TOKEN_TTL_MINUTES} minutes and can be used once. If you did not register, ignore this email.</p>`;
    await deliver({ to, subject: 'Verify your CampusMate email address', htmlContent, textContent });
  }

  async function sendPasswordResetEmail({ to, name, token }) {
    const link = `${config.appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;

    if (config.transport === 'console') {
      refuseConsoleInProduction();
      console.log('[mail:console] Password reset email requested (link intentionally not printed; use the brevo transport to receive it).');
      return;
    }

    const textContent =
      `Hello ${name},\n\nWe received a request to reset your CampusMate password. Choose a new password here:\n${link}\n\n` +
      `The link expires in ${RESET_TTL_MINUTES} minutes and can be used once. If you did not ask for this, ignore this email; your password stays the same.\n`;
    const htmlContent =
      `<p>Hello ${escapeHtml(name)},</p>` +
      `<p>We received a request to reset your CampusMate password. <a href="${escapeHtml(link)}">Choose a new password</a>.</p>` +
      `<p>The link expires in ${RESET_TTL_MINUTES} minutes and can be used once. If you did not ask for this, ignore this email; your password stays the same.</p>`;
    await deliver({ to, subject: 'Reset your CampusMate password', htmlContent, textContent });
  }
  async function sendDeadlineReminderEmail({ to, taskId, taskTitle, dueDate, reminderKey }) {
    const urgency = reminderKey === 'overdue' ? 'is overdue' : `is due on ${dueDate}`;
    const link = `${config.appBaseUrl}/dashboard#task-${encodeURIComponent(taskId)}`;
    const textContent = `Your CampusMate task "${taskTitle}" ${urgency}. Review it: ${link}\n`;
    const htmlContent = `<p>Your CampusMate task <strong>${escapeHtml(taskTitle)}</strong> ${escapeHtml(urgency)}.</p><p><a href="${escapeHtml(link)}">Review task in CampusMate</a>.</p>`;
    if (config.transport === 'console') {
      refuseConsoleInProduction();
      console.log(`[mail:console] Deadline reminder for ${to}: ${taskTitle} (${reminderKey})`);
      return;
    }
    await deliver({ to, subject: `CampusMate deadline reminder: ${taskTitle}`, htmlContent, textContent });
  }
  return { sendVerificationEmail, sendPasswordResetEmail, sendDeadlineReminderEmail };
}

export const { sendVerificationEmail, sendPasswordResetEmail, sendDeadlineReminderEmail } = createMailer({ ...env.mail, nodeEnv: env.nodeEnv });
