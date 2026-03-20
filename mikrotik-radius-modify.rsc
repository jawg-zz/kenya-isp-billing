# ============================================================================
# MikroTik RADIUS Integration Script - Modify Existing Config
# ============================================================================
# Adds RADIUS integration to a router with default configuration.
# This script MODIFIES existing settings rather than starting fresh.
#
# This script will:
# - Add WireGuard VPN tunnel to RADIUS server
# - Add RADIUS client configuration  
# - Create WiFi Hotspot with RADIUS auth
# - Create PPPoE server with RADIUS auth
# - Configure PCQ for speed limiting
#
# Prerequisites:
# - RouterOS 7.x with default configuration
# - WireGuard server running at vpn.spidmax.win
# - FreeRADIUS running on docker at 10.8.0.1
#
# Usage:
# 1. Edit variables at the top (RADIUS_SECRET, WIFI_SSID)
# 2. Upload via Winbox > Files > /import file-name=mikrotik-radius-modify.rsc
# ============================================================================

# ---------------------------
# 0. SETUP VARIABLES - EDIT THESE
# ---------------------------
:local RADIUS_SECRET "CHANGE_ME"
:local WIFI_SSID "spidmax-wifi"

# WireGuard VPN - Already configured on server
:local WG_PRIVATE_KEY "YAN9JhoH1Y/ps+5FaDXjUQC7KDOjA8n8hwu/f2moLk4="
:local WG_PEER_PUBKEY "L8bc5vXPX2zQHzpmd+qHwA2HAMYTi0uzvwiYFeB+ekw="
:local WG_ENDPOINT "vpn.spidmax.win:51820"
:local WG_PRESHARED_KEY "4Cntf94sI7Igv64iAWx2B77/qMc5FOyr1cYyZvTd+Qo="

# ---------------------------
# 1. WireGuard VPN (Tunnel to RADIUS)
# ---------------------------
/interface wireguard add name=wg-vpn private-key=$WG_PRIVATE_KEY listen-port=51820 mtu=1420

/interface wireguard peers add interface=wg-vpn public-key=$WG_PEER_PUBKEY endpoint-address=$WG_ENDPOINT preshared-key=$WG_PRESHARED_KEY persistent-keepalive=25s allowed-address=10.8.0.0/24

/ip address add address=10.8.0.2/24 interface=wg-vpn comment="WireGuard to RADIUS server"

# ---------------------------
# 2. RADIUS Client
# ---------------------------
/radius add service=hotspot,ppp address=10.8.0.1 secret=$RADIUS_SECRET authentication-port=1812 accounting-port=1813 src-address=10.8.0.2 timeout=3000ms tries=3 disabled=no

/ppp aaa set use-radius=yes radius-accounting=yes interim-update=5m

# ---------------------------
# 3. WiFi Configuration (ROS 7.x)
# ---------------------------
/interface wifi channel add name=ch-2ghz band=2ghz-n/ac channel-width=20/40mhz-ce frequency=2437

/interface wifi security add name=open-sec authentication-types=none

/interface wifi add name=wifi1 ssid=$WIFI_SSID security=open-sec disabled=no channel=ch-2ghz

/interface bridge port add bridge=bridge interface=wifi1

# ---------------------------
# 4. DHCP Pools for Services
# ---------------------------
/ip pool add name=hotspot-pool ranges=192.168.88.31-192.168.88.199
/ip pool add name=pppoe-pool ranges=192.168.88.200-192.168.88.250

# ---------------------------
# 5. Hotspot (WiFi customers)
# ---------------------------
/ip hotspot profile add name=hotspot-radius login-by=http-chap use-radius=yes radius-accounting=yes interim-update=1d rate-limit=""

/ip hotspot add name=hotspot1 interface=bridge address-pool=hotspot-pool profile=hotspot-radius disabled=no local-address=192.168.88.1

# ---------------------------
# 6. PPPoE Server (Wired customers)
# ---------------------------
/ppp profile add name=pppoe-radius local-address=192.168.88.1 remote-address=pppoe-pool use-encryption=required only-one=yes rate-limit=""

/interface pppoe-server server add service-name=isp-pppoe interface=bridge default-profile=pppoe-radius use-radius=yes accounting=yes disabled=no

# ---------------------------
# 7. Queue Types (PCQ)
# ---------------------------
/queue type add name=pcq-download kind=pcq pcq-rate=0 pcq-classifier=dst-address
/queue type add name=pcq-upload kind=pcq pcq-rate=0 pcq-classifier=src-address

# ---------------------------
# 8. Firewall Rules for RADIUS
# ---------------------------
/ip firewall filter add chain=output dst-address=10.8.0.1 protocol=udp dst-port=1812,1813 action=accept comment="Allow RADIUS"

# ============================================================================
# END OF SCRIPT
# ============================================================================
