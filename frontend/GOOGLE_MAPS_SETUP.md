# Google Maps API Setup Guide

## Overview

The admin panel's Cities & Zones feature uses Google Maps JavaScript API to enable visual zone boundary definition through interactive map drawing. This guide explains how to obtain and configure your Google Maps API key.

## Prerequisites

- Google Cloud Platform account
- Access to Google Cloud Console
- Admin access to the application

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name (e.g., "StylingWithMuskan-Maps")
4. Click "Create"

## Step 2: Enable Required APIs

1. Navigate to **APIs & Services** → **Library**
2. Search for and enable the following APIs:
   - **Maps JavaScript API** (Required for map rendering)
   - **Places API** (Optional, for location search features)

## Step 3: Create API Key

1. Navigate to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **API key**
3. Copy the generated API key
4. Click **Edit API key** to configure restrictions

## Step 4: Configure API Key Restrictions

### Application Restrictions (Recommended for Production)

**For Development:**
- Select **None** to allow testing from localhost

**For Production:**
- Select **HTTP referrers (web sites)**
- Add your domain(s):
  ```
  https://yourdomain.com/*
  https://www.yourdomain.com/*
  ```

### API Restrictions (Highly Recommended)

1. Select **Restrict key**
2. Enable only the APIs you need:
   - Maps JavaScript API
   - Places API (if using location search)

This prevents unauthorized use of your API key for other Google services.

## Step 5: Configure Environment Variables

### Development Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your API key to `.env`:
   ```env
   VITE_GOOGLE_MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

3. Restart the development server:
   ```bash
   npm run dev
   ```

### Production Environment

**For Vercel/Netlify:**
1. Go to project settings → Environment Variables
2. Add `VITE_GOOGLE_MAPS_API_KEY` with your production API key
3. Redeploy the application

**For Docker/VPS:**
1. Add to your `.env` file (not committed to git)
2. Or set as system environment variable
3. Restart the application

## Step 6: Verify Configuration

1. Log in to the admin panel
2. Navigate to **Cities & Zones**
3. Click **Add Zone** for any city
4. The map modal should load successfully

**If you see an error:**
- "Configuration Error" → API key not set in environment variables
- "Failed to Load Google Maps" → Invalid API key or API not enabled
- Map loads but shows "For development purposes only" → API key restrictions not configured

## Security Best Practices

### ✅ DO:
- Restrict API key to specific domains in production
- Restrict API key to only required APIs
- Use separate API keys for development and production
- Monitor API usage in Google Cloud Console
- Set up billing alerts to prevent unexpected charges

### ❌ DON'T:
- Commit API keys to version control (use `.env` files)
- Share API keys publicly or in screenshots
- Use production API keys in development
- Leave API keys unrestricted in production

## API Usage and Billing

### Free Tier
Google Maps provides $200 free credit per month, which covers:
- ~28,000 map loads per month
- ~40,000 geocoding requests per month

### Monitoring Usage
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Dashboard**
3. View usage metrics for Maps JavaScript API

### Setting Billing Alerts
1. Navigate to **Billing** → **Budgets & alerts**
2. Click **CREATE BUDGET**
3. Set threshold (e.g., $50) and email notifications

## Troubleshooting

### Error: "This page can't load Google Maps correctly"

**Cause:** API key not configured or invalid

**Solution:**
1. Verify `VITE_GOOGLE_MAPS_API_KEY` is set in `.env`
2. Check API key is valid in Google Cloud Console
3. Ensure Maps JavaScript API is enabled

### Error: "RefererNotAllowedMapError"

**Cause:** Domain not whitelisted in API key restrictions

**Solution:**
1. Go to Google Cloud Console → Credentials
2. Edit your API key
3. Add your domain to HTTP referrers list

### Error: "ApiNotActivatedMapError"

**Cause:** Maps JavaScript API not enabled for project

**Solution:**
1. Go to Google Cloud Console → APIs & Services → Library
2. Search for "Maps JavaScript API"
3. Click **ENABLE**

### Map Shows "For development purposes only" Watermark

**Cause:** Billing not enabled on Google Cloud project

**Solution:**
1. Go to Google Cloud Console → Billing
2. Link a billing account to your project
3. Note: You won't be charged unless you exceed free tier

## Support

For Google Maps API issues:
- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [Google Maps Platform Support](https://developers.google.com/maps/support)

For application-specific issues:
- Check application logs for detailed error messages
- Contact your system administrator
