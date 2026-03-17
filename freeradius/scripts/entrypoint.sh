#!/bin/bash
set -e

RADDIR="/etc/freeradius/3.0"
RADIUS_DB_HOST="${RADIUS_DB_HOST:-postgres}"
RADIUS_DB_PORT="${RADIUS_DB_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-isp_billing}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-isp_billing_password}"
POSTGRES_DB="${POSTGRES_DB:-isp_billing}"
RADIUS_SECRET="${RADIUS_SECRET:-changeme_use_strong_secret}"

export PGPASSWORD="${POSTGRES_PASSWORD}"

# Configure SQL module for PostgreSQL (Ubuntu default uses sqlite)
SQLCONF="${RADDIR}/mods-available/sql"
if [ -f "$SQLCONF" ]; then
    sed -i 's/driver = "rlm_sql_sqlite"/driver = "rlm_sql_postgresql"/' "$SQLCONF"
    sed -i 's/dialect = "sqlite"/dialect = "postgresql"/' "$SQLCONF"
    sed -i "s|path = \"/etc/freeradius/3.0/mods-config/sql/main/sqlite\"|path = \"/etc/freeradius/3.0/mods-config/sql/main/postgresql\"|" "$SQLCONF"
    sed -i "s/server = \"localhost\"/server = \"${RADIUS_DB_HOST}\"/" "$SQLCONF"
    sed -i "s/port = 3306/port = ${RADIUS_DB_PORT}/" "$SQLCONF"
    sed -i "s/login = \"radius\"/login = \"${POSTGRES_USER}\"/" "$SQLCONF"
    sed -i "s/password = \"radpass\"/password = \"${POSTGRES_PASSWORD}\"/" "$SQLCONF"
    sed -i "s/radius_db = \"radius\"/radius_db = \"${POSTGRES_DB}\"/" "$SQLCONF"
    sed -i 's/read_clients = no/read_clients = yes/' "$SQLCONF"
    echo "✅ SQL module configured for PostgreSQL"
fi

# Substitute environment variables into configs
sed -i "s|\${RADIUS_SECRET}|${RADIUS_SECRET}|g" "${RADDIR}/clients.conf"
sed -i "s|\${sql_server}|${RADIUS_DB_HOST}|g" "${RADDIR}/mods-enabled/sql" 2>/dev/null || true
sed -i "s|\${sql_port}|${RADIUS_DB_PORT}|g" "${RADDIR}/mods-enabled/sql" 2>/dev/null || true
sed -i "s|\${sql_login}|${POSTGRES_USER}|g" "${RADDIR}/mods-enabled/sql" 2>/dev/null || true
sed -i "s|\${sql_password}|${POSTGRES_PASSWORD}|g" "${RADDIR}/mods-enabled/sql" 2>/dev/null || true
sed -i "s|\${sql_radius_db}|${POSTGRES_DB}|g" "${RADDIR}/mods-enabled/sql" 2>/dev/null || true

# Substitute REST API URL
REST_API_URL="${REST_API_URL:-http://api:3000/api/v1}"
sed -i "s|\${rest_api_url}|${REST_API_URL}|g" "${RADDIR}/mods-enabled/rest" 2>/dev/null || true

echo "🔄 Waiting for PostgreSQL at ${RADIUS_DB_HOST}:${RADIUS_DB_PORT}..."
retries=30
until pg_isready -h "${RADIUS_DB_HOST}" -p "${RADIUS_DB_PORT}" -U "${POSTGRES_USER}" > /dev/null 2>&1; do
    retries=$((retries - 1))
    if [ $retries -le 0 ]; then
        echo "❌ PostgreSQL not available after 60s"
        exit 1
    fi
    sleep 2
done
echo "✅ PostgreSQL is ready"

echo "🔄 Creating FreeRADIUS tables..."
psql -h "${RADIUS_DB_HOST}" -p "${RADIUS_DB_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'EOSQL'

CREATE TABLE IF NOT EXISTS nas (
    id          SERIAL PRIMARY KEY,
    nasname     VARCHAR(128) NOT NULL,
    shortname   VARCHAR(32),
    type        VARCHAR(30) DEFAULT 'other',
    ports       INTEGER,
    secret      VARCHAR(60) NOT NULL DEFAULT 'secret',
    server      VARCHAR(64),
    community   VARCHAR(50),
    description VARCHAR(200) DEFAULT 'RADIUS Client'
);
CREATE INDEX IF NOT EXISTS nas_nasname ON nas(nasname);

CREATE TABLE IF NOT EXISTS radcheck (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(64) NOT NULL DEFAULT '',
    attribute   VARCHAR(64) NOT NULL DEFAULT '',
    op          VARCHAR(2) NOT NULL DEFAULT '==',
    value       VARCHAR(253) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS radcheck_username ON radcheck(username);

CREATE TABLE IF NOT EXISTS radreply (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(64) NOT NULL DEFAULT '',
    attribute   VARCHAR(64) NOT NULL DEFAULT '',
    op          VARCHAR(2) NOT NULL DEFAULT '==',
    value       VARCHAR(253) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS radreply_username ON radreply(username);

CREATE TABLE IF NOT EXISTS radgroupcheck (
    id          SERIAL PRIMARY KEY,
    groupname   VARCHAR(64) NOT NULL DEFAULT '',
    attribute   VARCHAR(64) NOT NULL DEFAULT '',
    op          VARCHAR(2) NOT NULL DEFAULT '==',
    value       VARCHAR(253) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS radgroupcheck_groupname ON radgroupcheck(groupname);

CREATE TABLE IF NOT EXISTS radgroupreply (
    id          SERIAL PRIMARY KEY,
    groupname   VARCHAR(64) NOT NULL DEFAULT '',
    attribute   VARCHAR(64) NOT NULL DEFAULT '',
    op          VARCHAR(2) NOT NULL DEFAULT '==',
    value       VARCHAR(253) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS radgroupreply_groupname ON radgroupreply(groupname);

CREATE TABLE IF NOT EXISTS radusergroup (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(64) NOT NULL DEFAULT '',
    groupname   VARCHAR(64) NOT NULL DEFAULT '',
    priority    INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS radusergroup_username ON radusergroup(username);

CREATE TABLE IF NOT EXISTS radacct (
    radacctid           BIGSERIAL PRIMARY KEY,
    acctsessionid       VARCHAR(64) NOT NULL DEFAULT '',
    acctuniqueid        VARCHAR(32) NOT NULL DEFAULT '',
    username            VARCHAR(64) NOT NULL DEFAULT '',
    realm               VARCHAR(64) DEFAULT '',
    nasipaddress        VARCHAR(15) NOT NULL DEFAULT '',
    nasportid           VARCHAR(32),
    nasporttype         VARCHAR(32),
    acctstarttime       TIMESTAMP WITH TIME ZONE,
    acctupdatetime      TIMESTAMP WITH TIME ZONE,
    acctstoptime        TIMESTAMP WITH TIME ZONE,
    acctinterval        INTEGER,
    acctsessiontime     BIGINT,
    acctinputoctets     BIGINT,
    acctoutputoctets    BIGINT,
    calledstationid     VARCHAR(50),
    callingstationid    VARCHAR(50),
    acctterminatecause  VARCHAR(32),
    servicetype         VARCHAR(32),
    framedprotocol      VARCHAR(32),
    framedipaddress     VARCHAR(15),
    framedipv6address   VARCHAR(45),
    framedipv6prefix    VARCHAR(45),
    framedinterfaceid   VARCHAR(44),
    delegatedipv6prefix VARCHAR(45)
);
CREATE INDEX IF NOT EXISTS radacct_username ON radacct(username);
CREATE INDEX IF NOT EXISTS radacct_acctsessionid ON radacct(acctsessionid);
CREATE INDEX IF NOT EXISTS radacct_acctuniqueid ON radacct(acctuniqueid);
CREATE INDEX IF NOT EXISTS radacct_nasipaddress ON radacct(nasipaddress);

-- Insert default NAS entries
INSERT INTO nas (nasname, shortname, type, secret, description)
SELECT 'localhost', 'localhost', 'other', '${RADIUS_SECRET}', 'Localhost NAS'
WHERE NOT EXISTS (SELECT 1 FROM nas WHERE nasname = 'localhost');

INSERT INTO nas (nasname, shortname, type, secret, description)
SELECT 'isp_billing_api', 'api', 'other', '${RADIUS_SECRET}', 'ISP Billing API'
WHERE NOT EXISTS (SELECT 1 FROM nas WHERE nasname = 'isp_billing_api');

EOSQL

echo "✅ FreeRADIUS tables ready"

echo "🚀 Starting FreeRADIUS in debug mode..."
exec freeradius -f -X
