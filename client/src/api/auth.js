import { request } from './client.js';

// A 401 from these three is an expected answer (not logged in, wrong password), so it is not routed to the global handler.
const expect401 = { skipUnauthorizedHandler: true };

export const fetchCurrentUser = async () => (await request('GET', '/api/auth/me', expect401)).user;
export const loginRequest = async (email, password) => (await request('POST', '/api/auth/login', { body: { email, password }, ...expect401 })).user;
export const registerRequest = async (name, email, password) => (await request('POST', '/api/auth/register', { body: { name, email, password }, ...expect401 })).user;
export const logoutRequest = () => request('POST', '/api/auth/logout');