FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install FreeRADIUS + PostgreSQL client (no REST module needed)
RUN apt-get update && apt-get install -y \
    freeradius \
    freeradius-postgresql \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Remove EAP module (not needed for PAP, causes ${max_requests} error)
# Remove REST module (not installed, not needed)
RUN rm -f /etc/freeradius/3.0/mods-enabled/eap \
          /etc/freeradius/3.0/mods-enabled/rest \
          /etc/freeradius/3.0/mods-available/rest

# Copy custom configuration files
COPY radiusd.conf /etc/freeradius/3.0/radiusd.conf
COPY clients.conf /etc/freeradius/3.0/clients.conf
COPY mods-available/sql /etc/freeradius/3.0/mods-available/sql

# Enable SQL module
RUN ln -sf /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-enabled/sql

# Copy entrypoint script
COPY scripts/entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 1812/udp 1813/udp 3799/udp

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["freeradius", "-f", "-X"]
