-- ============================================================================
-- RADIUS User Seed Data
-- ============================================================================
-- Run this SQL against your PostgreSQL database to create test users.
-- These users will authenticate via FreeRADIUS and receive speed limits
-- from the MikroTik router.
--
-- IMPORTANT: Run each plan block only once. To reset, DELETE the relevant
-- rows from radgroupreply/radcheck/radusergroup first.
--
-- Usage:
--   docker compose exec postgres psql -U isp_billing -d isp_billing \
--     -f /dev/stdin < radius-users-seed.sql
-- ============================================================================

-- ============================================================================
-- SPEED PROFILE DEFINITIONS (radgroupreply — per-group reply attributes)
-- ============================================================================

-- Basic plan: 5 Mbps down / 2 Mbps up
INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES
  ('basic', 'Mikrotik-Rate-Limit',          ':=', '5M/2M'),
  ('basic', 'Session-Timeout',              ':=', '86400'),      -- 24 hours
  ('basic', 'Idle-Timeout',                 ':=', '600'),        -- 10 min idle
  ('basic', 'WISPr-Bandwidth-Max-Down',     ':=', '5000000'),    -- 5 Mbps bps
  ('basic', 'WISPr-Bandwidth-Max-Up',       ':=', '2000000');    -- 2 Mbps bps

-- Premium plan: 20 Mbps down / 10 Mbps up
INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES
  ('premium', 'Mikrotik-Rate-Limit',        ':=', '20M/10M'),
  ('premium', 'Session-Timeout',            ':=', '86400'),
  ('premium', 'Idle-Timeout',               ':=', '600'),
  ('premium', 'WISPr-Bandwidth-Max-Down',   ':=', '20000000'),
  ('premium', 'WISPr-Bandwidth-Max-Up',     ':=', '10000000');

-- Enterprise plan: 50 Mbps down / 25 Mbps up (no session limit)
INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES
  ('enterprise', 'Mikrotik-Rate-Limit',          ':=', '50M/25M'),
  ('enterprise', 'Session-Timeout',              ':=', '0'),       -- unlimited
  ('enterprise', 'Idle-Timeout',                 ':=', '1800'),    -- 30 min idle
  ('enterprise', 'WISPr-Bandwidth-Max-Down',     ':=', '50000000'),
  ('enterprise', 'WISPr-Bandwidth-Max-Up',       ':=', '25000000');

-- ============================================================================
-- TEST USERS
-- ============================================================================

-- Test user 1: Basic plan subscriber (5M/2M)
INSERT INTO radcheck (username, attribute, op, value) VALUES
  ('testuser_basic', 'Cleartext-Password', ':=', 'Basic@2024!');

INSERT INTO radusergroup (username, groupname, priority) VALUES
  ('testuser_basic', 'basic', 1);

-- Test user 2: Premium plan subscriber (20M/10M)
INSERT INTO radcheck (username, attribute, op, value) VALUES
  ('testuser_premium', 'Cleartext-Password', ':=', 'Premium@2024!');

INSERT INTO radusergroup (username, groupname, priority) VALUES
  ('testuser_premium', 'premium', 1);

-- Test user 3: Enterprise plan subscriber (50M/25M)
INSERT INTO radcheck (username, attribute, op, value) VALUES
  ('testuser_enterprise', 'Cleartext-Password', ':=', 'Enterprise@2024!');

INSERT INTO radusergroup (username, groupname, priority) VALUES
  ('testuser_enterprise', 'enterprise', 1);

-- ============================================================================
-- PER-USER OVERRIDE EXAMPLE (radreply — overrides group attributes)
-- ============================================================================
-- If you need to override a specific user's speed without changing their group:

-- Example: Boost testuser_basic to 10Mbps temporarily
-- INSERT INTO radreply (username, attribute, op, value) VALUES
--   ('testuser_basic', 'Mikrotik-Rate-Limit', ':=', '10M/5M');

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- SELECT username, groupname FROM radusergroup;
-- SELECT * FROM radgroupreply WHERE groupname = 'basic';
-- SELECT * FROM radcheck WHERE username LIKE 'testuser%';
--
-- TEST from MikroTik terminal:
-- /radius test username=testuser_basic password=Basic@2024! server=10.8.0.1
-- /radius test username=testuser_premium password=Premium@2024! server=10.8.0.1
-- ============================================================================
