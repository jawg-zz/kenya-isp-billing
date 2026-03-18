# ============================================================================
# MikroTik RADIUS Integration Script
# ============================================================================
# This script configures a MikroTik router (already connected via WireGuard VPN
# to vpn.spidmax.win:51820, assigned IP 10.8.0.2) to use RADIUS for:
#   - Hotspot authentication (captive portal for WiFi users)
#   - PPPoE authentication (optional, for wired connections)
#   - Rate-limiting via RADIUS attributes (Mikrotik-Rate-Limit)
#
# Prerequisites:
#   - RouterOS 7.x (tested on 7.12+)
#   - WireGuard VPN already configured and connected (see mikrotik-wireguard-vpn.rsc)
#   - Hotspot package installed (default on most MikroTik devices)
#   - RADIUS server reachable at 10.8.0.1 (WireGuard server side)
#
# Usage: Paste each section into the MikroTik terminal, or copy-paste the
#        entire script. Changes take effect immediately.
# ============================================================================

# ---------------------------
# 1. RADIUS Client Configuration
# ---------------------------
# Point the router to the FreeRADIUS server over WireGuard VPN

/radius
add service=hotspot \
    address=10.8.0.1 \
    secret="CHANGE_THIS_TO_MATCH_YOUR_RADIUS_SECRET" \
    authentication-port=1812 \
    accounting-port=1813 \
    require-message-authentication=yes \
    src-address=10.8.0.2 \
    timeout=3000ms \
    tries=3 \
    disabled=no

/ppp aaa
set use-radius=yes \
    radius-accounting=yes \
    interim-update=5m

# ---------------------------
# 2. Hotspot Configuration
# ---------------------------

# 2a. Create a local hotspot profile (uses RADIUS for auth)
/ip hotspot profile
add name="hotspot-radius" \
    html-directory=hotspot \
    login-by=http-chap,cookie \
    html-directory-override="" \
    hotspot-address=192.168.88.254 \
    dns-name="wifi.yourisp.com" \
    use-radius=yes \
    radius-accounting=yes \
    interim-update=1m \
    split-user-domain=no \
    generate-http-pages=no

# 2b. Create a hotspot instance on LAN interface
#     Replace "bridge" with your actual LAN bridge/interface name
/ip hotspot
add name="hotspot1" \
    interface=bridge \
    address-pool=hotspot-pool \
    profile="hotspot-radius" \
    disabled=no \
    local-address=192.168.88.254 \
    max-tcp-concurrent=16

# 2c. Define the IP pool for hotspot users
/ip pool
add name="hotspot-pool" \
    ranges=192.168.88.100-192.168.88.200

# ---------------------------
# 3. PPPoE Server (Optional — for wired subscribers)
# ---------------------------

# 3a. Create a PPPoE service profile that uses RADIUS
/ppp profile
add name="pppoe-radius" \
    local-address=192.168.88.1 \
    remote-address=hotspot-pool \
    use-encryption=required \
    use-mpls=no \
    only-one=yes \
    change-tcp-mss=yes

# 3b. Start PPPoE server on the LAN interface
#     Replace "ether2" with the WAN-facing port for wired subscribers
/interface pppoe-server server
add service-name="isp-pppoe" \
    interface=ether2 \
    default-profile="pppoe-radius" \
    use-radius=yes \
    accounting=yes \
    interim-update=5m \
    max-mtu=1480 \
    max-mru=1480 \
    disabled=no

# ---------------------------
# 4. Firewall Rules (if not already present)
# ---------------------------

# Allow RADIUS traffic from LAN to the VPN tunnel
/ip firewall filter
add chain=forward \
    src-address=192.168.88.0/24 \
    dst-address=10.8.0.1 \
    protocol=udp \
    dst-port=1812,1813 \
    action=accept \
    comment="Allow RADIUS to VPN server"

# Allow Hotspot traffic (HTTP/HTTPS redirect)
add chain=input \
    protocol=tcp \
    dst-port=80,443 \
    in-interface=bridge \
    action=accept \
    comment="Allow Hotspot HTTP/HTTPS"

# ---------------------------
# 5. Queue Tree for Rate Limiting (Complement to RADIUS attributes)
# ---------------------------
# RADIUS Mikrotik-Rate-Limit handles per-user limits.
# These are optional global caps.

/queue tree
add name="hotspot-down" \
    parent=global \
    max-limit=100M \
    priority=8 \
    queue=default

add name="hotspot-up" \
    parent=global \
    max-limit=50M \
    priority=8 \
    queue=default

# ---------------------------
# 6. Verify Configuration
# ---------------------------
# Run these commands to verify RADIUS is working:

# Check RADIUS status:
# /radius monitor 0

# Check active hotspot users:
# /ip hotspot active print

# Check active PPPoE sessions:
# /ppp active print

# Test RADIUS authentication manually:
# /radius test username=testuser password=testpass server=10.8.0.1

# ============================================================================
# END OF SCRIPT
# ============================================================================
#
# Next Steps:
#   1. Change the RADIUS secret above to match your .env RADIUS_SECRET
#   2. Ensure the FreeRADIUS container has clients.conf with this router's IP
#   3. Add test users to the radcheck/radreply tables (see radius-users-seed.sql)
#   4. Test with: /radius test username=testuser password=testpass server=10.8.0.1
#   5. Connect a device to WiFi → should see the hotspot login page
#
# Troubleshooting:
#   - "no response from server" → Check WireGuard tunnel: /interface wireguard peers print
#   - "authentication failed" → Verify shared secret matches in both places
#   - Users not getting speed limits → Check radreply table has Mikrotik-Rate-Limit
#   - Hotspot page not showing → Verify hotspot profile and interface assignment
# ============================================================================
