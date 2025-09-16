# JMeter Proxy Setup for Plate App

This guide will help you configure JMeter to intercept HTTP requests from the Plate React Native application for testing purposes.

## Prerequisites

1. **Apache JMeter** installed on your computer
2. **Android device/emulator** or **iOS Simulator**
3. **Plate app** running in development mode

## JMeter Configuration

### 1. Create HTTP(S) Test Script Recorder

1. Open JMeter
2. Right-click on **Test Plan** → **Add** → **Threads (Users)** → **Thread Group**
3. Right-click on **Test Plan** → **Add** → **Non-Test Elements** → **HTTP(S) Test Script Recorder**

### 2. Configure HTTP(S) Test Script Recorder

In the HTTP(S) Test Script Recorder:

- **Port**: `8888` (default)
- **HTTPS Domains**: Add your Supabase domain:
  - `xsovqvbigdettnpeisjs.supabase.co`
- **Target Controller**: Select your Thread Group
- **Grouping**: Choose "Put each group in a new controller"

### 3. Configure HTTPS Certificate (Important for Android 7+)

1. In JMeter, go to **Options** → **Choose Language** → **English** (if not already)
2. Navigate to **bin** folder in your JMeter installation
3. Find `ApacheJMeterTemporaryRootCA.crt` (created when you start the recorder)
4. **Install this certificate on your Android device**:

   **For Android Emulator:**
   ```bash
   # Copy certificate to emulator
   adb push /path/to/ApacheJMeterTemporaryRootCA.crt /sdcard/Download/

   # On emulator: Settings → Security → Install from storage
   ```

   **For Physical Device:**
   - Email the certificate to yourself
   - Download on device
   - Go to Settings → Security → Install certificates
   - Select the JMeter certificate

### 4. Add Recording Controller

1. Right-click on your **Thread Group** → **Add** → **Logic Controller** → **Recording Controller**

### 5. Start Recording

1. Click **Start** button in the HTTP(S) Test Script Recorder
2. JMeter will create a proxy server on `localhost:8888`
3. **Important**: JMeter will generate the certificate file when you start recording

## Device/Emulator Configuration

### For Android Emulator

The app is already configured to use `10.0.2.2:8888` as the proxy (Android emulator's host machine IP).

1. No additional proxy configuration needed - the app will automatically route requests through JMeter when in development mode.

### For Physical Android Device

1. Update the proxy configuration in `/config/development.ts`:

```typescript
proxy: {
  enabled: __DEV__,
  host: 'YOUR_COMPUTER_IP', // Replace with your computer's IP address
  port: 8888,
  protocol: 'http',
}
```

2. Find your computer's IP address:
   - **Windows**: `ipconfig`
   - **macOS/Linux**: `ifconfig` or `ip addr show`

3. Ensure your device and computer are on the same network.

### For iOS Simulator

1. Update the proxy configuration in `/config/development.ts`:

```typescript
proxy: {
  enabled: __DEV__,
  host: 'localhost', // iOS Simulator uses localhost
  port: 8888,
  protocol: 'http',
}
```

## App Configuration

The app automatically includes JMeter integration when running in development mode (`__DEV__ = true`).

### Android 7+ HTTPS Support

The app includes network security configuration for Android 7+ (API 24+) to support HTTPS interception:

- **File**: `android/app/src/main/res/xml/network_security_config.xml`
- **Purpose**: Allows trusting user-installed certificates in debug builds
- **Security**: Only active in debug builds, production remains secure

**Key Features:**
- Trusts user-added CA certificates (for JMeter's certificate)
- Allows cleartext traffic for development domains
- Maintains security in production builds

### Features Included:

1. **Custom Headers**: All requests include:
   - `X-JMeter-Source: plate-app`
   - `X-Request-ID: unique_request_id`
   - `X-Request-Timestamp: timestamp`
   - `X-App-Version: 1.0.0`
   - `X-Platform: react-native`

2. **Request Logging**: Console logs show:
   - Request details
   - Response status and timing
   - Proxy routing information

3. **Automatic Detection**: The app detects when JMeter proxy is available

## Testing the Setup

### 1. Start JMeter Recording

1. Open JMeter
2. Start the HTTP(S) Test Script Recorder
3. Verify it's listening on port 8888

### 2. Launch the App

```bash
npm start
# Then press 'a' for Android or 'i' for iOS
```

### 3. Verify Connection

Look for these console messages in your app:

```
📋 Development Configuration Loaded:
🔧 JMeter Proxy: ENABLED
🌐 Proxy URL: http://10.0.2.2:8888
🚀 Auto-enabling JMeter interception in development mode
🎯 JMeter interception enabled
📡 Proxy configuration: http://10.0.2.2:8888
📝 All network requests will now be logged and routed through JMeter proxy
```

### 4. Generate Traffic

1. Navigate through the app
2. Sign in/out
3. Search for restaurants
4. Make bookings
5. Check the JMeter Recording Controller - you should see captured requests

## Debugging

### Common Issues:

1. **Proxy not working**:
   - Check if JMeter is running and listening on the correct port
   - Verify IP address configuration for physical devices
   - Ensure device and computer are on the same network

2. **HTTPS issues (Android 7+ specific)**:
   - **Certificate not installed**: Install JMeter's `ApacheJMeterTemporaryRootCA.crt` on device
   - **Certificate not trusted**: Go to Settings → Security → Trusted credentials → User tab
   - **Network security config**: Verify `network_security_config.xml` is properly configured
   - **App rebuild required**: After adding network security config, rebuild the app

3. **No requests captured**:
   - Check console logs for proxy-related messages
   - Verify the app is running in development mode
   - Ensure the Recording Controller is properly configured

4. **Android 7+ Certificate Installation**:
   ```bash
   # For emulator - copy certificate
   adb push /path/to/ApacheJMeterTemporaryRootCA.crt /sdcard/Download/

   # Then on device/emulator:
   # Settings → Security → Install from storage → Select certificate
   ```

5. **SSL Handshake Failures**:
   - Ensure JMeter certificate is installed and trusted
   - Check that `network_security_config.xml` includes `<certificates src="user" />`
   - Rebuild the app after certificate installation

### Console Commands:

You can use these JavaScript commands in Chrome DevTools (if using Expo Go) or React Native Debugger:

```javascript
// Check proxy status
console.log('Proxy enabled:', require('./config/development').shouldUseProxy());

// View request logs
require('./lib/jmeter-proxy').printRequestSummary();

// Clear logs
require('./lib/jmeter-proxy').clearLogs();
```

## Security Notes

- JMeter proxy integration is **only active in development mode**
- All proxy configurations are automatically disabled in production builds
- The `usesCleartextTraffic` attribute is safely configured for development testing

## Captured Request Analysis

Once you've captured requests in JMeter, you can:

1. **Replay requests** for load testing
2. **Modify parameters** for boundary testing
3. **Create test scenarios** based on real app usage
4. **Performance test** the Supabase backend
5. **Security test** API endpoints

The captured requests will include all authentication headers, making it easy to create realistic test scenarios.