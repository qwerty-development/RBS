# Android APK Build Guide

This guide explains how to build APK files for your TableReserve (RBS) app using EAS Build.

## 📋 Prerequisites

1. **EAS CLI** - Already installed ✅
2. **Expo Account** - Make sure you're logged in
3. **Android SDK** (for local builds only)

## 🚀 Build Commands

### Cloud Builds (Recommended)

```bash
# Build APK for testing/distribution
npm run build:apk

# Or use the direct EAS command
eas build --platform android --profile apk
```

### Local Builds (Optional)

```bash
# Build APK locally (requires Android SDK)
npm run build:apk:local

# Or use the direct EAS command
eas build --platform android --profile apk --local
```

### Other Build Options

```bash
# Build preview version
npm run build:android:preview

# Build production AAB for Play Store
npm run build:production
```

## 🔧 Build Profiles

Your `eas.json` includes these Android build profiles:

### `apk` Profile
- **Output**: APK file for direct installation
- **Distribution**: Internal testing
- **Channel**: production
- **Use Case**: Testing, side-loading, or distribution outside Play Store

### `preview` Profile  
- **Output**: AAB file
- **Distribution**: Internal testing
- **Use Case**: Internal testing before production

### `production` Profile
- **Output**: AAB file for Play Store
- **Distribution**: Store submission
- **Use Case**: Official app store releases

## 📱 Installing the APK

After the build completes:

1. **Download the APK** from the EAS build page
2. **Transfer to Android device** via:
   - USB transfer
   - Email/cloud storage
   - Direct download on device
3. **Enable "Install from Unknown Sources"** in Android settings
4. **Install the APK** by tapping on it

## 🔍 Build Status & Logs

### Check Build Status
```bash
# View recent builds
eas build:list

# View specific build details
eas build:view [BUILD_ID]

# View build logs
eas build:view [BUILD_ID] --logs
```

### Monitor Builds
- Visit [EAS Build Dashboard](https://expo.dev/accounts/qwerty-app/projects/Booklet/builds)
- Get real-time notifications via CLI
- Check build artifacts and logs

## ⚡ Quick Start

1. **Start a build**:
   ```bash
   npm run build:apk
   ```

2. **Monitor progress**:
   - CLI will show build URL
   - Visit the URL to track progress
   - Get notified when complete

3. **Download & test**:
   - Download APK from build page
   - Install on Android device
   - Test your app!

## 🛠️ Troubleshooting

### Common Issues

**Build fails with "Metro bundler failed"**:
```bash
# Clear Metro cache
npx expo start --clear
# Then retry the build
```

**"Gradle build failed"**:
- Check Android configuration in `app.json`
- Verify all required permissions are listed
- Check build logs for specific errors

**APK won't install**:
- Ensure "Unknown Sources" is enabled
- Check if device has enough storage
- Verify APK isn't corrupted (re-download)

### Get Help
```bash
# EAS CLI help
eas build --help

# View build configuration
eas build:configure
```

## 📦 File Outputs

- **APK builds**: `.apk` file (can be directly installed)
- **AAB builds**: `.aab` file (for Play Store submission)
- **Build logs**: Available on EAS dashboard
- **Source maps**: For debugging (if enabled)

## 🔐 Environment Variables

Your builds include:
- Supabase configuration
- Google Maps API keys
- Sentry configuration (disabled during builds)

All sensitive keys are handled securely by EAS Build.

## 📈 Next Steps

1. **Test the APK** on multiple Android devices
2. **Gather feedback** from beta testers
3. **Build AAB for Play Store** when ready:
   ```bash
   npm run build:production
   ```
4. **Submit to Play Store** using the AAB file

---

For more advanced configurations, see the [EAS Build documentation](https://docs.expo.dev/build/setup/).
