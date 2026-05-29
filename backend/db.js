import mysql from 'mysql2/promise';
import 'dotenv/config';

// Shared connection pool. The DB name is included so every query
// runs against the trooper_site schema.
export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'trooper_site',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

// Small helper so routes can do `const rows = await q('SELECT ...', [..])`.
export async function q(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
