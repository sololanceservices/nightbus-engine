const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app';
    await mongoose.connect(uri);
    
    const admin = mongoose.connection.db.admin();
    const dbs = await admin.listDatabases();
    console.log('Databases:', dbs.databases);

    for (const dbInfo of dbs.databases) {
      if (['admin', 'local', 'config'].includes(dbInfo.name)) continue;
      const connection = mongoose.createConnection(`mongodb://localhost:27017/${dbInfo.name}`);
      await new Promise(resolve => connection.once('open', resolve));
      const collections = await connection.db.listCollections().toArray();
      console.log(`Database: ${dbInfo.name}`);
      for (const col of collections) {
        const count = await connection.collection(col.name).countDocuments();
        console.log(`  Collection: ${col.name} -> Count: ${count}`);
      }
      await connection.close();
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
