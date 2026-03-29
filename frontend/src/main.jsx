import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { initializePushSupport } from "@/modules/user/lib/firebasePush";

initializePushSupport().catch(() => {});

createRoot(document.getElementById("root")).render(<App />);
