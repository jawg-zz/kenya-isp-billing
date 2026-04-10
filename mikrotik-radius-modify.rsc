# MikroTik RADIUS Integration - Modify Existing Config
/interface wireguard add name=wgvpn private-key=YAN9JhoH1Y/ps+5FaDXjUQC7KDOjA8n8hwu/f2moLk4= listen-port=51820 mtu=1420
/interface wireguard peers add interface=wgvpn public-key=L8bc5vXPX2zQHzpmd+qHwA2HAMYTi0uzvwiYFeB+ekw= endpoint-address=vpn.spidmax.win:51820 preshared-key=4Cntf94sI7Igv64iAWx2B77/qMc5FOyr1cYyZvTd+Qo= persistent-keepalive=25 allowed-address=10.8.0.0/24
/ip address add address=10.8.0.2/24 interface=wgvpn
/radius add address=10.8.0.1 secret=radiussecret authentication-port=1812 accounting-port=1813 src-address=10.8.0.2 service=ppp,hotspot,login
/ppp aaa set use-radius=yes
/ip pool add name=hotspotpool ranges=192.168.88.31-192.168.88.199
/ip pool add name=pppoepool ranges=192.168.88.200-192.168.88.250
/ip hotspot profile add name=hotspotradius login-by=http-chap,http-pap use-radius=yes radius-accounting=yes hotspot-address=192.168.88.1 dns-name=login.local
/ip hotspot add name=hotspot1 interface=bridge address-pool=hotspotpool profile=hotspotradius disabled=no
/ppp profile add name=pppoeradius local-address=192.168.88.1
/interface pppoe-server server add service-name=isp_pppoe interface=bridge default-profile=pppoeradius authentication=pap,chap
/queue type add name=pcqdownload kind=pcq pcq-rate=0 pcq-classifier=dst-address
/queue type add name=pcqupload kind=pcq pcq-rate=0 pcq-classifier=src-address
/ip firewall filter add chain=output action=accept dst-address=10.8.0.1 protocol=udp dst-port=1812-1813
/ip firewall filter add chain=input action=accept src-address=10.8.0.1 protocol=udp src-port=1812-1813
/ip firewall filter add chain=input action=accept protocol=udp dst-port=53
/ip firewall filter add chain=input action=accept protocol=udp dst-port=67-68
