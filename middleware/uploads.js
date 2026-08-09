const multer = require('multer');
const path = require('path');
const fs = require('fs');

// directory where images will be stored
const IMAGE_DIR = path.join(__dirname, '..', 'public', 'images');

if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

// storage engine for multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, IMAGE_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

module.exports = {
    upload,
    deleteImage: (filename) => {
        const fullPath = path.join(IMAGE_DIR, filename);
        return new Promise((resolve, reject) => {
            fs.unlink(fullPath, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }
};
