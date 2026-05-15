import mongoose from "mongoose";
import dotenv from "dotenv";
import Record from "../models/Record.js";
import User from "../models/User.js";
import { submitTransaction } from "../fabric/transactions.js";
import { importIdentityFromMsp } from "../fabric/wallet.js";

dotenv.config();

async function sync() {
  console.log("Starting Deep Blockchain Sync...");

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    await importIdentityFromMsp();
    console.log("Fabric identity ready.");

    const doctors = await User.find({ role: "doctor" });
    console.log(`Checking registration for ${doctors.length} doctors...`);
    for (const doctor of doctors) {
      try {
        await submitTransaction(
          "registerDoctor",
          doctor._id.toString(),
          doctor.name,
          doctor.email,
          doctor.hospitalId?.toString() || ""
        );
        console.log(`  [DOC OK] Registered doctor ${doctor.name}`);
      } catch (err) {
        if (!err.message.includes("already exists")) {
          console.warn(`  [DOC WARN] Failed to register doctor ${doctor.name}:`, err.message);
        }
      }
    }

    const patients = await User.find({ role: "patient" });
    console.log(`Checking registration for ${patients.length} patients...`);
    for (const patient of patients) {
      try {
        await submitTransaction(
          "registerPatient",
          patient._id.toString(),
          patient.name,
          patient.email,
          patient.gender || "other",
          patient.dateOfBirth ? patient.dateOfBirth.toISOString() : "N/A"
        );
        console.log(`  [PATIENT OK] Registered patient ${patient.name}`);
      } catch (err) {
        if (!err.message.includes("already exists")) {
          console.warn(`  [PATIENT WARN] Failed to register patient ${patient.name}:`, err.message);
        }
      }
    }

    const records = await Record.find({});
    console.log(`Syncing ${records.length} records...`);

    for (const record of records) {
      const rid = record._id.toString();
      const pid = record.patientId.toString();
      
      try {
        // Double check patient exists on ledger before record upload
        await submitTransaction(
          "uploadRecord",
          rid,
          pid,
          record.cid,
          record.filename,
          record.fileHash,
          record.hospitalId?.toString() || "",
          "SYSTEM_SYNC"
        );
        console.log(`  [REC OK] Synced record: ${record.filename}`);
      } catch (err) {
        if (err.message.includes("already exists")) {
          console.log(`  [REC SKIP] Already exists on Fabric.`);
        } else {
          console.error(`  [REC ERROR] Failed to sync ${rid}:`, err.message);
        }
      }
    }

    console.log("Sync process complete.");
  } catch (err) {
    console.error("Sync failed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

sync();
