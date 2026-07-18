const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, 'images');

if (fs.existsSync(imagesDir)) {
    const files = fs.readdirSync(imagesDir);
    let count = 0;
    files.forEach(file => {
        const filePath = path.join(imagesDir, file);
        try {
            const stats = fs.statSync(filePath);
            if (stats.isFile() && stats.size === 0) {
                fs.unlinkSync(filePath);
                console.log(`Successfully deleted 0-byte image: ${file}`);
                count++;
            }
        } catch (err) {
            console.error(`Error processing file ${file}:`, err.message);
        }
    });
    console.log(`Cleanup completed. Deleted ${count} empty image files.`);
} else {
    console.log("images directory not found.");
}
