# Phone Verification Debugging Guide

## Error: "Edge function returned a non-2xx status code"

This error means the edge function is being called but returning an error response. Here's how to debug:

### Step 1: Check if Edge Functions are Deployed

```bash
# Check Supabase project
npx supabase functions list

# Expected output should show:
# - send-otp
# - verify-otp
```

If functions are not listed, deploy them:

```bash
# Deploy send-otp
npx supabase functions deploy send-otp

# Deploy verify-otp
npx supabase functions deploy verify-otp
```

### Step 2: Check Environment Variables

The edge functions need Twilio credentials. Check Supabase Dashboard:

1. Go to **Project Settings** → **Edge Functions**
2. Verify these secrets are set:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_VERIFY_SERVICE_SID`

Set them if missing:

```bash
npx supabase secrets set TWILIO_ACCOUNT_SID=your_account_sid
npx supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token
npx supabase secrets set TWILIO_VERIFY_SERVICE_SID=your_verify_sid
```

### Step 3: Test Edge Functions Directly

Test send-otp:
```bash
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-otp' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+96170123456"}'
```

Expected success response:
```json
{"status":"sent"}
```

Test verify-otp:
```bash
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/verify-otp' \
  -H 'Authorization: Bearer YOUR_USER_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+96170123456","code":"123456"}'
```

Expected success response:
```json
{"status":"verified"}
```

### Step 4: Check Edge Function Logs

View logs in real-time:
```bash
npx supabase functions logs send-otp --follow
npx supabase functions logs verify-otp --follow
```

Or in Supabase Dashboard:
1. Go to **Edge Functions**
2. Click on function name
3. View **Logs** tab

### Step 5: Common Error Messages and Solutions

#### "Function not found"
- **Cause**: Edge function not deployed
- **Solution**: Deploy using `npx supabase functions deploy send-otp`

#### "Missing environment variable"
- **Cause**: Twilio credentials not set
- **Solution**: Set secrets as shown in Step 2

#### "Invalid phone number"
- **Cause**: Phone not in E.164 format
- **Solution**: Ensure format is `+[country code][number]` (e.g., `+96170123456`)

#### "Invalid verification code"
- **Cause**: Wrong OTP entered or code expired
- **Solution**: Request new code (codes typically expire in 10 minutes)

#### "CORS error"
- **Cause**: Edge function CORS not configured
- **Solution**: Edge functions should automatically handle CORS, but check if you have custom CORS settings

#### "Network request failed"
- **Cause**: Device network issues or Supabase project offline
- **Solution**: Check internet connection and Supabase project status

### Step 6: Enable Debug Logging in App

The phone verification hook now includes detailed console logging. To see logs:

**For iOS (Simulator):**
```bash
npx react-native log-ios
```

**For Android:**
```bash
npx react-native log-android
```

**Or in Expo:**
```bash
npx expo start
# Then press 'j' to open debugger
```

Look for logs prefixed with:
- `[sendOTP]` - Send OTP function logs
- `[verifyOTP]` - Verify OTP function logs

### Step 7: Verify Twilio Verify Service

1. Log into [Twilio Console](https://console.twilio.com)
2. Go to **Verify** → **Services**
3. Check your Verify Service is active
4. Verify the Service SID matches `TWILIO_VERIFY_SERVICE_SID`
5. Check service settings:
   - Code length: 6 digits (default)
   - Code expiration: 10 minutes (default)
   - SMS enabled

### Step 8: Test with a Real Phone Number

Make sure you're testing with a valid phone number that can receive SMS:
- Use your own phone number first
- Ensure the number is in E.164 format
- For Lebanon: `+961` + `70` + `123456`
- Check if you received the SMS

### Step 9: Check Supabase Project

1. Go to Supabase Dashboard
2. Check **Project Status** - should be "Healthy"
3. Verify your project is not paused
4. Check if you have available Edge Function invocations in your plan

### Step 10: Verify Database Columns

Make sure the profiles table has the required columns (you should already have these):

```sql
-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN ('phone_number', 'phone_verified', 'phone_verified_at');
```

Your existing schema already has these columns:
- `phone_number` (text) - Already exists in your schema
- `phone_verified` (boolean NOT NULL DEFAULT false) - Already added
- `phone_verified_at` (timestamptz) - Already added

## Testing Checklist

- [ ] Edge functions deployed (`send-otp`, `verify-otp`)
- [ ] Twilio credentials set in Supabase secrets
- [ ] Twilio Verify Service is active
- [ ] Database columns exist in profiles table
- [ ] Test phone number is valid and can receive SMS
- [ ] Supabase project is healthy and not paused
- [ ] App has internet connection
- [ ] Phone number in correct E.164 format

## Quick Test Script

Test the entire flow:

```javascript
// In your app console/debugger:

// 1. Test send OTP
const result1 = await sendOTP("+96170123456");
console.log("Send OTP result:", result1);
// Should see: { success: true }

// 2. Check your phone for SMS
// Enter the code you received

// 3. Test verify OTP
const result2 = await verifyOTP("123456", "+96170123456");
console.log("Verify OTP result:", result2);
// Should see: { success: true }
```

## Still Having Issues?

If you're still seeing errors, provide:
1. The exact error message from console logs
2. Edge function logs from Supabase Dashboard
3. Which step you're at (sending OTP or verifying)
4. The phone number format you're using (anonymized)

Common gotchas:
- ❌ Phone format: `70123456` or `00961123456` (wrong)
- ✅ Phone format: `+96170123456` (correct)
- ❌ Testing with fake/invalid phone numbers
- ✅ Testing with real, active phone numbers

