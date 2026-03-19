# ============================================================================
# MikroTik RADIUS Integration Script - Single File
# ============================================================================
# Run this in TWO STEPS to avoid parsing issues:
#   STEP 1: Run up to "WIREGUARD SETUP" comment
#   STEP 2: Run from "WIREGUARD SETUP" onwards
#
# Prerequisites:
# - RouterOS 7.x (after reset with NO default configuration)
# - WireGuard server at vpn.spidmax.win:51820
# - FreeRADIUS on 10.8.0.1
# ============================================================================

# ============================================================================
# STEP 1: BASIC SETUP - Run this first
# ============================================================================

# --- SETUP VARIABLES ---
:local RADIUS_SECRET "CHANGE_ME_TO_YOUR_RADIUS_SECRET"
:local WIFI_SSID "MyISP_Free_WiFi"
:local WAN_INTERFACE "ether1"
:local HOTSPOT_SERVER "https://isp.spidmax.win/hotspot/login.html"

# --- Basic Network ---
/interface bridge add name=bridge disabled=no
:foreach i in=[/interface ethernet find] do={:local name [/interface ethernet get $i name]
:if ($name != $WAN_INTERFACE) do={/interface bridge port add bridge=bridge interface=$name}}
/ip address add address=192.168.88.1/24 interface=bridge comment="LAN"

# --- WAN ---
/ip dhcp-client add interface=$WAN_INTERFACE disabled=no comment="WAN"
/ip firewall nat add chain=srcnat out-interface=$WAN_INTERFACE action=masquerade

# --- WiFi ---
/interface wireless set wlan1 mode=ap-bridge band=2ghz-b/g/n channel-width=20/40mhz-XX ssid=$WIFI_SSID security-profile=default disabled=no
/interface bridge port add bridge=bridge interface=wlan1

# --- DHCP Server ---
/ip pool add name=dhcp-pool ranges=192.168.88.10-192.168.88.30
/ip dhcp-server add name=dhcp-local address-pool=dhcp-pool interface=bridge disabled=no
/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=192.168.88.1

# --- RADIUS Client ---
/radius add service=hotspot,ppp address=10.8.0.1 secret=$RADIUS_SECRET authentication-port=1812 accounting-port=1813 require-message-authentication=yes src-address=10.8.0.2 timeout=3000ms tries=3 disabled=no
/ppp aaa set use-radius=yes radius-accounting=yes interim-update=5m

# --- Hotspot ---
/ip pool add name=hotspot-pool ranges=192.168.88.31-192.168.88.250
/ip hotspot profile add name=hotspot-radius login-by=http-chap use-radius=yes radius-accounting=yes interim-update=1d http-redirect=yes redirect-url=$HOTSPOT_SERVER
/ip hotspot add name=hotspot1 interface=bridge address-pool=hotspot-pool profile=hotspot-radius disabled=no local-address=192.168.88.254

# --- PPPoE ---
/ppp profile add name=pppoe-radius local-address=192.168.88.1 remote-address=hotspot-pool use-encryption=required only-one=yes
/interface pppoe-server server add service-name=isp-pppoe interface=bridge default-profile=pppoe-radius use-radius=yes accounting=yes disabled=no

# --- Firewall ---
/ip firewall filter add chain=forward src-address=192.168.88.0/24 dst-address=10.8.0.1 protocol=udp dst-port=1812,1813 action=accept comment="Allow RADIUS"
/ip firewall filter add chain=input protocol=tcp dst-port=80,443 in-interface=bridge action=accept comment="Allow Hotspot"

# --- DNS ---
/ip dns set allow-remote-requests=yes
/ip dns static add name=router.lan address=192.168.88.1

# --- Queue ---
/queue tree add name=global-down parent=global max-limit=100M priority=8 queue=default
/queue tree add name=global-up parent=global max-limit=50M priority=8 queue=default

:put "STEP 1 COMPLETE! Now run STEP 2 below."

# ============================================================================
# STEP 2: WIREGUARD SETUP - Run this after STEP 1
# ============================================================================

# First, generate a private key on MikroTik:
# /interface wireguard generate private-key
# Then copy the key and use it below

# Run these commands one by one, replacing the keys:

# /interface wireguard add name=wg-vpn private-key=<YOUR_PRIVATE_KEY> listen-port=51820 mtu=1420
# /interface wireguard peers add interface=wg-vpn public-key=L8bc5vXPX2zQHzpmd+qHwA2HAMYTi0uzvwiYFeB+ekw= endpoint-address=vpn.spidmax.win:51820 preshared-key=4Cntf94sI7Igv64iAWx2B77/qMc5FOyr1cYyZvTd+Qo= persistent-keepalive=25s allowed-address=10.8.0.0/24
# /ip address add address=10.8.0.2/24 interface=wg-vpn comment="WireGuard"

:put "STEP 2: Generate key with '/interface wireguard generate private-key' then run the 3 commands above manually."
