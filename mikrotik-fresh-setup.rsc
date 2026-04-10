# MikroTik Fresh Setup - ISP Billing Integration
# For fully reset MikroTik router (RouterOS 7.x)
# Assumes: ether1=WAN (DHCP), ether2-5=LAN
#
# INSTRUCTIONS:
# 1. Connect ether1 to ISP modem, ether2-5 to switch/PC
# 2. Paste this script into Terminal (use /import for file-based install)
# 3. Script is self-contained - no variable substitution issues

/system identity set name=mikrotik-isp

:log info "=== MikroTik Fresh Setup Started ==="

# WAN: DHCP client
/ip dhcp-client add interface=ether1 disabled=no comment="WAN ISP DHCP"
:log info "WAN DHCP client added"

# Bridge: combine LAN ports
/interface bridge add name=bridge-lan protocol-mode=none
/interface bridge port add interface=ether2 bridge=bridge-lan
/interface bridge port add interface=ether3 bridge=bridge-lan
/interface bridge port add interface=ether4 bridge=bridge-lan
/interface bridge port add interface=ether5 bridge=bridge-lan
:log info "Bridge created with ether2-5"

# LAN IP
/ip address add address=192.168.89.1/24 interface=bridge-lan comment="LAN bridge"
:log info "LAN IP: 192.168.89.1"

# DHCP Pool
/ip pool add name=dhcp-pool ranges=192.168.89.31-192.168.89.199

# DHCP Server
/ip dhcp-server add name=dhcp-lan interface=bridge-lan address-pool=dhcp-pool gateway=192.168.89.1 dns-server=192.168.89.1 comment="LAN DHCP"
/ip dhcp-server network add address=192.168.89.0/24 gateway=192.168.89.1 dns-server=192.168.89.1
:log info "DHCP server configured"

# DNS
/ip dns set servers=1.1.1.1,8.8.8.8 allow-remote-requests=yes
:log info "DNS configured"

# NAT masquerade
/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade comment="NAT LAN to WAN"
:log info "NAT masquerade enabled"

# Basic firewall - input
/ip firewall filter add chain=input action=accept connection-state=established,related comment="Allow established/related"
/ip firewall filter add chain=input action=accept connection-state=new src-address=192.168.89.0/24 comment="Allow new from LAN"
/ip firewall filter add chain=input action=drop connection-state=invalid comment="Drop invalid input"
# Basic firewall - forward
/ip firewall filter add chain=forward action=accept connection-state=established,related comment="Allow forward established"
/ip firewall filter add chain=forward action=accept connection-state=new in-interface=bridge-lan out-interface=ether1 comment="LAN to WAN forward"
/ip firewall filter add chain=forward action=drop connection-state=invalid comment="Drop invalid forward"
:log info "Basic firewall configured"

# Allow DHCP and DNS input
/ip firewall filter add chain=input action=accept protocol=udp dst-port=67-68 comment="Allow DHCP"
/ip firewall filter add chain=input action=accept protocol=udp dst-port=53 comment="Allow DNS"

# =====================================================================
# ISP BILLING INTEGRATION
# =====================================================================
:log info "Configuring ISP Billing integration..."

# WireGuard VPN
/interface wireguard add name=wg-vpn listen-port=51820 mtu=1420 private-key="YAN9JhoH1Y/ps+5FaDXjUQC7KDOjA8n8hwu/f2moLk4="
/interface wireguard peers add interface=wg-vpn public-key="L8bc5vXPX2zQHzpmd+qHwA2HAMYTi0uzvwiYFeB+ekw=" preshared-key="4Cntf94sI7Igv64iAWx2B77/qMc5FOyr1cYyZvTd+Qo=" endpoint-address="vpn.spidmax.win:51820" persistent-keepalive=25 allowed-address=10.8.0.0/24
/ip address add address=10.8.0.2/24 interface=wg-vpn comment="WireGuard tunnel to RADIUS"
:log info "WireGuard VPN configured"

# RADIUS client
/radius add address=10.8.0.1 secret="radiussecret" authentication-port=1812 accounting-port=1813 src-address=10.8.0.2 service=ppp,hotspot,login timeout=3s comment="ISP Billing RADIUS"
:log info "RADIUS client configured"

# RADIUS for PPP
/ppp aaa set use-radius=yes accounting=yes interim-update=5m
:log info "RADIUS enabled for PPP"

# RADIUS incoming (CoA support)
/radius incoming set accept=yes port=3799
:log info "RADIUS CoA enabled"

# IP pools for PPPoE and Hotspot
/ip pool add name=hotspot-pool ranges=192.168.89.31-192.168.89.199
/ip pool add name=pppoe-pool ranges=192.168.89.200-192.168.89.250
:log info "IP pools created"

# Hotspot profile
/ip hotspot profile add name=hotspot-radius login-by=http-chap,http-pap use-radius=yes radius-accounting=yes hotspot-address=192.168.89.1 dns-name=login.local comment="ISP Billing Hotspot"
# Hotspot server
/ip hotspot add name=hotspot1 interface=bridge-lan address-pool=hotspot-pool profile=hotspot-radius disabled=no
:log info "Hotspot server configured"

# PPPoE profile
/ppp profile add name=pppoe-radius local-address=192.168.89.1 remote-address-pool=pppoe-pool bridge=bridge-lan use-mpls=no use-compression=no use-encryption=no override-mtu=1492 comment="PPPoE ISP Billing"
# PPPoE server
/interface pppoe-server server add service-name=isp-pppoe interface=bridge-lan default-profile=pppoe-radius authentication=pap,chap one-session-per-host=yes
:log info "PPPoE server configured"

# Queue types for speed limiting
/queue type add name=pcq-download kind=pcq pcq-rate=0 pcq-classifier=dst-address
/queue type add name=pcq-upload kind=pcq pcq-rate=0 pcq-classifier=src-address
:log info "Queue types created"

# Firewall: allow RADIUS traffic
/ip firewall filter add chain=output action=accept dst-address=10.8.0.1 protocol=udp dst-port=1812-1813 comment="Allow RADIUS to billing"
/ip firewall filter add chain=input action=accept src-address=10.8.0.1 protocol=udp src-port=1812-1813 comment="Allow RADIUS from billing"
:log info "RADIUS firewall rules added"

# =====================================================================
# SETUP COMPLETE
# =====================================================================
:log info "=== MikroTik Fresh Setup Complete ==="
:log info "LAN: 192.168.89.0/24  |  Gateway: 192.168.89.1"
:log info "Hotspot: http://192.168.89.1  |  PPPoE service: isp-pppoe"
:log info "WireGuard: 10.8.0.2 -> 10.8.0.1 (RADIUS)"
:log info ""
:log info "NEXT STEPS:"
:log info "1. Set RADIUS_ALLOWED_IPS=10.8.0.0/24 on ISP billing API"
:log info "2. Register MikroTik NAS in ISP billing admin panel"
:log info "3. Create test customer and plan in ISP billing"
:log info "4. Test Hotspot or PPPoE login with customer credentials"
