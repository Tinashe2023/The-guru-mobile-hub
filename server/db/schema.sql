-- ============================================
-- THE GURU MOBILE HUB — Database Schema
-- PostgreSQL (Neon)
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ───
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255),
  avatar_url VARCHAR(500),
  role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  google_id VARCHAR(255) UNIQUE,
  language_pref VARCHAR(5) DEFAULT 'en' CHECK (language_pref IN ('en', 'hi', 'pa')),
  phone VARCHAR(20),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── WebAuthn Credentials ───
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter BIGINT DEFAULT 0,
  device_type VARCHAR(50),
  backed_up BOOLEAN DEFAULT FALSE,
  transports TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Shop Status ───
CREATE TABLE IF NOT EXISTS shop_status (
  id SERIAL PRIMARY KEY,
  is_open BOOLEAN DEFAULT FALSE,
  open_time TIME DEFAULT '11:00:00',
  close_time TIME DEFAULT '21:30:00',
  banking_status VARCHAR(50) DEFAULT 'available'
    CHECK (banking_status IN ('available', 'app_down', 'network_issues', 'unavailable')),
  banking_message TEXT,
  recharge_airtel BOOLEAN DEFAULT TRUE,
  recharge_vi BOOLEAN DEFAULT TRUE,
  recharge_jio BOOLEAN DEFAULT TRUE,
  printing_status VARCHAR(50) DEFAULT 'available'
    CHECK (printing_status IN ('available', 'busy', 'offline')),
  custom_message TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- ─── Announcements (Broadcast Feed) ───
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  type VARCHAR(30) DEFAULT 'general'
    CHECK (type IN ('general', 'urgent', 'promotion', 'maintenance')),
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Conversations ───
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES users(id),
  subject VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Messages ───
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  content TEXT,
  message_type VARCHAR(20) DEFAULT 'text'
    CHECK (message_type IN ('text', 'file', 'image', 'system', 'sticker')),
  file_url VARCHAR(500),
  file_name VARCHAR(255),
  file_size INTEGER,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  original_content TEXT,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Message Reactions ───
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- ─── User Consents ───
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type VARCHAR(50) NOT NULL
    CHECK (consent_type IN ('document_storage', 'sim_docs', 'marketing')),
  accepted BOOLEAN DEFAULT FALSE,
  accepted_at TIMESTAMPTZ,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Documents (Personal Vault + Print Jobs) ───
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100),
  doc_type VARCHAR(30) DEFAULT 'personal'
    CHECK (doc_type IN ('personal', 'print_job', 'visa', 'efrro', 'id_card', 'other')),
  shared_with_admin BOOLEAN DEFAULT FALSE,
  auto_delete_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Repair Tickets ───
CREATE TABLE IF NOT EXISTS repair_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number VARCHAR(20) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('phone', 'laptop', 'tablet', 'other')),
  device_brand VARCHAR(100),
  device_model VARCHAR(100),
  issue_description TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'received'
    CHECK (status IN ('received', 'diagnosing', 'waiting_parts', 'repairing', 'testing', 'ready', 'completed', 'cancelled')),
  estimated_cost DECIMAL(10,2),
  final_cost DECIMAL(10,2),
  estimated_completion TIMESTAMPTZ,
  photos TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Repair Updates ───
CREATE TABLE IF NOT EXISTS repair_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES repair_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  old_status VARCHAR(30),
  new_status VARCHAR(30),
  note TEXT,
  is_customer_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Services Catalog ───
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  name_hi VARCHAR(100),
  name_pa VARCHAR(100),
  description TEXT,
  description_hi TEXT,
  description_pa TEXT,
  category VARCHAR(50) NOT NULL
    CHECK (category IN ('recharge', 'sim', 'printing', 'photo', 'money_transfer', 'repair', 'other')),
  price DECIMAL(10,2),
  price_unit VARCHAR(20) DEFAULT 'per_service',
  is_available BOOLEAN DEFAULT TRUE,
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Products Catalog ───
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(150) NOT NULL,
  name_hi VARCHAR(150),
  name_pa VARCHAR(150),
  description TEXT,
  category VARCHAR(50) NOT NULL
    CHECK (category IN ('smartwatch', 'earbuds', 'speaker', 'charger', 'phone', 'power_bank', 'accessory', 'stationery')),
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  image_url VARCHAR(500),
  is_available BOOLEAN DEFAULT TRUE,
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_customer ON repair_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_status ON repair_tickets(status);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_auto_delete ON documents(auto_delete_at);
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);

-- ─── Seed Initial Shop Status ───
INSERT INTO shop_status (is_open, open_time, close_time, banking_status, recharge_airtel, recharge_vi, recharge_jio, printing_status)
VALUES (true, '11:00:00', '21:30:00', 'available', true, true, true, 'available')
ON CONFLICT DO NOTHING;

-- ─── Seed Services ───
INSERT INTO services (name, name_hi, name_pa, category, price, price_unit, icon, sort_order) VALUES
  ('Mobile Recharge (Airtel)', 'मोबाइल रिचार्ज (एयरटेल)', 'ਮੋਬਾਈਲ ਰੀਚਾਰਜ (ਏਅਰਟੈੱਲ)', 'recharge', NULL, 'varies', 'sim_card', 1),
  ('Mobile Recharge (VI)', 'मोबाइल रिचार्ज (VI)', 'ਮੋਬਾਈਲ ਰੀਚਾਰਜ (VI)', 'recharge', NULL, 'varies', 'sim_card', 2),
  ('Mobile Recharge (Jio)', 'मोबाइल रिचार्ज (जिओ)', 'ਮੋਬਾਈਲ ਰੀਚਾਰਜ (ਜਿਓ)', 'recharge', NULL, 'varies', 'sim_card', 3),
  ('New SIM Card', 'नया सिम कार्ड', 'ਨਵਾਂ ਸਿਮ ਕਾਰਡ', 'sim', 200.00, 'per_service', 'add_card', 4),
  ('SIM Extension (VISA Renewal)', 'सिम एक्सटेंशन (वीसा नवीनीकरण)', 'ਸਿਮ ਐਕਸਟੈਂਸ਼ਨ (ਵੀਜ਼ਾ ਰੀਨਿਊਅਲ)', 'sim', 100.00, 'per_service', 'assignment_ind', 5),
  ('B/W Printing', 'श्वेत-श्याम प्रिंटिंग', 'ਕਾਲੀ/ਚਿੱਟੀ ਪ੍ਰਿੰਟਿੰਗ', 'printing', 3.00, 'per_page', 'print', 6),
  ('Color Printing', 'रंगीन प्रिंटिंग', 'ਰੰਗੀਨ ਪ੍ਰਿੰਟਿੰਗ', 'printing', 10.00, 'per_page', 'print', 7),
  ('Photocopying', 'फोटोकॉपी', 'ਫੋਟੋਕਾਪੀ', 'printing', 2.00, 'per_page', 'content_copy', 8),
  ('Lamination', 'लेमिनेशन', 'ਲੈਮੀਨੇਸ਼ਨ', 'printing', 30.00, 'per_service', 'layers', 9),
  ('Passport Size Photos', 'पासपोर्ट साइज फोटो', 'ਪਾਸਪੋਰਟ ਸਾਈਜ਼ ਫੋਟੋ', 'photo', 50.00, 'per_set', 'photo_camera', 10),
  ('UPI Money Transfer', 'UPI पैसे ट्रांसफर', 'UPI ਪੈਸੇ ਟ੍ਰਾਂਸਫਰ', 'money_transfer', 10.00, 'per_transaction', 'payments', 11),
  ('Direct Bank Transfer (NRO)', 'बैंक ट्रांसफर (NRO)', 'ਬੈਂਕ ਟ੍ਰਾਂਸਫਰ (NRO)', 'money_transfer', 25.00, 'per_transaction', 'account_balance', 12),
  ('Phone Repair', 'फोन रिपेयर', 'ਫ਼ੋਨ ਮੁਰੰਮਤ', 'repair', 200.00, 'starting_from', 'phone_android', 13),
  ('Laptop Repair', 'लैपटॉप रिपेयर', 'ਲੈਪਟਾਪ ਮੁਰੰਮਤ', 'repair', 500.00, 'starting_from', 'laptop_mac', 14)
ON CONFLICT DO NOTHING;
