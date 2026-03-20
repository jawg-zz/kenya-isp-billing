# ============================================================================
# MikroTik RADIUS Integration Script - Clean Slate Version (FIXED)
# ============================================================================
# Configures a blank MikroTik (no default config) with:
# - WireGuard VPN (tunnel to RADIUS server via vpn.spidmax.win)
# - WiFi Hotspot (captive portal for wireless customers)
# - PPPoE Server (for wired Ethernet customers)
# - RADIUS authentication (FreeRADIUS on 10.8.0.1)
# - Speed limiting via RADIUS attributes
#
# Prerequisites:
# - RouterOS 7.x (after reset with NO default configuration)
# - WireGuard server running at vpn.spidmax.win
# - FreeRADIUS running on docker at 10.8.0.1
#
# Usage:
# 1. Edit variables at the top (RADIUS_SECRET, WIFI_SSID, WLAN_INTERFACE)
# 2. Reset MikroTik with "No Default Configuration"
# 3. Set admin password: /user set admin password=YourPassword
# 4. Upload via Winbox > Files > /import file-name=mikrotik-radius-setup.rsc
# ============================================================================

# ---------------------------
# 0. SETUP VARIABLES - EDIT THESE
# ---------------------------
:local RADIUS_SECRET "CHANGE_ME"
:local WIFI_SSID "spidmax-wifi"
:local WAN_INTERFACE "ether1"
# Note: WiFi interface will be created as "wifi1"

# WireGuard VPN - Already configured on server
:local WG_PRIVATE_KEY "YAN9JhoH1Y/ps+5FaDXjUQC7KDOjA8n8hwu/f2moLk4="
:local WG_PEER_PUBKEY "L8bc5vXPX2zQHzpmd+qHwA2HAMYTi0uzvwiYFeB+ekw="
:local WG_ENDPOINT "vpn.spidmax.win:51820"
:local WG_PRESHARED_KEY "4Cntf94sI7Igv64iAWx2B77/qMc5FOyr1cYyZvTd+Qo="

# ---------------------------
# 1. Basic Network Setup
# ---------------------------
/interface bridge add name=bridge disabled=no protocol-mode=rstp comment="LAN bridge"

# Define interface lists for firewall
/interface list add name=LAN comment="LAN interfaces"
/interface list add name=WAN comment="WAN interfaces"

:foreach i in=[/interface ethernet find] do={
  :local name [/interface ethernet get $i name]
  :if ($name != $WAN_INTERFACE) do={
    /interface bridge port add bridge=bridge interface=$name
  }
}

/interface list member add list=LAN interface=bridge comment="LAN"

# Add WAN to WAN list (after dhcp-client is added)
# We'll add this at the end

/ip address add address=192.168.88.1/24 interface=bridge comment="LAN"

# ---------------------------
# 1b. WireGuard VPN
# ---------------------------
/interface wireguard add name=wg-vpn private-key=$WG_PRIVATE_KEY listen-port=51820 mtu=1420

/interface wireguard peers add interface=wg-vpn public-key=$WG_PEER_PUBKEY endpoint-address=$WG_ENDPOINT preshared-key=$WG_PRESHARED_KEY persistent-keepalive=25s allowed-address=10.8.0.0/24

/ip address add address=10.8.0.2/24 interface=wg-vpn comment="WireGuard to RADIUS server"

# ---------------------------
# 2. WAN Configuration
# ---------------------------
/ip dhcp-client add interface=$WAN_INTERFACE disabled=no comment="WAN"

/interface list member add list=WAN interface=$WAN_INTERFACE comment="WAN"

/ip firewall nat add chain=srcnat out-interface-list=WAN action=masquerade

# ---------------------------
# 3. WiFi Configuration (ROS 7.x)
# ---------------------------
# Define WiFi channel
/interface wifi channel add name=ch-2ghz band=2ghz-n/ac channel-width=20/40mhz-ce frequency=2437

# Create WiFi security profile (open - no password)
# For open hotspot, we use authentication-types=none
/interface wifi security add name=open-sec authentication-types=none

# Create WiFi AP (standalone mode)
/interface wifi add name=wifi1 ssid=$WIFI_SSID security=open-sec disabled=no channel=ch-2ghz

# Add WiFi to bridge
/interface bridge port add bridge=bridge interface=wifi1

# ---------------------------
# 4. DHCP Server (Trusted devices)
# ---------------------------
/ip pool add name=dhcp-pool ranges=192.168.88.10-192.168.88.30
/ip dhcp-server add name=dhcp-local address-pool=dhcp-pool interface=bridge disabled=no
/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=192.168.88.1

# ---------------------------
# 5. RADIUS Client
# ---------------------------
/radius add service=hotspot,ppp address=10.8.0.1 secret=$RADIUS_SECRET authentication-port=1812 accounting-port=1813 src-address=10.8.0.2 timeout=3000ms tries=3 disabled=no

/ppp aaa set use-radius=yes radius-accounting=yes interim-update=5m

# ---------------------------
# 6. Hotspot (WiFi customers)
# ---------------------------
/ip pool add name=hotspot-pool ranges=192.168.88.31-192.168.88.199

/ip hotspot profile add name=hotspot-radius login-by=http-chap use-radius=yes radius-accounting=yes interim-update=1d rate-limit=""

/ip hotspot add name=hotspot1 interface=bridge address-pool=hotspot-pool profile=hotspot-radius disabled=no local-address=192.168.88.1

# Note: For custom hotspot login page, upload hotspot/ directory via Winbox > Files

# ---------------------------
# 7. PPPoE Server (Wired customers)
# ---------------------------
/ip pool add name=pppoe-pool ranges=192.168.88.200-192.168.88.250

/ppp profile add name=pppoe-radius local-address=192.168.88.1 remote-address=pppoe-pool use-encryption=required only-one=yes rate-limit=""

/interface pppoe-server server add service-name=isp-pppoe interface=bridge default-profile=pppoe-radius use-radius=yes accounting=yes disabled=no

# ---------------------------
# 8. Firewall Rules
# ---------------------------
# Input chain - protect the router
/ip firewall filter add chain=input action=accept connection-state=established,related,untracked comment="Accept established,related,untracked"
/ip firewall filter add chain=input action=accept protocol=icmp comment="Accept ICMP"
/ip firewall filter add chain=input action=accept dst-address=127.0.0.1 comment="Accept to local loopback"
/ip firewall filter add chain=input action=drop connection-state=invalid comment="Drop invalid"
/ip firewall filter add chain=input action=drop in-interface-list=!LAN comment="Drop all not from LAN"

# Forward chain - protect LAN
/ip firewall filter add chain=forward action=fasttrack-connection connection-state=established,related comment="Fasttrack"
/ip firewall filter add chain=forward action=accept connection-state=established,related,untracked comment="Accept established,related"
/ip firewall filter add chain=forward action=drop connection-state=invalid comment="Drop invalid"
/ip firewall filter add chain=forward action=drop connection-state=new connection-nat-state=!dstnat in-interface-list=WAN comment="Drop WAN not DSTNATed"

# Allow RADIUS traffic to FreeRADIUS server
/ip firewall filter add chain=output dst-address=10.8.0.1 protocol=udp dst-port=1812,1813 action=accept comment="Allow RADIUS"

# Allow Hotspot HTTP/HTTPS
/ip firewall filter add chain=input protocol=tcp dst-port=80,443 in-interface=bridge action=accept comment="Allow Hotspot"

# ---------------------------
# 9. DNS
# ---------------------------
/ip dns set allow-remote-requests=yes
/ip dns static add name=router.lan address=192.168.88.1

# ---------------------------
# 10. Queue Types (PCQ for per-user speed limits)
# ---------------------------
# PCQ (Per Connection Queue) - limits download per user
/queue type add name=pcq-download kind=pcq pcq-rate=0 pcq-classifier=dst-address

# PCQ - limits upload per user
/queue type add name=pcq-upload kind=pcq pcq-rate=0 pcq-classifier=src-address

# Default queues for the bridge (will be overridden by RADIUS attributes)
/queue simple add name=hotspot-users target=192.168.88.0/24 queue=pcq-upload/pcq-download total-queue=pcq-upload disabled=no

/queue simple add name=pppoe-users target=192.168.88.200-192.168.88.250 queue=pcq-upload/pcq-download total-queue=pcq-upload disabled=no

# ============================================================================
# END OF SCRIPT
# ============================================================================

# RADIUS Bandwidth Attributes (configure in FreeRADIUS):
# MikroTik-Rate-Limit = "10M/20M" (upload/download in bits)
# Rate-Min-Limit = minimum guaranteed bandwidth
# Rate-Max-Limit = maximum bandwidth cap
#
# Example SQL query for Mikrotik-DHCP-Max-Lease-Time and Mikrotik-Rate-Limit
# ============================================================================
