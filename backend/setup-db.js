// Creates the database + tables by executing schema.sql.
// Connects WITHOUT a default database so the CREATE DATABASE runs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log('→ Running schema.sql ...');
  await conn.query(sql);
  await conn.end();
  console.log('✓ Database and tables ready.');
}

main().catch((err) => {
  console.error('✗ DB setup failed:', err.message);
  process.exit(1);
});
