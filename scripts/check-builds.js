#!/usr/bin/env node

/**
 * Quick build status checker for RBS app
 * Run with: node scripts/check-builds.js
 */

const { execSync } = require('child_process');

console.log('🔍 Checking recent EAS builds for RBS...\n');

try {
  // Get recent builds
  const buildsOutput = execSync('eas build:list --limit 10 --json', { 
    encoding: 'utf8',
    cwd: __dirname + '/..'
  });
  
  const builds = JSON.parse(buildsOutput);
  
  if (builds.length === 0) {
    console.log('No builds found. Start your first build with: npm run build:apk');
    return;
  }

  console.log('Recent builds:');
  console.log('='.repeat(80));
  
  builds.forEach((build, index) => {
    const date = new Date(build.createdAt).toLocaleDateString();
    const time = new Date(build.createdAt).toLocaleTimeString();
    const platform = build.platform.toUpperCase();
    const profile = build.buildProfile || 'unknown';
    const status = build.status;
    
    // Status emoji
    const statusEmoji = {
      'finished': '✅',
      'in-progress': '🔄',
      'pending': '⏳',
      'error': '❌',
      'canceled': '⚠️'
    }[status] || '❓';
    
    console.log(`${index + 1}. ${statusEmoji} ${platform} (${profile})`);
    console.log(`   Status: ${status}`);
    console.log(`   Date: ${date} ${time}`);
    if (build.artifacts?.buildUrl) {
      console.log(`   Download: ${build.artifacts.buildUrl}`);
    }
    console.log(`   View: https://expo.dev/accounts/qwerty-app/projects/Booklet/builds/${build.id}`);
    console.log('');
  });
  
} catch (error) {
  console.error('Error checking builds:', error.message);
  console.log('\nTry running: eas build:list');
}
