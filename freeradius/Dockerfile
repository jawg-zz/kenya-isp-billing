FROM freeradius/freeradius:3.2

# Install PostgreSQL client for healthchecks
USER root
RUN apk add --no-cache postgresql-client

# Copy configuration files
COPY radiusd.conf /etc/raddb/radiusd.conf
COPY clients.conf /etc/raddb/clients.conf
COPY mods-enabled/sql /etc/raddb/mods-available/sql
RUN ln -sf /etc/raddb/mods-available/sql /etc/raddb/mods-enabled/sql

# Copy entrypoint script
COPY scripts/entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Fix permissions
RUN chown -R freerad:freerad /etc/raddb /var/log/radius /var/run/radiusd && \
    chmod 640 /etc/raddb/clients.conf /etc/raddb/mods-enabled/sql /etc/raddb/mods-available/sql

EXPOSE 1812/udp 1813/udp 3799/udp

ENTRYPOINT ["/docker-entrypoint.sh"]
