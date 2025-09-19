#!/usr/bin/env node

/**
 * Quick build status checker for Plate app
 * Run with: node scripts/check-builds.js
 */

const { execSync } = require('child_process');



try {
  // Get recent builds
  const buildsOutput = execSync('eas build:list --limit 10 --json', { 
    encoding: 'utf8',
    cwd: __dirname + '/..'
  });
  
  const builds = JSON.parse(buildsOutput);
  
  if (builds.length === 0) {
 
    return;
  }


  
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
    
  
    if (build.artifacts?.buildUrl) {

    }

  });
  
} catch (error) {
 
}
