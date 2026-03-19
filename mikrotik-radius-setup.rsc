# MikroTik Full Setup Script
# Reset MikroTik > No Default Config > Set Password > Paste this

# === VARIABLES - EDIT THESE ===
:local rSecret "CHANGE_ME"
:local wifiSSID "MyISP_Free_WiFi"

# === NETWORK ===
/interface bridge add name=bridge disabled=no
/ip address add address=192.168.88.1/24 interface=bridge comment=LAN
/ip dhcp-client add interface=ether1 disabled=no comment=WAN
/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade

# === WIFFI ===
/interface wireless set wlan1 mode=ap-bridge band=2ghz-b/g/n ssid=$wifiSSID disabled=no
/interface bridge port add bridge=bridge interface=wlan1

# === DHCP ===
/ip pool add name=dhcp ranges=192.168.88.10-192.168.88.30
/ip dhcp-server add address-pool=dhcp interface=bridge disabled=no
/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=192.168.88.1

# === RADIUS ===
/radius add service=hotspot,ppp address=10.8.0.1 secret=$rSecret authentication-port=1812 accounting-port=1813 src-address=10.8.0.2 disabled=no
/ppp aaa set use-radius=yes

# === HOTSPOT ===
/ip pool add name=hotspot ranges=192.168.88.31-192.168.88.250
/ip hotspot profile add name=radius login-by=http-chap use-radius=yes http-redirect=yes redirect-url=https://isp.spidmax.win/hotspot/login.html
/ip hotspot add interface=bridge address-pool=hotspot profile=radius local-address=192.168.88.254 disabled=no

# === PPPoE ===
/ppp profile add name=pppoe local-address=192.168.88.1 remote-address=hotspot use-encryption=required only-one=yes
/interface pppoe-server server add service-name=isp interface=bridge default-profile=pppoe use-radius=yes

# === FIREWALL ===
/ip firewall filter add chain=forward src-address=192.168.88.0/24 dst-address=10.8.0.1 protocol=udp dst-port=1812,1813 action=accept
/ip dns set allow-remote-requests=yes

:put "DONE - Now add WireGuard manually"
