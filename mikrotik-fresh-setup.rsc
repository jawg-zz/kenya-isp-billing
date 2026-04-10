# MikroTik Fresh Setup - ISP Billing Integration
# RouterOS 7.x - paste into Terminal
/interface bridge add name=bridgelan protocol-mode=none
/interface bridge port add interface=ether2 bridge=bridgelan
/interface bridge port add interface=ether3 bridge=bridgelan
/interface bridge port add interface=ether4 bridge=bridgelan
/interface bridge port add interface=ether5 bridge=bridgelan
/ip address add address=192.168.89.1/24 interface=bridgelan
/ip pool add name=dhcppool ranges=192.168.89.31-192.168.89.199
/ip pool add name=hotspotpool ranges=192.168.89.100-192.168.89.150
/ip pool add name=pppoepool ranges=192.168.89.200-192.168.89.250
/ip dhcp-server add name=dhcplan interface=bridgelan address-pool=dhcppool
/ip dhcp-server network add address=192.168.89.0/24 gateway=192.168.89.1 dns-server=192.168.89.1
/ip dns set servers=1.1.1.1,8.8.8.8 allow-remote-requests=yes
/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade
/ip firewall filter add chain=input action=accept connection-state=established,related
/ip firewall filter add chain=input action=accept connection-state=new src-address=192.168.89.0/24
/ip firewall filter add chain=input action=drop connection-state=invalid
/ip firewall filter add chain=forward action=accept connection-state=established,related
/ip firewall filter add chain=forward action=accept connection-state=new in-interface=bridgelan out-interface=ether1
/ip firewall filter add chain=forward action=drop connection-state=invalid
/ip firewall filter add chain=input action=accept protocol=udp dst-port=67-68
/ip firewall filter add chain=input action=accept protocol=udp dst-port=53
/ip firewall filter add chain=output action=accept dst-address=10.8.0.1 protocol=udp dst-port=1812-1813
/ip firewall filter add chain=input action=accept src-address=10.8.0.1 protocol=udp src-port=1812-1813
/ip hotspot profile add name=hotspotradius login-by=http-chap,http-pap use-radius=yes radius-accounting=yes hotspot-address=192.168.89.1 dns-name=login.local
/ip hotspot add name=hotspot1 interface=bridgelan address-pool=hotspotpool profile=hotspotradius disabled=no
/ppp profile add name=pppoeradius local-address=192.168.89.1
/interface pppoe-server server add service-name=isp_pppoe interface=bridgelan default-profile=pppoeradius authentication=pap,chap
/radius add address=10.8.0.1 secret=radiussecret authentication-port=1812 accounting-port=1813 src-address=10.8.0.2 service=ppp,hotspot,login
/ppp aaa set use-radius=yes accounting=yes interim-update=5m
/radius incoming set accept=yes
/interface wireguard add name=wgvpn listen-port=51820 mtu=1420 private-key="YAN9JhoH1Y/ps+5FaDXjUQC7KDOjA8n8hwu/f2moLk4="
/interface wireguard peers add interface=wgvpn public-key=L8bc5vXPX2zQHzpmd+qHwA2HAMYTi0uzvwiYFeB+ekw= preshared-key=4Cntf94sI7Igv64iAWx2B77/qMc5FOyr1cYyZvTd+Qo= endpoint-address=vpn.spidmax.win:51820 persistent-keepalive=25 allowed-address=10.8.0.0/24
/ip address add address=10.8.0.2/24 interface=wgvpn
/ip dhcp-client add interface=ether1 disabled=no
/queue type add name=pcqdownload kind=pcq pcq-rate=0 pcq-classifier=dst-address
/queue type add name=pcqupload kind=pcq pcq-rate=0 pcq-classifier=src-address
/system identity set name=mikrotik_isp
