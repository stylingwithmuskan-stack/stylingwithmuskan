import fetch from "node-fetch";

async function checkServer() {
  try {
    const res = await fetch("http://localhost:3001/healthz");
    console.log("Health Check:", res.status, await res.json());
  } catch (err) {
    console.error("Health Check Failed:", err.message);
  }
}

checkServer();
