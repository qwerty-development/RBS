# Phone Verification Implementation

## Overview
This document outlines the phone verification system that has been implemented for the RBS app. Phone verification is required for users to make restaurant bookings.

## Features Implemented

### 1. **Phone Verification Modal** (`components/auth/PhoneVerificationModal.tsx`)
- Country code selector with common countries (Lebanon, USA, UK, UAE, Saudi Arabia, etc.)
- Phone number input (E.164 format)
- 6-digit OTP verification
- Two-step process: Phone Entry → OTP Verification
- Can be configured as skippable or mandatory
- Beautiful UI with proper error handling

### 2. **Phone Verification Hook** (`hooks/usePhoneVerification.ts`)
- `sendOTP(phoneE164)` - Sends OTP to phone number
- `verifyOTP(code, phoneE164)` - Verifies OTP code
- `usePhoneVerification()` - Hook with state management
- Calls your edge functions: `send-otp` and `verify-otp`
- Automatic profile refresh after verification

### 3. **Database Updates**
Updated Profile type to include:
- `phone_e164` (string) - Phone number in E.164 format
- `phone_verified` (boolean) - Verification status
- `phone_verified_at` (timestamp) - When verification happened

Files updated:
- `stores/index.ts`
- `context/supabase-provider.tsx`

### 4. **Home Screen Integration** (`app/(protected)/(tabs)/index.tsx`)
- Automatically shows verification modal on first sign-in
- Modal appears 1.5 seconds after home screen loads (for better UX)
- Only shows once per session (stored in AsyncStorage)
- Can be skipped, but user will need to verify later to book

### 5. **Profile Icon Warning** (`components/home/HomeHeader.tsx`)
- Yellow outline on profile icon when phone not verified
- Yellow badge with exclamation mark icon
- Only shows green "online" indicator when verified

### 6. **Profile Settings** (`app/(protected)/profile.tsx`)
- New menu item: "Verify Phone Number" in Account section
- Shows yellow "Required" badge when not verified
- Shows phone number and green checkmark when verified
- Once verified, phone number is locked (user cannot change it)
- Modal cannot be skipped from profile (mandatory)

### 7. **Booking Restrictions**
**Two layers of protection:**

a) **Booking Creation Screen** (`app/(protected)/booking/create.tsx`)
   - Checks verification status when screen loads
   - Shows alert if not verified
   - Redirects to profile or back

b) **Booking Confirmation Hook** (`hooks/useBookingConfirmation.ts`)
   - Final check before any booking is submitted
   - Blocks ALL booking attempts if not verified
   - Shows alert with option to go to profile
   - Applies to all booking types (instant, request, waitlist)

## User Flow

### First-Time User Flow:
1. User signs in for the first time
2. After 1.5 seconds on home page, verification modal appears
3. User can:
   - **Verify now**: Select country → Enter phone → Enter OTP → Success!
   - **Skip**: Modal closes, but warning appears on profile icon

### Skipped Verification Flow:
1. User has yellow outline + exclamation mark on profile icon
2. When trying to book:
   - Alert appears: "Phone Verification Required"
   - Options: "Go to Profile" or "Cancel"
3. User goes to profile and clicks "Verify Phone Number"
4. Completes verification
5. Can now make bookings normally

### Verified User Flow:
1. Profile icon shows normal border with green online indicator
2. Can make bookings without any restrictions
3. Phone number displayed in profile (cannot be changed)

## Edge Functions Integration

### send-otp
```typescript
// Called when user submits phone number
POST /functions/v1/send-otp
Body: { phone: "+96170123456", channel: "sms" }
Response: { status: "sent" }
```

### verify-otp
```typescript
// Called when user submits OTP code
POST /functions/v1/verify-otp
Headers: { Authorization: "Bearer <jwt_token>" }
Body: { phone: "+96170123456", code: "123456" }
Response: { status: "verified" }
```

The verify-otp function automatically:
- Verifies the code with Twilio
- Updates the profile with:
  - `phone_verified = true`
  - `phone_verified_at = current_timestamp`
  - `phone_number = phone` (stores the verified E.164 number)

## Testing Checklist

### Setup
- [ ] Ensure Twilio credentials are set in Supabase edge function secrets:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_VERIFY_SERVICE_SID`
- [ ] Run database migration to add new columns to profiles table

### Test Cases
- [ ] **First sign-in**: Modal appears after 1.5 seconds
- [ ] **Country selector**: Can select different countries
- [ ] **Phone input**: Only accepts numbers
- [ ] **Send OTP**: Code is sent to phone
- [ ] **Verify OTP**: 6-digit code works
- [ ] **Profile icon**: Yellow warning appears when not verified
- [ ] **Skip verification**: Can skip from home, but booking blocked
- [ ] **Booking blocked**: Alert appears when trying to book without verification
- [ ] **Profile verification**: Can verify from profile settings
- [ ] **Verified state**: Green checkmark shows, phone number locked
- [ ] **Booking allowed**: Can book after verification

## Phone Number Format (E.164)
The system uses E.164 format for phone numbers:
- Format: `+[country code][number]`
- Examples:
  - Lebanon: `+96170123456`
  - USA: `+14155551234`
  - UK: `+447700900123`

## Security Features
1. **OTP expires**: Twilio handles OTP expiration (typically 10 minutes)
2. **JWT authentication**: verify-otp requires valid user JWT
3. **One-way operation**: Once verified, phone cannot be changed
4. **Server-side validation**: All verification happens on Twilio/Supabase
5. **Rate limiting**: Handled by Twilio Verify service

## Files Modified/Created

### Created:
- `components/auth/PhoneVerificationModal.tsx`
- `hooks/usePhoneVerification.ts`
- `PHONE_VERIFICATION_IMPLEMENTATION.md` (this file)

### Modified:
- `stores/index.ts` - Added phone verification fields to Profile type
- `context/supabase-provider.tsx` - Added phone verification fields to Profile type
- `components/home/HomeHeader.tsx` - Added yellow warning indicator
- `app/(protected)/(tabs)/index.tsx` - Added verification modal on first sign-in
- `app/(protected)/profile.tsx` - Added verification menu item and modal
- `app/(protected)/booking/create.tsx` - Added verification check on load
- `hooks/useBookingConfirmation.ts` - Added verification check before booking

## Notes
- The verification modal uses AsyncStorage to track if user has been prompted in current session
- Key format: `phone-verification-prompted-{userId}`
- Modal shows once per app session (until app is closed/restarted)
- All bookings are blocked at the confirmation hook level (final safety net)
- Phone numbers are displayed in E.164 format in the profile

## Support
If you need to manually verify a user's phone (for testing or support):
```sql
UPDATE profiles 
SET 
  phone_verified = true,
  phone_verified_at = NOW(),
  phone_e164 = '+96170123456'
WHERE id = 'user-uuid';
```

## Future Enhancements (Optional)
- Add "Resend Code" countdown timer
- Add phone number change flow (with admin approval)
- Add SMS/WhatsApp channel selection
- Add international phone number formatting display
- Add verification reminder notifications

