# MikroTik Hotspot Custom Login Page

## Files
- `login.html` — Main login page
- `logout.html` — Logout confirmation
- `status.html` — Connected session status (shows time, data usage)

## Upload to MikroTik

### Option 1: Winbox (easiest)
1. Open **Winbox** and connect to your MikroTik
2. Go to **Files** in the left menu
3. Navigate to `hotspot/` folder
4. Drag and drop the HTML files into the hotspot folder
5. Replace existing `login.html`, `logout.html`, `status.html`

### Option 2: FTP
```bash
ftp 192.168.88.1
# user: admin, password: your_password
cd hotspot
put login.html
put logout.html
put status.html
quit
```

### Option 3: MikroTik Terminal
```
/file print
/file set [find name=hotspot/login.html] contents=...  (paste file content)
```

### Option 4: Upload via WebFig
1. Open `http://192.168.88.1` in browser
2. Go to **Files**
3. Click **Upload** and select the files
4. Place them in the `hotspot/` directory

## Customize

### Change branding
Edit `login.html`:
- Find `GeorgeISP` → replace with your brand name
- Find `main.spidmax.win` → replace with your domain
- Find `07XX XXX XXX` → replace with your support number

### Change colors
Edit the CSS in `login.html`:
```css
/* Purple gradient (current) */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Blue gradient */
background: linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%);

/* Green gradient */
background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);

/* Orange gradient */
background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
```

## MikroTik Hotspot Settings
Make sure these are set:
```
/ip hotspot profile
set [find] html-directory=hotspot
set [find] login-by=http-chap
```
