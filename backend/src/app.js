import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./modules/user/routes/index.js";
import contentRoutes from "./routes/content.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import vendorRoutes from "./modules/vendor/routes/index.js";
import providerRoutes from "./modules/provider/routes/index.js";
import providersRoutes from "./routes/providers.routes.js";
import sosRoutes from "./routes/sos.routes.js";
import bookingsRoutes from "./modules/bookings/routes/index.js";
import paymentsRoutes from "./routes/payments.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import subscriptionRoutes from "./modules/subscriptions/routes/subscription.routes.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ALLOWED_ORIGINS, SWAGGER_SERVER_URL } from "./config.js";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(morgan("dev"));
const allowedOrigins = (ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:4173").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes("*")) return cb(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    if (origin.endsWith(".vercel.app")) return cb(null, true);
    console.warn(`[Express CORS] Rejected origin: ${origin}`);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
});
app.use(limiter);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/content", contentRoutes);
app.use("/admin", adminRoutes);
app.use("/vendor", vendorRoutes);
app.use("/provider", providerRoutes);
app.use("/providers", providersRoutes);
app.use("/sos", sosRoutes);
app.use("/bookings", bookingsRoutes);
app.use("/payments", paymentsRoutes);
app.use("/notifications", notificationRoutes);
app.use("/subscriptions", subscriptionRoutes);
try {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const spec = JSON.parse(fs.readFileSync(path.join(__dirname, "swagger.json"), "utf-8"));
  const swaggerUi = (await import("swagger-ui-express")).default;
  if (SWAGGER_SERVER_URL) spec.servers = [{ url: SWAGGER_SERVER_URL }];
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));
} catch {}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

export default app;
