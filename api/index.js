const express = require('express');
const multer = require('multer');
const { decode } = require('jsqr');
const Jimp = require('jimp');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/scan-qr', upload.single('qrImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const image = await Jimp.read(req.file.buffer);
        const { data, width, height } = image.bitmap;
        const code = decode(new Uint8ClampedArray(data), width, height);
        
        if (code && code.data) {
            res.json({ success: true, data: code.data });
        } else {
            res.json({ success: false, message: 'No QR code found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK' });
});

module.exports = app;
