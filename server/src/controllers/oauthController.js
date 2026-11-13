import { randomBytes, timingSafeEqual } from 'node:crypto';
import express from 'express';
import AppError from '../utils/AppError.js';
import { env } from '../config/env.js';
import { createOAuthService, getAppleProfile } from '../services/oauthService.js';
import { createOAuthUser, findByOAuthIdentity, findByEmail } from '../models/userModel.js';
import { startSession } from './authController.js';

const oauth = createOAuthService(env.oauth);
const MAX_AGE_MS = 10 * 60 * 1000;
const failure = () => new AppError(400, 'OAUTH_FAILED', 'Sign-in could not be completed. Please try again.');

function save(req) {
  return new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
}

export function start(provider) {
  return async (req, res) => {
    try {
      const { verifier, challenge } = oauth.pkce();
      const state = randomBytes(32).toString('base64url');
      const nonce = randomBytes(32).toString('base64url');
      if (provider === 'apple') {
        req.session.cookie.sameSite = 'none';
        req.session.cookie.secure = true;
      }
      req.session.oauth = { provider, state, nonce, verifier, createdAt: Date.now() };
      await save(req);
      res.redirect(oauth.createAuthorizationRequest(provider, state, nonce, challenge));
    } catch (err) {
      console.error(`OAuth ${provider} start failed (${err.code || err.name || 'UNKNOWN'})`);
      res.redirect('/login?oauth_error=1');
    }
  };
}

export function callback(provider) {
  return async (req, res) => {
    const pending = req.session.oauth;
    delete req.session.oauth;
    req.session.cookie.sameSite = 'lax';
    req.session.cookie.secure = env.nodeEnv === 'production';
    await save(req);
    try {
      if (!pending || pending.provider !== provider || Date.now() - pending.createdAt > MAX_AGE_MS || typeof req.query.state !== 'string' || !sameState(req.query.state, pending.state) || typeof req.query.code !== 'string') throw failure();
      const tokens = await oauth.exchangeCode(provider, req.query.code, pending.verifier);
      const claims = await oauth.verifyIdToken(provider, tokens.id_token, pending.nonce);
      if ((provider === 'google' && claims.email_verified !== true) || (provider === 'apple' && claims.email_verified !== true && claims.email_verified !== 'true')) {
        throw Object.assign(failure(), { code: 'OAUTH_EMAIL_UNVERIFIED' });
      }
      const { email, name } = getAppleProfile(claims, provider === 'apple' ? req.body?.user : undefined);
      const existing = await findByOAuthIdentity(provider, claims.sub);
      if (existing) {
        await startSession(req, existing.id);
      } else {
        if (!email) throw Object.assign(failure(), { code: 'OAUTH_EMAIL_REQUIRED' });
        const emailAccount = await findByEmail(email);
        if (emailAccount) throw Object.assign(failure(), { code: 'OAUTH_ACCOUNT_LINK_REQUIRED' });
        const account = await createOAuthUser({ provider, subject: claims.sub, name: name || 'CampusMate user', email });
        await startSession(req, account.id);
      }
      res.redirect('/dashboard');
    } catch (err) {
      console.error(`OAuth ${provider} callback failed (${err.code || err.name || 'UNKNOWN'})`);
      res.redirect('/login?oauth_error=1');
    }
  };
}

export const appleBody = express.urlencoded({ extended: false });

function sameState(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
