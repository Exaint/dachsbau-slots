/**
 * Direct KV to D1 Migration Script
 *
 * Run with: npx wrangler d1 execute dachsbau-slots-db --remote --command "SELECT COUNT(*) FROM users"
 *
 * This script is meant to be run via wrangler to migrate data from KV to D1.
 * For a full migration, use the Admin API while logged in as admin.
 */

// Instructions:
// 1. Go to https://dachsbau-slots.exaint.workers.dev/?page=profile&user=YOUR_ADMIN_USERNAME
// 2. Open browser DevTools (F12) -> Console
// 3. Run this code:

const migrationCode = `
// D1 Migration - Run in browser console while logged in as admin
// ===============================================================

// Step 1: Check migration status
async function checkStatus() {
  const res = await fetch('/?api=admin&action=d1-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const data = await res.json();
  console.log('Migration Status:', data);
  return data;
}

// Step 2: Run migration (dry run first)
async function migrate(dryRun = true, batchSize = 100) {
  console.log(dryRun ? '🔍 DRY RUN - no changes will be made' : '🚀 LIVE MIGRATION');
  const res = await fetch('/?api=admin&action=d1-migrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dryRun, batchSize })
  });
  const data = await res.json();
  console.log('Migration Result:', data);
  return data;
}

// Step 3: Verify migration
async function verify(sampleSize = 50) {
  const res = await fetch('/?api=admin&action=d1-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sampleSize })
  });
  const data = await res.json();
  console.log('Verification Result:', data);
  return data;
}

// Run these commands in order:
// 1. await checkStatus()
// 2. await migrate(true)   // Dry run first
// 3. await migrate(false)  // Actual migration
// 4. await verify()
`;

console.log('='.repeat(60));
console.log('D1 MIGRATION INSTRUCTIONS');
console.log('='.repeat(60));
console.log('');
console.log('1. Log in as admin at https://dachsbau-slots.exaint.workers.dev');
console.log('2. Open browser DevTools (F12) -> Console tab');
console.log('3. Copy and paste the following code:');
console.log('');
console.log('-'.repeat(60));
console.log(migrationCode);
console.log('-'.repeat(60));
console.log('');
console.log('4. Then run:');
console.log('   await checkStatus()   // Check current status');
console.log('   await migrate(true)   // Dry run (no changes)');
console.log('   await migrate(false)  // Actual migration');
console.log('   await verify()        // Verify data');
console.log('');
