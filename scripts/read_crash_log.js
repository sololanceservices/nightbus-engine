const mongoose = require('mongoose');
const SystemLog = require('../models/SystemLog');

async function checkCrashLogs() {
  try {
    await mongoose.connect('mongodb://localhost:27017/bus_app');
    console.log('Connected to MongoDB');

    const logs = await SystemLog.find().sort({ timestamp: -1 }).limit(10);

    console.log('--- LATEST LOGS ---');
    logs.forEach((log, index) => {
      console.log(`\n[Log ${index + 1}] Date: ${log.timestamp}`);
      console.log(`Message: ${log.message}`);
      if (log.meta && log.meta.stack) {
        console.log(`Stack Trace:\n${log.meta.stack}`);
      }
    });

    mongoose.connection.close();
  } catch (err) {
    console.error('Error fetching logs:', err);
    process.exit(1);
  }
}

checkCrashLogs();
