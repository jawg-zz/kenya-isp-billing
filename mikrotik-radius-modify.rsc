# MikroTik RADIUS Integration - Modify Existing Config
/interface wireguard add name=wg-vpn private-key="YAN9JhoH1Y/ps+5FaDXjUQC7KDOjA8n8hwu/f2moLk4=" listen-port=51820 mtu=1420
/interface wireguard peers add interface=wg-vpn public-key="L8bc5vXPX2zQHzpmd+qHwA2HAMYTi0uzvwiYFeB+ekw=" endpoint-address="vpn.spidmax.win:51820" preshared-key="4Cntf94sI7Igv64iAWx2B77/qMc5FOyr1cYyZvTd+Qo=" persistent-keepalive=25s allowed-address=10.8.0.0/24
/ip address add address=10.8.0.2/24 interface=wg-vpn comment="WireGuard to RADIUS server"
/radius add address=10.8.0.1 secret="CHANGE_ME" authentication-port=1812 accounting-port=1813 src-address=10.8.0.2
/ppp aaa set use-radius=yes
/interface wifi channel add name=ch-2ghz band=2ghz-n/ac
/interface wifi security add name=open-sec authentication-types=none
/interface wifi add name=wifi1 ssid="spidmax-wifi" security=open-sec disabled=no channel=ch-2ghz
/interface bridge port add bridge=bridge interface=wifi1
/ip pool add name=hotspot-pool ranges=192.168.88.31-192.168.88.199
/ip pool add name=pppoe-pool ranges=192.168.88.200-192.168.88.250
/ip hotspot profile add name=hotspot-radius login-by=http-chap use-radius=yes
/ip hotspot add name=hotspot1 interface=bridge address-pool=hotspot-pool profile=hotspot-radius
/ppp profile add name=pppoe-radius local-address=192.168.88.1 remote-address=pppoe-pool
/interface pppoe-server server add service-name=isp-pppoe interface=bridge default-profile=pppoe-radius
/queue type add name=pcq-download kind=pcq pcq-rate=0 pcq-classifier=dst-address
/queue type add name=pcq-upload kind=pcq pcq-rate=0 pcq-classifier=src-address
/ip firewall filter add chain=output dst-address=10.8.0.1 protocol=udp dst-port=1812-1813 action=accept
