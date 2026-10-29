// Single shared MySQL connection pool. All SQL goes through this (models only, later phases).
import mysql from 'mysql2/promise';
import { env } from './env.js';

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  dateStrings: true, // DATE columns come back as "YYYY-MM-DD" strings (no timezone shifts)
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 5000,
});

export default pool;
