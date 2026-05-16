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
            return res.status(400).json({
                success: false,
                message: 'কোনো ছবি আপলোড করা হয়নি'
            });
        }

        const image = await Jimp.read(req.file.buffer);
        const { data, width, height } = image.bitmap;
        const imageData = new Uint8ClampedArray(data);
        const code = decode(imageData, width, height);

        if (code && code.data) {
            res.json({
                success: true,
                data: code.data,
                format: 'QR_CODE'
            });
        } else {
            res.json({
                success: false,
                message: 'QR কোড খুঁজে পাওয়া যায়নি'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK' });
});

module.exports = app;                data: code.data,
                format: 'QR_CODE',
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({
                success: false,
                message: 'এই ছবিতে কোনো QR কোড খুঁজে পাওয়া যায়নি'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Vercel-এর জন্য export করতে হবে
module.exports = app;
