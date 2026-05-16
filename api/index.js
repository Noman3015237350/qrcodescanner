const express = require('express');
const multer = require('multer');
const { decode } = require('jsqr');
const Jimp = require('jimp');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// QR Code scan endpoint
app.post('/api/scan-qr', upload.single('qrImage'), async (req, res) => {
    try {
        console.log('Request received:', req.file ? 'File present' : 'No file');
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file uploaded'
            });
        }

        // Read image from buffer
        const image = await Jimp.read(req.file.buffer);
        const { data, width, height } = image.bitmap;
        const imageData = new Uint8ClampedArray(data);
        
        // Decode QR code
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
                message: 'No QR code found in the image'
            });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'QR Scanner API is running',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'QR Code Scanner API',
        version: '1.0.0',
        endpoints: {
            scan: '/api/scan-qr (POST)',
            health: '/api/health (GET)'
        }
    });
});

// Export for Vercel
module.exports = app;
