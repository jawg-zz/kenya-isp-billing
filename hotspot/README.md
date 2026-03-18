# MikroTik Hotspot — GeorgeISP

## Files
- `login.html` — Single page for both new and returning users

## Features
- **Tab 1: Buy Package** — select package → enter phone → M-Pesa STK push → auto-login
- **Tab 2: I Have Credentials** — returning users enter username/password to reconnect
- Auto-login after payment (no manual credential entry)
- Mobile-first design
- M-Pesa payment via ISP billing API

## Packages
| ID | Name | Price | Speed | Data | Duration |
|----|------|-------|-------|------|----------|
| hourly | 1 Hour | KES 20 | 2 Mbps | 500 MB | 1 hour |
| daily | Day Pass | KES 50 | 3 Mbps | 2 GB | 24 hours |
| weekly | Weekly | KES 250 | 5 Mbps | 10 GB | 7 days |
| monthly | Monthly | KES 800 | 5 Mbps | 30 GB | 30 days |

## Upload to MikroTik

### Via Winbox
1. Open Winbox → connect to MikroTik
2. Click **Files** → navigate to `hotspot/`
3. Upload `login.html` (replaces the default)

### Via FTP
```bash
ftp 192.168.88.1
cd hotspot
put login.html
quit
```

## MikroTik Hotspot Settings
```
/ip hotspot profile
set [find] html-directory=hotspot
set [find] login-by=http-chap
```

## Customize
- `GeorgeISP` → your brand name
- `main.spidmax.win` → your domain  
- Package prices/data → edit the HTML data attributes on each `.package-card`
- Colors → edit the CSS gradient `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
