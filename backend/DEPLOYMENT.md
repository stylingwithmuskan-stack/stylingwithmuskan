# Deployment Guide for Render

## Prerequisites
- Render account
- MongoDB Atlas cluster
- Environment variables ready

## Deployment Steps

### 1. Create Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the `backend` directory (if monorepo)

### 2. Configure Build Settings

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
node src/server.js
```

**Environment:** `Node`

### 3. Set Environment Variables

Go to "Environment" tab and add these variables:

#### Core
```
NODE_ENV=production
PORT=3001
```

#### Database
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=Cluster0
MONGO_DB=swm
REDIS_URL=redis://localhost:6379
```

#### Security
```
JWT_SECRET=your-strong-secret-key-here
ALLOWED_ORIGINS=https://your-frontend.com,https://www.your-frontend.com
```

#### SMS India Hub
```
SMSINDIAHUB_API_KEY=your-api-key
SMSINDIAHUB_SENDER_ID=SMSHUB
SMSINDIAHUB_MESSAGE_TEMPLATE=Welcome to Styling With Muskan. Your OTP is {otp}
```

#### Admin
```
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=strong-password-here
```

#### Cloudinary
```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

#### Razorpay
```
RAZORPAY_KEY_ID=your-key-id
RAZORPAY_KEY_SECRET=your-key-secret
```

#### Firebase Push Notifications
```
FIREBASE_PROJECT_ID=stylingwithmuskan-635f3
PUSH_DEFAULT_ICON_URL=https://your-frontend.com/logo.png
PUSH_DEFAULT_CLICK_BASE_URL=https://your-frontend.com
PUSH_BATCH_SIZE=100
PUSH_RETRY_LIMIT=3
```

#### OTP Defaults
```
DEFAULT_USER_OTP_PHONE=9990000001
DEFAULT_PROVIDER_OTP_PHONES=9100000001,9100000002,9100000003,9100000004
DEFAULT_VENDOR_OTP_PHONE=9999999999
DEFAULT_USER_OTP=123456
DEFAULT_PROVIDER_OTP=123456
DEFAULT_VENDOR_OTP=123456
```

### 4. Deploy

1. Click "Create Web Service"
2. Render will automatically deploy
3. Monitor logs for successful startup

### 5. Verify Deployment

Check logs for:
```
[DB] ✅ Mongo connected to Atlas/Remote db=swm
[Server] API listening on http://0.0.0.0:3001 env=production
```

### 6. Update Frontend

Update frontend `.env` with Render backend URL:
```
VITE_API_BASE_URL=https://your-backend.onrender.com
```

**Frontend Environment Variables:**

```env
# Backend API
VITE_API_BASE_URL=https://your-backend.onrender.com

# Payment Gateway
VITE_RAZORPAY_KEY_ID=your-razorpay-key-id

# Google Maps (for admin zone drawing)
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Firebase Push Notifications
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
VITE_FIREBASE_VAPID_KEY=your-vapid-key
```

**Google Maps API Setup:**
- See `frontend/GOOGLE_MAPS_SETUP.md` for detailed instructions
- Required for admin Cities & Zones map drawing feature
- Get key from: https://console.cloud.google.com/google/maps-apis
- Enable: Maps JavaScript API
- Restrict key to your production domain

## Important Notes

### ❌ DO NOT USE PM2 on Render
Render handles process management automatically. Use simple `node` command.

### ✅ Health Check
Render will ping `/health` endpoint to check if service is running.

### ✅ Auto-Deploy
Render automatically deploys when you push to your main branch.

### ✅ Logs
View real-time logs in Render dashboard under "Logs" tab.

### ✅ MongoDB Atlas IP Whitelist
Add Render's IP to MongoDB Atlas:
- Go to MongoDB Atlas → Network Access
- Add IP: `0.0.0.0/0` (allow all) for simplicity
- Or add specific Render IPs from their documentation

## Troubleshooting

### Error: querySrv ENOTFOUND
**Cause:** MongoDB URI not set or incorrect in Render environment variables
**Fix:** Double-check `MONGO_URI` in Render dashboard

### Error: Firebase admin not configured
**Cause:** Firebase service account file not available
**Fix:** Ensure `backend/src/config/stylingwithmuskan-635f3-firebase-adminsdk-*.json` is committed to git (if not sensitive) or set Firebase env vars

### Error: Redis connection failed
**Cause:** Redis not available on Render free tier
**Fix:** App falls back to in-memory store automatically (check logs)

### Error: Port already in use
**Cause:** Render sets PORT automatically
**Fix:** Ensure your code uses `process.env.PORT` (already configured)

## Production Checklist

- [ ] All environment variables set in Render dashboard
- [ ] MongoDB Atlas IP whitelist configured
- [ ] Frontend CORS origins updated in `ALLOWED_ORIGINS`
- [ ] JWT_SECRET changed from default
- [ ] Admin password changed from default
- [ ] Firebase service account file present
- [ ] Health check endpoint working
- [ ] Logs showing successful startup
- [ ] Frontend connected to production backend URL

## Support

For issues, check:
1. Render deployment logs
2. MongoDB Atlas connection
3. Environment variables spelling
4. CORS configuration
