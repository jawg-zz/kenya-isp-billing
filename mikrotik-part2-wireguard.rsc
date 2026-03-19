# ============================================================================
# MikroTik WireGuard Setup - Part 2
# ============================================================================
# Run this AFTER Part 1
#
# Edit the variables below with your actual keys, THEN paste
# ============================================================================

# EDIT THESE - Replace with actual values
:local WG_PRIVATE_KEY "YOUR_PRIVATE_KEY_HERE"
:local WG_PEER_PUBKEY "YOUR_PEER_PUBLIC_KEY_HERE"
:local WG_ENDPOINT "vpn.spidmax.win:51820"
:local WG_PRESHARED_KEY "YOUR_PRESHARED_KEY_HERE"

# ---------------------------
# WireGuard VPN
# ---------------------------
/interface wireguard add name=wg-vpn \
  private-key=$WG_PRIVATE_KEY \
  listen-port=51820 \
  mtu=1420

/interface wireguard peers add interface=wg-vpn \
  public-key=$WG_PEER_PUBKEY \
  endpoint-address=$WG_ENDPOINT \
  preshared-key=$WG_PRESHARED_KEY \
  persistent-keepalive=25s \
  allowed-address=10.8.0.0/24

/ip address add address=10.8.0.2/24 interface=wg-vpn comment="WireGuard to RADIUS server"

:put "Part 2 complete! WireGuard should be connected."
