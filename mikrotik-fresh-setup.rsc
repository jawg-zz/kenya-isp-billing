# MikroTik Fresh Setup - ISP Billing Integration
# For fully reset MikroTik router
# Assumes: ether1=WAN (DHCP from ISP modem), ether2-5=LAN
# ISP modem gateway: 192.168.88.1 (MikroTik LAN will use 192.168.89.1 to avoid conflict)
#
# INSTRUCTIONS:
# 1. Connect ether1 to your ISP modem
# 2. Connect ether2-5 to your switch/PC
# 3. Paste this entire script into Terminal
# 4. Replace WIREGUARD_PRIVATE_KEY with your actual WireGuard private key

:local wgPrivateKey "YAN9JhoH1Y/ps+5FaDXjUQC7KDOjA8n8hwu/f2moLk4="
:local wgEndpoint "vpn.spidmax.win:51820"
:local wgPublicKey "L8bc5vXPX2zQHzpmd+qHwA2HAMYTi0uzvwiYFeB+ekw="
:local wgPsk "4Cntf94sI7Igv64iAWx2B77/qMc5FOyr1cYyZvTd+Qo="
:local radiusIp "10.8.0.1"
:local radiusSecret "radiussecret"
:local keepalive 25

# ── System identity ─────────────────────────────────────────────────────
/system identity set name=mikrotik-isp

:log info "=== Starting MikroTik Fresh Setup ==="

# ── WAN: DHCP client on ether1 ──────────────────────────────────────
/ip dhcp-client
add interface=ether1 disabled=no comment="WAN - ISP DHCP"

:log info "WAN DHCP client added on ether1"

# ── Bridge: combine LAN ports ─────────────────────────────────────────
/interface bridge
add name=bridge-lan protocol-mode=none

/interface bridge port
add interface=ether2 bridge=bridge-lan
add interface=ether3 bridge=bridge-lan
add interface=ether4 bridge=bridge-lan
add interface=ether5 bridge=bridge-lan

:log info "Bridge created with ether2-ether5"

# ── LAN IP (192.168.89.1 - avoids conflict with ISP modem at .88.1) ──
/ip address
add address=192.168.89.1/24 interface=bridge-lan comment="LAN bridge"

# ── DHCP Server for LAN clients ────────────────────────────────────────
/ip pool
add name=dhcp-pool ranges=192.168.89.31-192.168.89.199

/ip dhcp-server
add name=dhcp-lan interface=bridge-lan address-pool=dhcp-pool \
    gateway=192.168.89.1 dns-server=192.168.89.1 boot-file-name="" \
    comment="LAN DHCP"

# Exclude gateway and DHCP server from dynamic leases
/ip dhcp-server network
add address=192.168.89.0/24 gateway=192.168.89.1 dns-server=192.168.89.1

:log info "DHCP server configured on bridge-lan"

# ── DNS: relay from upstream ISP modem ─────────────────────────────────
/ip dns
set servers=1.1.1.1,8.8.8.8 allow-remote-requests=yes

:log info "DNS set to ISP modem gateway"



# ── NAT: masquerade LAN traffic going out WAN ─────────────────────────
/ip firewall nat
add chain=srcnat out-interface=ether1 action=masquerade comment="NAT - masquerade LAN traffic"

:log info "NAT masquerade enabled"

# ── Basic firewall: allow established/related, drop invalid ────────────
/ip firewall filter
add chain=input action=accept connection-state=established,related comment="Allow established/related"
add chain=input action=accept connection-state=new src-address=192.168.89.0/24 comment="Allow new from LAN"
add chain=input action=accept connection-state=new dst-address=192.168.89.1 dst-port=80,443 protocol=tcp comment="Allow API portal access"
add chain=forward action=accept connection-state=established,related comment="Allow forward established"
add chain=forward action=accept connection-state=new in-interface=bridge-lan out-interface=ether1 comment="Allow LAN to WAN"
add chain=input action=drop connection-state=invalid comment="Drop invalid"
add chain=forward action=drop connection-state=invalid comment="Drop invalid forward"

:log info "Basic firewall rules added"

# ══════════════════════════════════════════════════════════════════════
# ISP BILLING INTEGRATION
# ══════════════════════════════════════════════════════════════════════

# ── WireGuard VPN ─────────────────────────────────────────────────────
/interface wireguard
add name=wg-vpn listen-port=51820 mtu=1420 private-key=$wgPrivateKey

/interface wireguard peers
add interface=wg-vpn public-key=$wgPublicKey preshared-key=$wgPsk \
    endpoint-address=$wgEndpoint persistent-keepalive=$keepalive \
    allowed-address=10.8.0.0/24

/ip address
add address=10.8.0.2/24 interface=wg-vpn comment="WireGuard tunnel - RADIUS server"

:log info "WireGuard VPN configured"

# ── RADIUS client ─────────────────────────────────────────────────────
/radius
add address=$radiusIp secret=$radiusSecret \
    authentication-port=1812 accounting-port=1813 \
    src-address=10.8.0.2 service=ppp,hotspot,login \
    timeout=3s comment="ISP Billing RADIUS"

:log info "RADIUS client configured -> $radiusIp"

# ── Enable RADIUS for PPP ─────────────────────────────────────────────
/ppp aaa
set use-radius=yes accounting=yes interim-update=5m

:log info "RADIUS enabled for PPP"

# ── RADIUS incoming (CoA support) ────────────────────────────────────
/radius incoming
set accept=yes port=3799

:log info "RADIUS CoA enabled on port 3799"

# ── IP pools for PPPoE and Hotspot ────────────────────────────────────
/ip pool
add name=hotspot-pool ranges=192.168.89.31-192.168.89.199
add name=pppoe-pool ranges=192.168.89.200-192.168.89.250

:log info "IP pools created"

# ── Hotspot server ─────────────────────────────────────────────────────
/ip hotspot profile
add name=hotspot-radius \
    login-by=http-chap,http-pap \
    use-radius=yes \
    radius-accounting=yes \
    hotspot-address=192.168.89.1 \
    dns-name=login.spidmax.win \
    comment="ISP Billing Hotspot"

# Create hotspot on the LAN bridge
/ip hotspot
add name=hotspot1 interface=bridge-lan \
    address-pool=hotspot-pool \
    profile=hotspot-radius \
    disabled=no

:log info "Hotspot server configured on bridge-lan"

# ── PPPoE server ───────────────────────────────────────────────────────
/ppp profile
add name=pppoe-radius \
    local-address=192.168.89.1 \
    remote-address-pool=pppoe-pool \
    bridge=bridge-lan \
    use-mpls=no \
    use-compression=no \
    use-encryption=no \
    override-mtu=1492 \
    comment="PPPoE - ISP Billing"

/interface pppoe-server server
add service-name=isp-pppoe \
    interface=bridge-lan \
    default-profile=pppoe-radius \
    authentication=pap,chap \
    one-session-per-host=yes

:log info "PPPoE server enabled on bridge-lan"

# ── Queue types for speed limiting ─────────────────────────────────────
/queue type
add name=pcq-download kind=pcq pcq-rate=0 pcq-classifier=dst-address
add name=pcq-upload kind=pcq pcq-rate=0 pcq-classifier=src-address

:log info "PCQ queue types created"

# ── Firewall: allow RADIUS traffic from LAN/WireGuard to RADIUS server ─
/ip firewall filter
add chain=output action=accept \
    dst-address=$radiusIp protocol=udp dst-port=1812-1813 \
    comment="Allow RADIUS auth/acct to billing server"
add chain=input action=accept \
    src-address=$radiusIp protocol=udp src-port=1812-1813 \
    comment="Allow RADIUS responses from billing server"

:log info "Firewall rules for RADIUS added"

# ── Allow DHCP and DNS traffic ────────────────────────────────────────
/ip firewall filter
add chain=input action=accept protocol=udp dst-port=67-68 comment="Allow DHCP"
add chain=input action=accept protocol=udp dst-port=53 comment="Allow DNS"

:log info "Firewall: DHCP+DNS allowed"

# ══════════════════════════════════════════════════════════════════════
# SETUP COMPLETE
# ══════════════════════════════════════════════════════════════════════

:log info "=== MikroTik Fresh Setup Complete ==="
:log info "LAN network: 192.168.89.0/24 (gateway: 192.168.89.1)"
:log info "Hotspot: login via http://192.168.89.1 or http://login.spidmax.win"
:log info "PPPoE: service name 'isp-pppoe', auth against RADIUS"
:log info "WireGuard: tunnel IP 10.8.0.2 -> RADIUS at 10.8.0.1"
:log info ""
:log info "NEXT STEPS:"
:log info "1. Update RADIUS_ALLOWED_IPS on ISP billing API to include 10.8.0.0/24"
:log info "2. Register this MikroTik NAS in the billing system admin panel"
:log info "3. Create test customer + plan in ISP billing portal"
:log info "4. Test PPPoE or Hotspot login with customer credentials"
