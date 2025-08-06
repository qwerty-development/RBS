/**
 * Simple test to verify that useWaitlist hook is using the correct auth
 * This file can be deleted after verification
 */

// Check if the imports are correct in the files we modified
const fs = require('fs');
const path = require('path');

function checkFileContent(filePath, expectedContent) {
  const fullPath = path.join(__dirname, filePath);
  const content = fs.readFileSync(fullPath, 'utf8');
  return content.includes(expectedContent);
}

console.log('🔍 Checking auth fix...');

// Check useWaitlist.ts uses correct auth import
const useWaitlistCorrect = checkFileContent('hooks/useWaitlist.ts', 'import { useAuth } from "@/context/supabase-provider"');
console.log('✅ useWaitlist.ts uses correct auth import:', useWaitlistCorrect);

// Check TimeRangeSelector.tsx uses correct auth import  
const timeRangeSelectorCorrect = checkFileContent('components/booking/TimeRangeSelector.tsx', 'import { useAuth } from "@/context/supabase-provider"');
console.log('✅ TimeRangeSelector.tsx uses correct auth import:', timeRangeSelectorCorrect);

// Ensure old imports are not present
const useWaitlistOldImport = checkFileContent('hooks/useWaitlist.ts', 'import { useAuthStore } from "@/stores"');
const timeRangeSelectorOldImport = checkFileContent('components/booking/TimeRangeSelector.tsx', 'import { useAuthStore } from "@/stores"');

console.log('✅ useWaitlist.ts does NOT use old auth import:', !useWaitlistOldImport);
console.log('✅ TimeRangeSelector.tsx does NOT use old auth import:', !timeRangeSelectorOldImport);

if (useWaitlistCorrect && timeRangeSelectorCorrect && !useWaitlistOldImport && !timeRangeSelectorOldImport) {
  console.log('\n🎉 Auth fix is correctly applied!');
  console.log('The waitlist button should now properly recognize authenticated users.');
} else {
  console.log('\n❌ There might be an issue with the auth fix.');
}
