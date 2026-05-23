# 📧 SMTP Email Configuration Guide

## Quick Setup for Sending Student Credentials

To send login credentials to students via email, you need to configure SMTP in your `.env` file.

### Step 1: Open your `.env` file

Navigate to `BackEnd/.env` and add the following SMTP configuration:

### Step 2: Gmail Setup (Recommended for Testing)

1. **Enable 2-Step Verification** in your Google Account:
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "Educational ERP" as the name
   - Copy the 16-character password (no spaces)

3. **Add to `.env` file**:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=noreply@educationaleternity.com
```

### Step 3: Other Email Providers

#### Outlook/Hotmail:
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
SMTP_FROM=noreply@yourschool.com
```

#### Yahoo:
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourschool.com
```

#### Custom SMTP Server:
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-username
SMTP_PASS=your-password
SMTP_FROM=noreply@yourschool.com
```

### Step 4: Restart Backend Server

After updating `.env`, restart your backend server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
cd BackEnd
npm start
```

### Step 5: Test Email Sending

1. Go to Student Management
2. Click "Send Login Credentials"
3. Select a class and students
4. Click "Send Credentials"
5. Check student email inbox (and spam folder)

## 🔍 Troubleshooting

### Error: "SMTP email configuration is missing"
- ✅ Check that all SMTP variables are in `.env` file
- ✅ Make sure there are no spaces around `=` sign
- ✅ Restart backend server after updating `.env`

### Error: "Invalid login" or "Authentication failed"
- ✅ For Gmail: Use App Password, not regular password
- ✅ Check that 2-Step Verification is enabled
- ✅ Verify SMTP_USER and SMTP_PASS are correct

### Error: "Connection timeout"
- ✅ Check your internet connection
- ✅ Verify SMTP_HOST and SMTP_PORT are correct
- ✅ Check firewall settings

### Emails not received
- ✅ Check spam/junk folder
- ✅ Verify student email addresses are correct
- ✅ Check backend console logs for errors
- ✅ Test with your own email first

## 📝 Example .env Configuration

```env
# Server
NODE_ENV=development
PORT=5000
BASE_URL=/api

# Database
DBCONNECTIONURL=mongodb://localhost:27017/EducationalEternity

# JWT
JWT_SECRET=your-secret-key

# Frontend
FRONTEND_URL=http://localhost:3000

# SMTP Email (Required for sending credentials)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
SMTP_FROM=noreply@educationaleternity.com
```

## ⚠️ Important Notes

1. **Never commit `.env` file to Git** - it contains sensitive information
2. **Use App Passwords for Gmail** - regular passwords won't work
3. **Test with one student first** - before sending to multiple students
4. **Check spam folder** - emails might be filtered
5. **Credentials are logged** - check backend console if email fails

## 🆘 Still Having Issues?

1. Check backend console logs for detailed error messages
2. Verify SMTP settings with your email provider
3. Test SMTP connection using online tools
4. Contact your email provider support if needed

