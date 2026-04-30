import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { Resend } from 'resend';
import { accounts, magicLinks } from '@latent-space/db';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { env } from './env.js';
import { sessionStore } from './sessions.js';
import type { Db } from '@latent-space/db';

const getResend = () => new Resend(env.RESEND_API_KEY);

export async function authRoutes(app: FastifyInstance, db: Db) {
  // POST /auth/request — send magic link
  app.post<{ Body: { email: string } }>('/auth/request', {
    schema: { body: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } },
  }, async (req, reply) => {
    const { email } = req.body;
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.insert(magicLinks).values({
      id: nanoid(),
      email,
      token,
      expiresAt,
    });

    const link = `${env.MAGIC_LINK_BASE_URL}/auth/verify/${token}`;

    if (env.RESEND_API_KEY) {
      await getResend().emails.send({
        from: 'latent-space <noreply@humanstandard.io>',
        to: email,
        subject: 'your link to the rave',
        html: `<p>enter the room: <a href="${link}">${link}</a></p><p>link expires in 15 minutes.</p>`,
      });
    } else {
      // dev mode: log the link
      console.log(`[dev] magic link: ${link}`);
    }

    return reply.send({ ok: true });
  });

  // GET /auth/verify/:token — validate magic link, set session cookie
  app.get<{ Params: { token: string } }>('/auth/verify/:token', async (req, reply) => {
    const { token } = req.params;
    const now = new Date();

    const [link] = await db
      .select()
      .from(magicLinks)
      .where(
        and(
          eq(magicLinks.token, token),
          isNull(magicLinks.usedAt),
          gt(magicLinks.expiresAt, now),
        )
      );

    if (!link) {
      return reply.code(400).send({ error: 'invalid or expired link' });
    }

    // mark used
    await db.update(magicLinks).set({ usedAt: now }).where(eq(magicLinks.id, link.id));

    // find or create account
    let [account] = await db.select().from(accounts).where(eq(accounts.email, link.email));
    if (!account) {
      const id = nanoid();
      await db.insert(accounts).values({ id, email: link.email });
      [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    }

    // create session
    const sessionToken = nanoid(48);
    sessionStore.create(sessionToken, account!.id);

    reply.setCookie('session', sessionToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return reply.redirect(env.CLIENT_URL + '/');
  });

  // POST /auth/logout
  app.post('/auth/logout', async (req, reply) => {
    const token = req.cookies['session'];
    if (token) sessionStore.delete(token);
    reply.clearCookie('session', { path: '/' });
    return reply.send({ ok: true });
  });
}
