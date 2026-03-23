import bcrypt from 'bcryptjs';

const h1 = await bcrypt.hash('Himanshi123', 12);
const h2 = await bcrypt.hash('Guru123', 12);

console.log(`-- Run this SQL in your Neon Console SQL Editor:`);
console.log(``);
console.log(`INSERT INTO users (email, name, password_hash, role, is_verified) VALUES`);
console.log(`  ('himanshi@gurumobilehub.com', 'Himanshi', '${h1}', 'admin', true),`);
console.log(`  ('guru@gurumobilehub.com', 'Guru', '${h2}', 'admin', true)`);
console.log(`ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash;`);
