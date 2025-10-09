# Deploy Phone Verification Edge Functions

## Updated Edge Functions

I've updated both edge functions with comprehensive error handling:

### ✅ What's New:

**send-otp function:**
- ✅ Handles Twilio-specific error codes
- ✅ Detects blocked phone numbers
- ✅ Detects rate limiting
- ✅ Better error messages

**verify-otp function:**
- ✅ Checks if phone number is already in use (UNIQUE constraint)
- ✅ Returns specific error: `phone_already_in_use`
- ✅ Handles all Twilio verification errors
- ✅ Better error logging

## Deploy Commands

Run these commands to deploy the updated edge functions:

```bash
# Deploy send-otp
npx supabase functions deploy send-otp

# Deploy verify-otp  
npx supabase functions deploy verify-otp
```

Or deploy both at once:
```bash
npx supabase functions deploy send-otp verify-otp
```

## Handled Errors

### Send OTP Errors:
- ✅ `phone_number_blocked` - "This phone number is blocked. Please use a different number."
- ✅ `max_send_attempts_reached` - "Too many verification attempts. Please try again later."
- ✅ `too_many_requests` - "Too many requests. Please wait a few minutes and try again."
- ✅ `invalid_phone_number` - "Invalid phone number format."
- ✅ Twilio generic errors with user-friendly messages

### Verify OTP Errors:
- ✅ `invalid_code` - "Invalid verification code. Please try again."
- ✅ `phone_already_in_use` - "This phone number is already registered to another account."
- ✅ `profile_update_failed` - "Failed to update your profile. Please try again."
- ✅ `missing_jwt` / `invalid_jwt` - "Session expired. Please sign in again."

## Testing After Deployment

1. **Test with blocked number (should fail gracefully):**
   - Try `+96170993415` 
   - Should show: "This phone number is blocked..."

2. **Test with valid number (should work):**
   - Use a real, active phone number
   - Should receive OTP code

3. **Test duplicate phone number:**
   - Try to verify the same number with a different account
   - Should show: "This phone number is already registered..."

4. **Test invalid OTP:**
   - Enter wrong code
   - Should show: "Invalid verification code..."

## Next Steps

1. Deploy the edge functions (commands above)
2. Test with a valid phone number
3. All errors will now show user-friendly messages!

The app-side code is already updated and ready - just deploy the edge functions! 🚀

