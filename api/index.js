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
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// QR Code scan endpoint
app.post('/api/scan-qr', upload.single('qrImage'), async (req, res) => {
    try {
        console.log('API called - scan-qr');
        
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
        console.error('Scan error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
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
        status: 'active',
        endpoints: {
            scan: {
                method: 'POST',
                url: '/api/scan-qr',
                body: 'multipart/form-data with "qrImage" field'
            },
            health: {
                method: 'GET',
                url: '/api/health'
            }
        }
    });
});

// Handle 404
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Export for Vercel
module.exports = app;
