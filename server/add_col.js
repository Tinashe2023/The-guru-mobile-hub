import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('ALTER TABLE conversations ADD COLUMN admin_id UUID REFERENCES users(id)')
  .then(() => console.log('added'))
  .catch(e => console.log('error', e.message))
  .finally(() => pool.end());
