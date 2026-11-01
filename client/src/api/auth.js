import { request } from './client.js';

// A 401 from these three is an expected answer (not logged in, wrong password), so it is not routed to the global handler.
const expect401 = { skipUnauthorizedHandler: true };

export const fetchCurrentUser = async () => (await request('GET', '/api/auth/me', expect401)).user;
export const loginRequest = async (email, password) => (await request('POST', '/api/auth/login', { body: { email, password }, ...expect401 })).user;
// T-075: register creates an UNVERIFIED account and starts no session; the reply is { message } only.
export const registerRequest = (name, email, password) => request('POST', '/api/auth/register', { body: { name, email, password }, ...expect401 });
export const logoutRequest = () => request('POST', '/api/auth/logout');
// T-075: resolves { message }, or throws ApiError (400 TOKEN_INVALID_OR_EXPIRED for every bad token, 429 RATE_LIMITED).
export const verifyEmailRequest = (token) => request('POST', '/api/auth/verify-email', { body: { token }, ...expect401 });
// T-075: always 202 { message } whether or not the account exists; throws ApiError for 400 VALIDATION_ERROR and 429 RATE_LIMITED.
export const resendVerificationRequest = (email) => request('POST', '/api/auth/resend-verification', { body: { email }, ...expect401 });
