# MikroTik Full Setup - Single Script
# Reset RouterOS > No Default Config > Set Password > Paste

# === PART 1: BASIC SETUP (run first) ===
{
:local rSecret "CHANGE_ME"
:local wifiSSID "MyISP"

# Network
/interface bridge add name=bridge disabled=no
/ip address add address=192.168.88.1/24 interface=bridge
/ip dhcp-client add interface=ether1 disabled=no
/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade

# WiFi
/interface wireless set wlan1 mode=ap-bridge band=2ghz-b/g/n ssid=$wifiSSID disabled=no
/interface bridge port add bridge=bridge interface=wlan1

# DHCP
/ip pool add name=dhcp ranges=192.168.88.10-30
/ip dhcp-server add address-pool=dhcp interface=bridge disabled=no
/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1

# RADIUS
/radius add service=hotspot,ppp address=10.8.0.1 secret=$rSecret authentication-port=1812 accounting-port=1813 src-address=10.8.0.2 disabled=no
/ppp aaa set use-radius=yes

# Hotspot
/ip pool add name=hotspot ranges=192.168.88.31-250
/ip hotspot profile add name=radius login-by=http-chap use-radius=yes http-redirect=yes redirect-url=https://isp.spidmax.win/hotspot/login.html
/ip hotspot add interface=bridge address-pool=hotspot profile=radius local-address=192.168.88.254 disabled=no

# PPPoE
/ppp profile add name=pppoe local-address=192.168.88.1 remote-address=hotspot use-encryption=required only-one=yes
/interface pppoe-server server add service-name=isp interface=bridge default-profile=pppoe use-radius=yes

# Firewall
/ip firewall filter add chain=forward src-address=192.168.88.0/24 dst-address=10.8.0.1 protocol=udp dst-port=1812,1813 action=accept
/ip dns set allow-remote-requests=yes
}

# === PART 2: WIREGUARD (run after Part 1) ===
# Generate new key ON THE ROUTER first:
/interface wireguard generate private-key
# Copy the key from output, then run these 3 lines:
# /interface wireguard add name=wg-vpn private-key=<PASTE_KEY_HERE> listen-port=51820
# /interface wireguard peers add interface=wg-vpn public-key=L8bc5vXPX2zQHzpmd+qHwA2HAMYTi0uzvwiYFeB+ekw= endpoint-address=vpn.spidmax.win:51820 preshared-key=4Cntf94sI7Igv64iAWx2B77_qMc5FOyr1cYyZvTd+Qo= persistent-keepalive=25s allowed-address=10.8.0.0/24
# /ip address add address=10.8.0.2/24 interface=wg-vpn
