import apn1 from "apn";

console.log("apn1 type:", typeof apn1);
console.log("apn1 keys:", Object.keys(apn1));
if (apn1.default) {
  console.log("apn1.default keys:", Object.keys(apn1.default));
}
