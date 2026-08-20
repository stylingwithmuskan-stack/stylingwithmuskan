import { createRequire } from "module";
const require = createRequire(import.meta.url);
const apn = require("apn");

console.log("Keys of require('apn'):", Object.keys(apn));
console.log("Is Provider a constructor?", typeof apn.Provider === "function");
