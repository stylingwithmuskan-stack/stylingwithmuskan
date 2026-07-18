import http from "http";

http.get("http://localhost:3001/images/base64_30247798440fe26bbbbb5a22fa3a24d5.jpeg", (res) => {
  console.log("Status Code:", res.statusCode);
  console.log("Headers:", res.headers);
  let size = 0;
  res.on("data", (chunk) => {
    size += chunk.length;
  });
  res.on("end", () => {
    console.log("Downloaded size:", size, "bytes");
    process.exit(0);
  });
}).on("error", (err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
