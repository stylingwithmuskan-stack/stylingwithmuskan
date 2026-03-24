import multer from "multer";

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (file.mimetype && file.mimetype.startsWith("image/")) cb(null, true);
  else cb(null, false);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

function mediaFileFilter(req, file, cb) {
  if (!file.mimetype) return cb(null, false);
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) return cb(null, true);
  return cb(null, false);
}

export const uploadMedia = multer({
  storage,
  fileFilter: mediaFileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
});
