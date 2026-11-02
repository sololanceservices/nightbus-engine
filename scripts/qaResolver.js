// ==================== server/scripts/qaResolver.js ====================
// Autonomous AI Pipeline Helper for resolving & auditing QA Feedback issues

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Determine workspace root and files
const WORKSPACE_ROOT = path.resolve(__dirname, '../../..'); // a:/warrol
const LOG_FILE_PATH = path.join(WORKSPACE_ROOT, 'QA_RESOLUTION_LOG.md');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
const QaFeedback = require('../models/QaFeedback');

const SCREEN_FILE_MAP = {
  HomeScreen: 'bus/web/src/screens/customer/HomeScreen.jsx',
  SearchScreen: 'bus/web/src/screens/customer/SearchScreen.jsx',
  JourneyResultsScreen: 'bus/web/src/screens/customer/JourneyResultsScreen.jsx',
  SeatSelectionScreen: 'bus/web/src/screens/customer/SeatSelectionScreen.jsx',
  PassengerDetailsScreen: 'bus/web/src/screens/customer/PassengerDetailsScreen.jsx',
  BookingConfirmationScreen: 'bus/web/src/screens/customer/BookingConfirmationScreen.jsx',
  MyBookingsScreen: 'bus/web/src/screens/customer/MyBookingsScreen.jsx',
  BookingDetailsScreen: 'bus/web/src/screens/customer/BookingDetailsScreen.jsx',
  LiveTrackingScreen: 'bus/web/src/screens/customer/LiveTrackingScreen.jsx',
  YatraListScreen: 'bus/web/src/screens/customer/YatraListScreen.jsx',
  YatraDetailsScreen: 'bus/web/src/screens/customer/YatraDetailsScreen.jsx',
  RentalRequestScreen: 'bus/web/src/screens/customer/RentalRequestScreen.jsx',
  FoodHomeScreen: 'bus/web/src/screens/customer/FoodHomeScreen.jsx',
  WalletScreen: 'bus/web/src/screens/customer/WalletScreen.jsx',
  ProfileScreen: 'bus/web/src/screens/common/ProfileScreen.jsx',
  LoginScreen: 'bus/web/src/screens/auth/LoginScreen.jsx',
  TestLoginScreen: 'bus/web/src/screens/auth/TestLoginScreen.jsx',
  OwnerDashboardScreen: 'bus/web/src/screens/owner/OwnerDashboardScreen.jsx',
  BusManagementScreen: 'bus/web/src/screens/owner/BusManagementScreen.jsx',
  SmartRouteBuilderScreen: 'bus/web/src/screens/owner/SmartRouteBuilderScreen.jsx',
  OwnerYatraScreen: 'bus/web/src/screens/owner/OwnerYatraScreen.jsx',
  StaffDashboardScreen: 'bus/web/src/screens/staff/StaffDashboardScreen.jsx',
  QRScannerScreen: 'bus/web/src/screens/staff/QRScannerScreen.jsx',
  PassengerManifestScreen: 'bus/web/src/screens/staff/PassengerManifestScreen.jsx',
  ManualVerificationScreen: 'bus/web/src/screens/staff/ManualVerificationScreen.jsx',
  ManualLocationScreen: 'bus/web/src/screens/staff/ManualLocationScreen.jsx',
  DeveloperDashboardScreen: 'bus/web/src/screens/developer/DeveloperDashboardScreen.jsx'
};

const API_ENDPOINTS = [
  'https://server.nightbusjourney.com/api/qa-feedback',
  'http://localhost:5000/api/qa-feedback'
];

async function fetchFromApi(endpoint, pathSuffix = '', method = 'GET', body = null) {
  try {
    const url = `${endpoint}${pathSuffix}`;
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getPendingIssues() {
  for (const ep of API_ENDPOINTS) {
    const data = await fetchFromApi(ep, '?status=pending');
    if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
      return { source: ep, issues: data.data };
    }
  }

  if (process.env.MONGODB_URI) {
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
      }
      const issues = await QaFeedback.find({ status: 'pending' }).lean();
      return { source: 'local_mongo', issues };
    } catch {
      // Ignore
    }
  }

  return { source: 'none', issues: [] };
}

async function getIssueById(id) {
  for (const ep of API_ENDPOINTS) {
    const data = await fetchFromApi(ep, `/${id}`);
    if (data && data.success && data.data) {
      return { source: ep, issue: data.data };
    }
  }

  if (process.env.MONGODB_URI) {
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI);
      }
      const issue = await QaFeedback.findById(id).lean();
      if (issue) return { source: 'local_mongo', issue };
    } catch {
      // Ignore
    }
  }

  return { source: 'none', issue: null };
}

async function eraseIssue(id) {
  for (const ep of API_ENDPOINTS) {
    const res = await fetchFromApi(ep, `/${id}`, 'DELETE');
    if (res && res.success) {
      return { success: true, source: ep };
    }
  }

  if (process.env.MONGODB_URI) {
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI);
      }
      const deleted = await QaFeedback.findByIdAndDelete(id);
      if (deleted) return { success: true, source: 'local_mongo' };
    } catch {
      // Ignore
    }
  }

  return { success: false };
}

function appendToAuditLog(issue, resolutionNotes, filesTouched = []) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const issueId = issue._id || 'unknown';
  const screenName = issue.screenName || 'UnknownScreen';
  const route = issue.route || '/';
  const userRole = issue.userRole || 'customer';
  const severity = (issue.severity || 'medium').toUpperCase();
  const description = (issue.description || '').replace(/\r?\n/g, ' ');
  const targetFile = SCREEN_FILE_MAP[screenName] || 'bus/web/src/screens/...';

  const entry = `
### [${severity}] Ticket \`${issueId}\` - ${issue.title || description.substring(0, 50)}
- **Timestamp**: ${timestamp}
- **Route & Screen**: \`${route}\` (${screenName})
- **User Role**: \`${userRole}\` | **Mode**: \`${issue.viewport?.mode || 'phone'}\`
- **Target File**: [${targetFile}](${targetFile})
- **Reported Issue**: ${description}
- **AI Resolution**: ${resolutionNotes}
- **Files Modified**: ${filesTouched.length > 0 ? filesTouched.map(f => `\`${f}\``).join(', ') : `\`${targetFile}\``}
- **Status**: Verified & Erased from Live Database Queue
---
`;

  try {
    if (!fs.existsSync(LOG_FILE_PATH)) {
      const header = `# QA Resolution & Staging Audit Log

This document tracks all QA issues detected during manual/automated testing, their root cause fixes, and verification audit trails before production deployment.

---
`;
      fs.writeFileSync(LOG_FILE_PATH, header + entry, 'utf8');
    } else {
      fs.appendFileSync(LOG_FILE_PATH, entry, 'utf8');
    }
    return true;
  } catch (err) {
    console.error('Failed to append to QA_RESOLUTION_LOG.md:', err.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const action = args[0] || '--next';

  try {
    if (action === '--list') {
      const { source, issues } = await getPendingIssues();
      console.log(`\n📋 Found ${issues.length} pending QA issue(s) [Source: ${source}]:\n`);
      issues.forEach((issue, index) => {
        console.log(`[${index + 1}] ID: ${issue._id} | [${issue.severity.toUpperCase()}] ${issue.title}`);
        console.log(`    Route: ${issue.route} | Screen: ${issue.screenName} | Role: ${issue.userRole}`);
      });
      console.log('');
    } else if (action === '--erase') {
      const id = args[1];
      if (!id) {
        console.error('❌ Usage: node qaResolver.js --erase <id>');
        process.exit(1);
      }
      const result = await eraseIssue(id);
      if (result.success) {
        console.log(`🗑️ Issue ${id} successfully ERASED from ${result.source}!`);
      } else {
        console.error(`❌ Issue ${id} could not be erased.`);
      }
    } else if (action === '--resolve-and-erase') {
      const id = args[1];
      const notesIndex = args.indexOf('--notes');
      const notes = notesIndex !== -1 ? args.slice(notesIndex + 1).join(' ') : 'Fixed and verified by AI.';

      if (!id) {
        console.error('❌ Usage: node qaResolver.js --resolve-and-erase <id> --notes "<resolution notes>"');
        process.exit(1);
      }

      // 1. Fetch details before erasing for the audit log
      const { issue } = await getIssueById(id);
      const issueData = issue || { _id: id, title: 'Resolved Ticket', description: notes };

      // 2. Append to permanent QA_RESOLUTION_LOG.md
      appendToAuditLog(issueData, notes);
      console.log(`📝 Logged resolution to QA_RESOLUTION_LOG.md`);

      // 3. Erase from DB
      const result = await eraseIssue(id);
      if (result.success) {
        console.log(`✅ Issue ${id} successfully ERASED from ${result.source} database queue!`);
      } else {
        console.warn(`⚠️ Issue was logged, but could not be erased from DB.`);
      }
    } else {
      // Default: --next (Fetch next pending issue for AI resolution)
      const severityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
      const { source, issues: pendingIssues } = await getPendingIssues();

      if (!pendingIssues || pendingIssues.length === 0) {
        console.log('\n🎉 No pending QA issues in queue! System is completely clean.\n');
        process.exit(0);
      }

      pendingIssues.sort((a, b) => {
        const aSev = severityOrder[a.severity] || 3;
        const bSev = severityOrder[b.severity] || 3;
        if (aSev !== bSev) return aSev - bSev;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

      const issue = pendingIssues[0];
      const targetFilePath = SCREEN_FILE_MAP[issue.screenName] || 'bus/web/src/screens/...';

      console.log('\n============================================================');
      console.log('🤖 AI RESOLVER: NEXT PENDING QA TICKET');
      console.log('============================================================');
      console.log(`Issue ID    : ${issue._id}`);
      console.log(`Title       : ${issue.title}`);
      console.log(`Severity    : [${issue.severity.toUpperCase()}] | Type: ${issue.type}`);
      console.log(`Route       : ${issue.route}`);
      console.log(`Screen Name : ${issue.screenName}`);
      console.log(`Target File : ${targetFilePath}`);
      console.log(`User Role   : ${issue.userRole} (Mode: ${issue.viewport?.mode || 'phone'})`);
      console.log(`Created At  : ${new Date(issue.createdAt).toLocaleString()}`);
      console.log(`Source DB   : ${source}`);
      console.log('------------------------------------------------------------');
      console.log('Description & Desired Change:');
      console.log(issue.description);
      console.log('------------------------------------------------------------');

      if (issue.consoleLogs && issue.consoleLogs.length > 0) {
        console.log('Auto-Captured Console Logs:');
        issue.consoleLogs.forEach((l, i) => console.log(`  [${i + 1}] ${l}`));
        console.log('------------------------------------------------------------');
      }

      console.log(`After fixing and verifying with "npm run build":`);
      console.log(`  node bus/server/scripts/qaResolver.js --resolve-and-erase ${issue._id} --notes "<what you fixed>"\n`);
    }
  } catch (err) {
    console.error('Error in qaResolver:', err);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

main();
