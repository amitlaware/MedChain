require('dotenv').config();
const mongoose = require('mongoose');
const { submitTransaction } = require('./fabric/transactions.js');
require('./models/Record.js');
require('./models/User.js');

async function sync() {
  await mongoose.connect('mongodb://localhost:27017/ehr-system');
  console.log('Connected to MongoDB');

  const recordId = '6a05a5ac56cfb3a34b1131e3';
  const record = await mongoose.model('Record').findById(recordId);

  if (!record) {
    console.error('Record not found in MongoDB');
    process.exit(1);
  }

  console.log(`Syncing record ${recordId} to Fabric...`);

  try {
    await submitTransaction(
      "uploadRecord",
      recordId,
      record.patientId.toString(),
      record.cid,
      record.filename,
      record.fileHash,
      record.hospitalId.toString(),
      record.patientId.toString() // uploadedBy
    );
    console.log('Successfully synced to Fabric!');
  } catch (err) {
    console.error('Sync failed:', err.message);
  }

  process.exit(0);
}

sync();
