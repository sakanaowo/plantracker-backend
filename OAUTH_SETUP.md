# 🔧 Google OAuth Setup - Add Test Users

## 📍 Direct Link
**Click here:** https://console.cloud.google.com/apis/credentials/consent?project=plantracker-590f5

## 📋 Step-by-Step Instructions

### Method 1: Direct Link (Fastest)
1. Click the link above
2. Scroll down to **"Test users"** section
3. Click **"+ ADD USERS"** button
4. Enter: `anhlandibo88@gmail.com`
5. Click **"SAVE"**

### Method 2: Navigate from Menu
1. Go to: https://console.cloud.google.com/
2. Select project: **plantracker-590f5**
3. Click hamburger menu (☰) → **APIs & Services** → **OAuth consent screen**
4. Scroll down to **"Test users"** section
5. Click **"+ ADD USERS"**
6. Enter: `anhlandibo88@gmail.com`
7. Click **"SAVE"**

## ✅ Verification
After adding the test user:
1. The email should appear in the "Test users" list
2. Try the OAuth flow again - the error should be gone
3. You should see the Google authorization screen

## 🚨 Common Issues

**Issue**: "Test users" section not visible
- **Solution**: Make sure you're on the "OAuth consent screen" page (not "Credentials" or "Overview")

**Issue**: Can't add test user
- **Solution**: Make sure the app is in "Testing" status (not "In production")

**Issue**: Still getting 403 error after adding
- **Solution**: Wait 1-2 minutes for changes to propagate, then clear browser cache

---

**Current Status**: Need to add `anhlandibo88@gmail.com` to test users list
