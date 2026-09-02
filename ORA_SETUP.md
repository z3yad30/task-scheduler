# ⏰ Ora - Static Website Setup

This is a pure client-side application - no backend server needed!

## 🚀 Quick Start

1. **Open `index.html` in your browser** - That's it!
2. Register with an email address (required for Ora notifications)
3. Click ⏰ **Ora** button in top navigation
4. Start adding daily tasks

## ✨ Features

✅ **Daily Tasks** - Add tasks with start/end times  
✅ **Auto Status** - Tasks automatically update: pending → active → completed  
✅ **Notifications** - Check browser console for task notifications  
✅ **Work Hours** - Track total daily work hours  
✅ **Auto-Cleanup** - Tasks auto-delete after 24 hours  
✅ **Email Storage** - User email saved for notifications  
✅ **Persistent Storage** - Uses browser localStorage  

## 📧 Email Setup

Email notifications are logged to **browser console**. To view:
1. Open browser DevTools: `F12`
2. Go to **Console** tab
3. Perform task actions to see notifications

**Hardcoded Email Config** (in app.js):
```javascript
ORA_EMAIL_CONFIG = {
    senderEmail: 'lio.messi.official8@gmail.com',
    appPassword: 'mtyn stzo rkpe rgry'
}
```

## 🔧 Files Structure

```
Task Scheduler/
├── index.html          (Main UI with Ora panel)
├── app.js              (All logic - no dependencies!)
├── style.css           (Styling including Ora styles)
└── README.md           (This file)
```

## 📝 Registration Form

**Login Mode:**
- Username (required)
- Password (required)

**Register Mode:**
- Username (required)
- Password (required)
- Email (required for Ora notifications)

Email is stored with user account for notifications.

## 🎯 Using Ora

### Add a Task
1. Click ⏰ **Ora** button
2. Fill in:
   - Task name (required)
   - Description (optional)
   - Start time (HH:MM format, required)
   - End time (HH:MM format, required)
3. Click "+ Add Task"

### Task Status
- 🔘 **Pending** - Waiting to start
- 🟢 **Active** - Currently running
- ✅ **Completed** - Finished

### View Notifications
Open DevTools (F12) → Console tab to see:
- Task start notifications
- Task transition notifications
- Daily summary

### Send Daily Summary
1. Click ⏰ **Ora**
2. Scroll to "Daily Summary"
3. Click "📧 Send Summary to Email"
4. Check console for output

## 💾 Data Storage

All data stored in browser **localStorage**:
- Tasks: `ora_daily_tasks`
- User session: `gts_session`
- User theme: `gts_theme`

**Data persists** even after closing browser (until cleared manually).

## ⚙️ Customization

### Change Email Credentials
Edit `app.js` line ~1373:
```javascript
const ORA_EMAIL_CONFIG = {
    senderEmail: 'your-email@gmail.com',
    appPassword: 'your-app-password'
};
```

### Change Session Duration
Edit `app.js` line ~9:
```javascript
const SESSION_DURATION = 3 * 60 * 60 * 1000; // 3 hours
```

### Add Email Sending (Optional)
To actually send emails from frontend, use EmailJS:
1. Sign up at https://www.emailjs.com/
2. Get API keys
3. Add EmailJS script to index.html
4. Update notification functions in app.js

## 🔐 Security Notes

- Credentials are hardcoded (for static site use only)
- Never share this code publicly with credentials exposed
- LocalStorage is browser-local only, not encrypted
- For production, use a backend service

## ✅ Browser Compatibility

- Chrome/Edge: ✅ Fully supported
- Firefox: ✅ Fully supported  
- Safari: ✅ Fully supported
- Mobile: ✅ Responsive design

## 🐛 Troubleshooting

**Tasks not saving?**
- Check if localStorage is enabled
- Clear cache and reload

**Email not sending?**
- Check browser console for errors
- Verify user email is set (register with email)

**Time picker issues?**
- Use 24-hour format: `14:30` not `2:30 PM`
- Ensure end time > start time

**Tasks disappearing?**
- Check browser console for errors
- They auto-delete after 24 hours (by design)

## 📂 Files to Ignore/Delete

These files were created for backend setup but are **not needed** for static site:
- `email-sender.js` ❌ Delete
- `task-scheduler.js` ❌ Delete
- `ora-api.js` ❌ Delete
- `server-setup.js` ❌ Delete
- `.env.example` ❌ Delete
- `package.json.example` ❌ Delete
- `IMPLEMENTATION_GUIDE.md` ❌ Delete
- `ORA_DOCUMENTATION.md` ❌ Delete
- `ORA_SUMMARY.md` ❌ Delete
- `QUICKSTART.md` ❌ Delete

## 🎉 You're Ready!

1. ✅ Open `index.html`
2. ✅ Register with email
3. ✅ Click ⏰ Ora
4. ✅ Add tasks
5. ✅ Watch notifications in console

**Happy scheduling!** ⏰
