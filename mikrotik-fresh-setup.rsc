# MikroTik Fresh Setup - ISP Billing Integration
# RouterOS 7.x - paste into Terminal
/interface bridge add name=bridge-lan protocol-mode=none
/interface bridge port add interface=ether2 bridge=bridge-lan
/interface bridge port add interface=ether3 bridge=bridge-lan
/interface bridge port add interface=ether4 bridge=bridge-lan
/interface bridge port add interface=ether5 bridge=bridge-lan
/ip address add address=192.168.89.1/24 interface=bridge-lan
/ip pool add name=dhcp-pool ranges=192.168.89.31-192.168.89.199
/ip pool add name=hotspot-pool ranges=192.168.89.100-192.168.89.150
/ip pool add name=pppoe-pool ranges=192.168.89.200-192.168.89.250
/ip dhcp-server add name=dhcp-lan interface=bridge-lan address-pool=dhcp-pool
/ip dhcp-server network add address=192.168.89.0/24 gateway=192.168.89.1 dns-server=192.168.89.1
/ip dns set servers=1.1.1.1,8.8.8.8 allow-remote-requests=yes
/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade
/ip firewall filter add chain=input action=accept connection-state=established,related
/ip firewall filter add chain=input action=accept connection-state=new src-address=192.168.89.0/24
/ip firewall filter add chain=input action=drop connection-state=invalid
/ip firewall filter add chain=forward action=accept connection-state=established,related
/ip firewall filter add chain=forward action=accept connection-state=new in-interface=bridge-lan out-interface=ether1
/ip firewall filter add chain=forward action=drop connection-state=invalid
/ip firewall filter add chain=input action=accept protocol=udp dst-port=67-68
/ip firewall filter add chain=input action=accept protocol=udp dst-port=53
/ip firewall filter add chain=output action=accept dst-address=10.8.0.1 protocol=udp dst-port=1812-1813
/ip firewall filter add chain=input action=accept src-address=10.8.0.1 protocol=udp src-port=1812-1813
/ip hotspot profile add name=hotspot-radius login-by=http-chap,http-pap use-radius=yes radius-accounting=yes hotspot-address=192.168.89.1 dns-name=login.local
/ip hotspot add name=hotspot1 interface=bridge-lan address-pool=hotspot-pool profile=hotspot-radius disabled=no
/ppp profile add name=pppoe-radius local-address=192.168.89.1 remote-address-pool=pppoe-pool bridge=bridge-lan
/interface pppoe-server server add service-name=isp-pppoe interface=bridge-lan default-profile=pppoe-radius authentication=pap,chap one-session-per-host=yes
/radius add address=10.8.0.1 secret=radiussecret authentication-port=1812 accounting-port=1813 src-address=10.8.0.2 service=ppp,hotspot,login
/ppp aaa set use-radius=yes accounting=yes interim-update=5m
/radius incoming set accept=yes
/interface wireguard add name=wg-vpn listen-port=51820 mtu=1420 private-key=YAN9JhoH1Y/ps+5FaDXjUQC7KDOjA8n8hwu/f2moLk4=
/interface wireguard peers add interface=wg-vpn public-key=L8bc5vXPX2zQHzpmd+qHwA2HAMYTi0uzvwiYFeB+ekw= preshared-key=4Cntf94sI7Igv64iAWx2B77/qMc5FOyr1cYyZvTd+Qo= endpoint-address=vpn.spidmax.win:51820 persistent-keepalive=25 allowed-address=10.8.0.0/24
/ip address add address=10.8.0.2/24 interface=wg-vpn
/ip dhcp-client add interface=ether1 disabled=no
/queue type add name=pcq-download kind=pcq pcq-rate=0 pcq-classifier=dst-address
/queue type add name=pcq-upload kind=pcq pcq-rate=0 pcq-classifier=src-address
/system identity set name=mikrotik-isp
