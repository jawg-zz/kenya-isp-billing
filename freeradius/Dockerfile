FROM alpine:3.19

# Install FreeRADIUS + PostgreSQL client
RUN apk add --no-cache \
    freeradius freeradius-sql-mod \
    postgresql-client \
    bash curl

# Create raddb directory structure
RUN mkdir -p /etc/raddb/mods-enabled /etc/raddb/sites-enabled \
    /var/log/radius/radacct /var/run/radiusd

# Copy configuration files
COPY radiusd.conf /etc/raddb/radiusd.conf
COPY clients.conf /etc/raddb/clients.conf
COPY mods-enabled/sql /etc/raddb/mods-available/sql
RUN ln -sf /etc/raddb/mods-available/sql /etc/raddb/mods-enabled/sql

# Copy entrypoint script
COPY scripts/entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Enable site defaults
RUN ln -sf /etc/raddb/sites-available/default /etc/raddb/sites-enabled/default 2>/dev/null || true && \
    ln -sf /etc/raddb/sites-available/inner-tunnel /etc/raddb/sites-enabled/inner-tunnel 2>/dev/null || true

# Fix permissions
RUN chown -R radius:radius /etc/raddb /var/log/radius /var/run/radiusd

EXPOSE 1812/udp 1813/udp 3799/udp

ENTRYPOINT ["/docker-entrypoint.sh"]
