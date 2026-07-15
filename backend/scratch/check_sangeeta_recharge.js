import mongoose from "mongoose";
import ProviderAccount from "../src/models/ProviderAccount.js";
import ProviderWalletTxn from "../src/models/ProviderWalletTxn.js";
import { connectDB } from "../src/startup/db.js";

async function checkSangeetaRecharge() {
  await connectDB();
  console.log("Connected to DB.");

  const sangeeta = await ProviderAccount.findOne({ phone: "9340387602" });
  if (!sangeeta) {
    console.log("Provider Sangeeta not found with phone 9340387602.");
    process.exit(1);
  }

  console.log("Found Sangeeta:", sangeeta._id.toString());
  console.log("Current Credits:", sangeeta.credits);

  const txns = await ProviderWalletTxn.find({ providerId: sangeeta._id.toString() }).sort({ createdAt: -1 }).limit(10);
  console.log("Recent Transactions:");
  txns.forEach(t => {
    console.log(`- ${t.createdAt}: ${t.type} | Amount: ${t.amount} | Status: ${t.status || 'Success'} | Meta: ${JSON.stringify(t.meta)}`);
  });

  const allTxns = await mongoose.connection.db.collection('providerwallettxns').find({ providerId: sangeeta._id.toString() }).sort({ createdAt: -1 }).limit(5).toArray();
  console.log("Raw Txns:", allTxns);

  // Let's also check razorpay webhooks or payments if there's any collection
  try {
    const webhooks = await mongoose.connection.db.collection('webhooklogs').find({ "payload.payload.payment.entity.id": { $regex: "TDRe04" } }).toArray();
    console.log("Found Webhook logs for TDRe04:", webhooks.length);
    webhooks.forEach(w => console.log(w.event, w.payload?.payload?.payment?.entity?.id));
  } catch (e) {}

  process.exit(0);
}

checkSangeetaRecharge();
