import { validationResult } from "express-validator";

export async function getMe(req, res) {
  res.json({ user: req.user });
}

export async function updateMe(req, res) {
  const allowed = ["name", "referralCode"];
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) req.user[k] = req.body[k];
  });
  await req.user.save();
  res.json({ user: req.user });
}

export async function listAddresses(req, res) {
  res.json({ addresses: req.user.addresses });
}

export async function addAddress(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  req.user.addresses.push({
    houseNo: req.body.houseNo,
    area: req.body.area,
    landmark: req.body.landmark || "",
    type: req.body.type || "home",
  });
  await req.user.save();
  res.status(201).json({ addresses: req.user.addresses });
}

export async function deleteAddress(req, res) {
  const id = req.params.id;
  req.user.addresses = req.user.addresses.filter((a) => a._id.toString() !== id);
  await req.user.save();
  res.json({ addresses: req.user.addresses });
}
