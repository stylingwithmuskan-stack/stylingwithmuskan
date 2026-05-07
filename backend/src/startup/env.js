import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env");
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error("[Env] ❌ Failed to load .env file from:", envPath);
} else {
  console.log("[Env] ✅ .env file loaded successfully");
}

export default process.env;
