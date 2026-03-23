# MikroTik RADIUS Configuration for ISP Billing System
# Generated: 2026-03-23
# 
# INSTRUCTIONS:
# 1. Replace <BILLING_SYSTEM_IP> with your billing system's IP address
# 2. Replace <SHARED_SECRET> with a strong secret (must match NAS registration)
# 3. Adjust IP pools and interface names for your network
# 4. Run this script via: /import mikrotik-radius-setup.rsc

# ============================================
# RADIUS CLIENT CONFIGURATION
# ============================================

# Add RADIUS server for authentication and accounting
/radius
add address=<BILLING_SYSTEM_IP> \
    secret=<SHARED_SECRET> \
    service=ppp,hotspot,login \
    timeout=3s \
    comment="ISP Billing System RADIUS"

# Enable RADIUS for PPPoE authentication
/ppp aaa
set accounting=yes \
    interim-update=5m \
    use-radius=yes

# Enable incoming RADIUS CoA (Change of Authorization)
# This allows the billing system to disconnect users or change speed limits
/radius incoming
set accept=yes

# ============================================
# PPPoE SERVER CONFIGURATION
# ============================================

# Create IP pool for PPPoE clients
/ip pool
add name=pppoepool ranges=10.10.10.2-10.10.10.254 comment="PPPoE Client Pool"

# Create PPPoE profile with RADIUS
/ppp profile
add name=pppoe-radius \
    local-address=10.10.10.1 \
    remote-address=pppoepool \
    use-compression=no \
    use-encryption=no \
    use-mpls=no \
    use-upnp=no \
    only-one=yes \
    comment="PPPoE Profile with RADIUS"

# Enable PPPoE server on your LAN interface
# Replace 'ether2' with your actual LAN interface
/interface pppoe-server server
add authentication=pap,chap,mschap1,mschap2 \
    default-profile=pppoe-radius \
    disabled=no \
    interface=ether2 \
    keepalive-timeout=60 \
    max-mru=1480 \
    max-mtu=1480 \
    mrru=disabled \
    service-name=ISP \
    comment="PPPoE Server for RADIUS"

# ============================================
# HOTSPOT CONFIGURATION (OPTIONAL)
# ============================================

# Create IP pool for Hotspot clients
/ip pool
add name=hotspotpool ranges=10.20.20.2-10.20.20.254 comment="Hotspot Client Pool"

# Create Hotspot profile with RADIUS
/ip hotspot profile
add name=hotspot-radius \
    dns-name=login.isp.local \
    hotspot-address=10.20.20.1 \
    html-directory=hotspot \
    http-cookie-lifetime=1d \
    http-proxy=0.0.0.0:0 \
    login-by=http-chap,http-pap \
    name=hotspot-radius \
    rate-limit="" \
    smtp-server=0.0.0.0 \
    split-user-domain=no \
    use-radius=yes \
    comment="Hotspot Profile with RADIUS"

# Create Hotspot server profile
/ip hotspot server profile
set [find name=hotspot-radius] \
    login-by=http-chap,http-pap,cookie \
    use-radius=yes

# Setup Hotspot on interface (replace 'ether3' with your hotspot interface)
# Uncomment and configure if using Hotspot:
# /ip hotspot setup
# hotspot-interface: ether3
# local-address: 10.20.20.1
# address-pool: hotspotpool
# certificate: none
# smtp-server: 0.0.0.0
# dns-server: 8.8.8.8
# dns-name: login.isp.local
# profile: hotspot-radius

# ============================================
# RADIUS ACCOUNTING CONFIGURATION
# ============================================

# Configure accounting intervals
/radius
set [find address=<BILLING_SYSTEM_IP>] \
    accounting-backup=no \
    accounting-port=1813 \
    authentication-port=1812 \
    called-id="" \
    domain="" \
    realm="" \
    src-address=0.0.0.0

# ============================================
# FIREWALL RULES FOR RADIUS
# ============================================

# Allow RADIUS traffic from billing system
/ip firewall filter
add action=accept \
    chain=input \
    comment="Allow RADIUS Auth from Billing System" \
    dst-port=1812 \
    protocol=udp \
    src-address=<BILLING_SYSTEM_IP>

add action=accept \
    chain=input \
    comment="Allow RADIUS Accounting from Billing System" \
    dst-port=1813 \
    protocol=udp \
    src-address=<BILLING_SYSTEM_IP>

add action=accept \
    chain=input \
    comment="Allow RADIUS CoA from Billing System" \
    dst-port=3799 \
    protocol=udp \
    src-address=<BILLING_SYSTEM_IP>

# ============================================
# RATE LIMITING CONFIGURATION
# ============================================

# MikroTik will receive rate limits from RADIUS via MikroTik-Rate-Limit attribute
# Format: <upload-rate>/<download-rate>
# Example: 10000000/10000000 (10 Mbps up/down)

# Create queue tree for RADIUS-based rate limiting (optional, for advanced setups)
# /queue tree
# add name=radius-upload parent=global queue=default
# add name=radius-download parent=global queue=default

# ============================================
# LOGGING CONFIGURATION
# ============================================

# Enable RADIUS logging for troubleshooting
/system logging
add action=memory \
    prefix="RADIUS" \
    topics=radius,debug

# ============================================
# TESTING COMMANDS
# ============================================

# After configuration, test with these commands:
# 
# 1. Check RADIUS server status:
#    /radius print detail
#
# 2. Monitor RADIUS authentication attempts:
#    /log print where topics~"radius"
#
# 3. View active PPPoE sessions:
#    /ppp active print
#
# 4. View active Hotspot sessions:
#    /ip hotspot active print
#
# 5. Test RADIUS authentication manually:
#    /radius incoming monitor
#
# 6. Check if CoA is working:
#    /radius incoming print
#
# 7. View current rate limits applied:
#    /queue simple print

# ============================================
# TROUBLESHOOTING
# ============================================

# If authentication fails:
# 1. Check RADIUS server is reachable: /ping <BILLING_SYSTEM_IP>
# 2. Verify shared secret matches NAS registration
# 3. Check firewall rules allow UDP 1812, 1813, 3799
# 4. Review logs: /log print where topics~"radius"
# 5. Verify customer has active subscription in billing system
# 6. Check RADIUS user is active: GET /api/v1/radius/customers/<customer-id>

# If CoA doesn't work:
# 1. Verify /radius incoming accept=yes
# 2. Check firewall allows UDP 3799 from billing system
# 3. Test with: /radius incoming monitor
# 4. Check billing system logs for CoA send confirmation

# If speed limits not applied:
# 1. Verify plan has speedLimit set in billing system
# 2. Check radgroupreply table has MikroTik-Rate-Limit attribute
# 3. Sync plans to RADIUS: POST /api/v1/radius/plans/sync
# 4. Check user is in correct plan group: radusergroup table

# ============================================
# SECURITY RECOMMENDATIONS
# ============================================

# 1. Use a strong shared secret (32+ characters, random)
# 2. Restrict RADIUS traffic to billing system IP only (firewall rules above)
# 3. Use encrypted PPPoE (mschap2) when possible
# 4. Enable RADIUS accounting to track all sessions
# 5. Regularly review active sessions and disconnect stale ones
# 6. Monitor RADIUS logs for failed authentication attempts
# 7. Keep MikroTik RouterOS updated to latest stable version

# ============================================
# NEXT STEPS
# ============================================

# 1. Register this MikroTik as NAS device in billing system:
#    POST /api/v1/radius/nas
#    {
#      "nasname": "<MIKROTIK_IP>",
#      "shortname": "mikrotik-main",
#      "type": "mikrotik",
#      "secret": "<SHARED_SECRET>",
#      "ports": 1812
#    }
#
# 2. Create test customer and subscription in billing system
#
# 3. Get RADIUS credentials:
#    GET /api/v1/radius/customers/<customer-id>
#
# 4. Test PPPoE login with returned username/password
#
# 5. Verify session appears in billing system:
#    GET /api/v1/radius/sessions
#
# 6. Test payment flow and verify CoA updates speed/disconnects

# ============================================
# CONFIGURATION COMPLETE
# ============================================

:log info "MikroTik RADIUS configuration loaded. Remember to:"
:log info "1. Replace <BILLING_SYSTEM_IP> with actual IP"
:log info "2. Replace <SHARED_SECRET> with strong secret"
:log info "3. Adjust interface names (ether2, ether3) for your setup"
:log info "4. Register this MikroTik as NAS device in billing system"
:log info "5. Test with a customer account"
