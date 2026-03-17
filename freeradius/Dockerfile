FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install FreeRADIUS + PostgreSQL client + curl
RUN apt-get update && apt-get install -y \
    freeradius \
    freeradius-postgresql \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy configuration files
COPY radiusd.conf /etc/freeradius/3.0/radiusd.conf
COPY clients.conf /etc/freeradius/3.0/clients.conf
COPY mods-available/sql /etc/freeradius/3.0/mods-available/sql
COPY mods-available/rest /etc/freeradius/3.0/mods-available/rest

# Enable SQL and REST modules
RUN ln -sf /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-enabled/sql && \
    ln -sf /etc/freeradius/3.0/mods-available/rest /etc/freeradius/3.0/mods-enabled/rest 2>/dev/null || true

# Copy entrypoint script
COPY scripts/entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 1812/udp 1813/udp 3799/udp

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["freeradius", "-f", "-X"]
