import mongoose from 'mongoose';

const mongoUri = 'mongodb+srv://stylingwithmuskan_db_user:stylewithmuskan6118@cluster0.ls0uuhc.mongodb.net/swm?retryWrites=true&w=majority';

async function restoreBalance() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to DB');

    const phone = '7223077890';
    const User = mongoose.model('User', new mongoose.Schema({
      phone: String,
      wallet: {
        balance: Number,
        transactions: Array
      }
    }));

    const user = await User.findOne({ phone });
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('Old Balance:', user.wallet.balance);
    
    // Add 200 back to balance
    user.wallet.balance = (user.wallet.balance || 0) + 200;
    
    // Add a transaction record for the restoration
    user.wallet.transactions.unshift({
      title: "Balance Restored (System Fix)",
      amount: 200,
      type: "credit",
      balanceAfter: user.wallet.balance,
      description: "Restored balance due to accidental deduction during booking attempt",
      at: new Date()
    });

    await user.save();
    console.log('New Balance:', user.wallet.balance);
    console.log('Balance restored successfully');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

restoreBalance();
