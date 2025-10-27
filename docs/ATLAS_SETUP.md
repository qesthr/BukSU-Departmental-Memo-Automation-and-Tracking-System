# MongoDB Atlas Setup Guide

## Step 1: Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/atlas
2. Sign up for free account
3. Create a new cluster (choose FREE tier)

## Step 2: Get Connection String
1. Click "Connect" on your cluster
2. Choose "Connect your application"
3. Copy the connection string

## Step 3: Update Environment Variables
Replace the MONGODB_URI in your environment:

### For Local MongoDB (current):
```
MONGODB_URI=mongodb://localhost:27017/buksu-memo-system
```

### For MongoDB Atlas (recommended):
```
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/buksu-memo-system?retryWrites=true&w=majority
```

## Step 4: Test Atlas Connection
Run the user creation script to test Atlas:
```bash
node backend/scripts/createAdmin.js
```

## Benefits of Atlas:
✅ Cloud-hosted (no local setup needed)
✅ Always available
✅ Automatic backups
✅ Built-in security
✅ Scalable
✅ Accessible from anywhere

## Current Status:
- Local MongoDB: ✅ Working
- Atlas Setup: ⏳ Pending your Atlas credentials
