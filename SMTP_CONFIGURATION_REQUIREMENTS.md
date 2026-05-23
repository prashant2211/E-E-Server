# 📧 SMTP Configuration Requirements

## What You Need to Provide

To configure SMTP email sending, I need the following information from you:

### Option 1: Gmail (Recommended for Testing)

**What I need:**
1. **Your Gmail address** (e.g., `yourname@gmail.com`)
2. **Gmail App Password** (16-character password)

**How to get Gmail App Password:**
1. Go to: https://myaccount.google.com/security
2. Enable **2-Step Verification** (if not already enabled)
3. Go to: https://myaccount.google.com/apppasswords
4. Select "Mail" and "Other (Custom name)"
5. Enter name: "Educational ERP"
6. Click "Generate"
7. Copy the 16-character password (it will look like: `abcd efgh ijkl mnop`)

**What I'll configure:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=noreply@educationaleternity.com
```

---

### Option 2: Outlook/Hotmail

**What I need:**
1. **Your Outlook email** (e.g., `yourname@outlook.com`)
2. **Your Outlook password** (or App Password if 2FA enabled)

**What I'll configure:**
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
SMTP_FROM=noreply@educationaleternity.com
```

---

### Option 3: Yahoo Mail

**What I need:**
1. **Your Yahoo email** (e.g., `yourname@yahoo.com`)
2. **Yahoo App Password** (generate from Yahoo account settings)

**What I'll configure:**
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@educationaleternity.com
```

---

### Option 4: Custom SMTP Server

**What I need:**
1. **SMTP Server Host** (e.g., `smtp.yourdomain.com`)
2. **SMTP Port** (usually 587 for TLS or 465 for SSL)
3. **SMTP Username** (your email or SMTP username)
4. **SMTP Password** (your email password or SMTP password)
5. **Security Type** (TLS/SSL/None)

**What I'll configure:**
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-username
SMTP_PASS=your-password
SMTP_FROM=noreply@yourdomain.com
```

---

## Quick Setup Instructions

### For Gmail (Easiest):

**Just provide me:**
1. Your Gmail address
2. Gmail App Password (16 characters)

**I'll do the rest!**

---

## Security Notes

⚠️ **Important:**
- Never share your regular password
- For Gmail, always use App Password (not regular password)
- App Passwords are safer and can be revoked easily
- I'll add these to your `.env` file (which is not committed to Git)

---

## After Configuration

Once configured, I will:
1. ✅ Add SMTP settings to your `.env` file
2. ✅ Test the configuration
3. ✅ Restart your backend server
4. ✅ Verify email sending works

---

## What Happens Next

After you provide the information:
1. I'll update your `BackEnd/.env` file
2. You'll need to restart your backend server
3. Email sending will work automatically
4. Student credentials will be sent via email

---

## Example Information to Provide

**For Gmail:**
```
Email: myname@gmail.com
App Password: abcd efgh ijkl mnop
```

**For Custom SMTP:**
```
SMTP Host: smtp.myschool.com
Port: 587
Username: noreply@myschool.com
Password: mypassword123
Security: TLS
```

---

**Just provide the information above, and I'll configure everything for you!** 🚀

