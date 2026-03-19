# ============================================================================
# MikroTik RADIUS Integration Script - Clean Slate Version
# ============================================================================
# Configures a blank MikroTik (no default config) with:
# - WiFi Hotspot (captive portal for wireless customers)
# - PPPoE Server (for wired Ethernet customers)
# - RADIUS authentication (FreeRADIUS on 10.8.0.1)
# - Speed limiting via RADIUS attributes
#
# Prerequisites:
# - RouterOS 7.x (after reset with NO default configuration)
# - WireGuard server running (vpn.spidmax.win:51820)
# - FreeRADIUS running on docker at 10.8.0.1
#
# Usage:
# 1. Edit the variables at the top (RADIUS_SECRET, WIFI_SSID, WG keys)
# 2. Generate WireGuard keys on MikroTik: /interface wireguard generate private-key
# 3. Get the public key and add it to your WireGuard server
# 4. Reset MikroTik with "No Default Configuration"
# 5. Set admin password: /user set admin password=YourPassword
# 6. Paste this entire script
# ============================================================================

# ---------------------------
# 0. SETUP VARIABLES - EDIT THESE BEFORE PASTING
# ---------------------------
:local RADIUS_SECRET "CHANGE_ME_TO_YOUR_RADIUS_SECRET"
:local WIFI_SSID "MyISP_Free_WiFi"
:local WAN_INTERFACE "ether1"
:local HOTSPOT_SERVER "https://isp.spidmax.win/hotspot/login.html"

# WireGuard VPN - Already configured on server
:local WG_PRIVATE_KEY "YAN9JhoH1Y/ps+5FaDXjUQC7KDOjA8n8hwu/f2moLk4="
:local WG_PEER_PUBKEY "L8bc5vXPX2zQHzpmd+qHwA2HAMYTi0uzvwiYFeB+ekw="
:local WG_ENDPOINT "vpn.spidmax.win"
:local WG_PRESHARED_KEY "4Cntf94sI7Igv64iAWx2B77/qMc5FOyr1cYyZvTd+Qo="

# ---------------------------
# 1. Basic Network Setup
# ---------------------------
/interface bridge add name=bridge disabled=no

# Add all Ethernet ports except WAN to bridge
:foreach i in=[/interface ethernet find] do={
  :local name [/interface ethernet get $i name]
  :if ($name != $WAN_INTERFACE) do={
    /interface bridge port add bridge=bridge interface=$name
  }
}

/ip address add address=192.168.88.1/24 interface=bridge comment="LAN"

# ---------------------------
# 1b. WireGuard VPN (tunnel to RADIUS server)
# ---------------------------
# Generate private key on MikroTik: /interface wireguard generate private-key
# Then paste the private key below (remove the example and use actual key)
/interface wireguard add name=wg-vpn \
  private-key=$WG_PRIVATE_KEY \
  listen-port=51820 \
  mtu=1420

# Add peer (your WireGuard server)
/interface wireguard peers add interface=wg-vpn \
  public-key=$WG_PEER_PUBKEY \
  endpoint-address=$WG_ENDPOINT \
  preshared-key=$WG_PRESHARED_KEY \
  persistent-keepalive=25s \
  allowed-address=10.8.0.0/24

# Assign IP to WireGuard interface
/ip address add address=10.8.0.2/24 interface=wg-vpn comment="WireGuard to RADIUS server"

# ---------------------------
# 2. WAN Configuration
# ---------------------------
/ip dhcp-client add interface=$WAN_INTERFACE disabled=no comment="WAN"

/ip firewall nat add chain=srcnat out-interface=$WAN_INTERFACE action=masquerade

# ---------------------------
# 3. WiFi Configuration (Open - no password, captive portal handles auth)
# ---------------------------
/interface wireless set wlan1 mode=ap-bridge \
  band=2ghz-b/g/n \
  channel-width=20/40mhz-XX \
  ssid=$WIFI_SSID \
  security-profile=default \
  disabled=no

/interface bridge port add bridge=bridge interface=wlan1

# ---------------------------
# 4. DHCP Server (LAN - trusted devices, no auth)
# ---------------------------
/ip pool add name=dhcp-pool ranges=192.168.88.10-192.168.88.30

/ip dhcp-server add name=dhcp-local address-pool=dhcp-pool interface=bridge disabled=no

/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=192.168.88.1

# ---------------------------
# 5. RADIUS Client
# ---------------------------
/radius add service=hotspot,ppp \
  address=10.8.0.1 \
  secret=$RADIUS_SECRET \
  authentication-port=1812 \
  accounting-port=1813 \
  require-message-authentication=yes \
  src-address=10.8.0.2 \
  timeout=3000ms \
  tries=3 \
  disabled=no

/ppp aaa set use-radius=yes \
  radius-accounting=yes \
  interim-update=5m

# ---------------------------
# 6. Hotspot (WiFi customers) - Redirects to our web portal
# ---------------------------
/ip pool add name=hotspot-pool ranges=192.168.88.31-192.168.88.250

# Use external login page (our web server)
/ip hotspot profile add name=hotspot-radius \
  login-by=http-chap \
  use-radius=yes \
  radius-accounting=yes \
  interim-update=1d \
  http-redirect=yes \
  redirect-url=$HOTSPOT_SERVER

/ip hotspot add name=hotspot1 \
  interface=bridge \
  address-pool=hotspot-pool \
  profile=hotspot-radius \
  disabled=no \
  local-address=192.168.88.254

# ---------------------------
# 7. PPPoE Server (Wired customers)
# ---------------------------
/ppp profile add name=pppoe-radius \
  local-address=192.168.88.1 \
  remote-address=hotspot-pool \
  use-encryption=required \
  only-one=yes

/interface pppoe-server server add service-name=isp-pppoe \
  interface=bridge \
  default-profile=pppoe-radius \
  use-radius=yes \
  accounting=yes \
  disabled=no

# ---------------------------
# 8. Firewall Rules
# ---------------------------
# Allow RADIUS traffic to VPN server
/ip firewall filter add chain=forward \
  src-address=192.168.88.0/24 \
  dst-address=10.8.0.1 \
  protocol=udp \
  dst-port=1812,1813 \
  action=accept \
  comment="Allow RADIUS to VPN server"

# Allow Hotspot HTTP/HTTPS
/ip firewall filter add chain=input \
  protocol=tcp \
  dst-port=80,443 \
  in-interface=bridge \
  action=accept \
  comment="Allow Hotspot HTTP/HTTPS"

# ---------------------------
# 9. DNS
# ---------------------------
/ip dns set allow-remote-requests=yes
/ip dns static add name=router.lan address=192.168.88.1

# ---------------------------
# 10. Queue Tree (Global speed caps - optional)
# ---------------------------
/queue tree add name=global-down parent=global max-limit=100M priority=8 queue=default
/queue tree add name=global-up parent=global max-limit=50M priority=8 queue=default

# ============================================================================
# END OF SCRIPT
# ============================================================================
#
# What this creates:
# | Component       | IP Range            | Purpose                    |
# |-----------------|---------------------|----------------------------|
# | LAN Bridge      | 192.168.88.1        | Router management         |
# | Regular DHCP    | 192.168.88.10-200   | Trusted devices (no auth) |
# | Hotspot/PPPoE   | 192.168.88.210-250  | Customer auth required    |
# | WiFi            | $WIFI_SSID          | Wireless access point     |
# | WAN             | ether1 (DHCP)       | Internet connection       |
#
# Next steps:
# 1. Edit RADIUS_SECRET, WIFI_SSID, WIFI_PASSWORD at the top
# 2. Reset MikroTik with "No Default Configuration"
# 3. Set admin password: /user set admin password=YourPassword
# 4. Paste this script
# 5. Add test users to FreeRADIUS (see radius-users-seed.sql)
# 6. Test: /radius test username=testuser password=testpass server=10.8.0.1
#
# Troubleshooting:
# - No RADIUS response: Check WireGuard tunnel is up
# - WiFi not showing: Verify wlan1 is not disabled
# - Hotspot login page not redirecting: Check hotspot is enabled
# ============================================================================