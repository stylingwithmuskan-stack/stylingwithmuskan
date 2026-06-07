import mongoose from "mongoose";
import { Category, ServiceType, Service } from "../src/models/Content.js";
import { MONGO_URI } from "../src/config.js";

async function disableMehandi() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");

    // Disable Mehandi Category
    const mehandiCategory = await Category.updateMany(
      { name: { $regex: /mehandi/i } },
      { $set: { isActive: false } }
    );
    console.log("Disabled Categories:", mehandiCategory.modifiedCount);

    // Disable Mehandi ServiceType
    const mehandiServiceType = await ServiceType.updateMany(
      { label: { $regex: /mehandi/i } },
      { $set: { isActive: false } }
    );
    console.log("Disabled ServiceTypes:", mehandiServiceType.modifiedCount);

    // Disable services under Mehandi
    const mehandiServices = await Service.updateMany(
      { name: { $regex: /mehandi/i } },
      { $set: { isActive: false } }
    );
    console.log("Disabled Services:", mehandiServices.modifiedCount);

    console.log("Done");
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

disableMehandi();
