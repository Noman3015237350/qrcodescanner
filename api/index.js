const express = require('express');
const multer = require('multer');
const { decode } = require('jsqr');
const Jimp = require('jimp');
const cors = require('cors');
const QRCode = require('qrcode');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for memory storage
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ============ QR CODE SCANNER API ============

// Scan QR code from uploaded image
app.post('/api/scan', upload.single('qrImage'), async (req, res) => {
    try {
        console.log('📸 Scan request received');
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file uploaded. Please select a QR code image.'
            });
        }

        // Read image from buffer
        const image = await Jimp.read(req.file.buffer);
        const { data, width, height } = image.bitmap;
        const imageData = new Uint8ClampedArray(data);
        
        // Decode QR code
        const code = decode(imageData, width, height);

        if (code && code.data) {
            console.log('✅ QR Code scanned successfully:', code.data);
            
            // Detect data type
            let dataType = 'text';
            let formattedData = code.data;
            
            // Check if it's a URL
            try {
                const url = new URL(code.data);
                if (url.protocol === 'http:' || url.protocol === 'https:') {
                    dataType = 'url';
                    formattedData = url.toString();
                } else if (url.protocol === 'mailto:') {
                    dataType = 'email';
                    formattedData = url.pathname;
                } else if (url.protocol === 'tel:') {
                    dataType = 'phone';
                    formattedData = url.pathname;
                }
            } catch(e) {
                // Not a URL, keep as text
            }
            
            // Check if it's JSON
            try {
                const json = JSON.parse(code.data);
                dataType = 'json';
                formattedData = json;
            } catch(e) {}
            
            res.json({
                success: true,
                data: code.data,
                formattedData: formattedData,
                dataType: dataType,
                format: 'QR_CODE',
                timestamp: new Date().toISOString()
            });
        } else {
            console.log('❌ No QR code found in image');
            res.json({
                success: false,
                message: 'No QR code found in the image. Please make sure the image contains a clear QR code.'
            });
        }
    } catch (error) {
        console.error('❌ Scan error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing image: ' + error.message
        });
    }
});

// Scan from base64 image
app.post('/api/scan-base64', async (req, res) => {
    try {
        const { base64Image } = req.body;
        
        if (!base64Image) {
            return res.status(400).json({
                success: false,
                message: 'No base64 image data provided'
            });
        }
        
        // Remove data URL prefix if present
        let base64Data = base64Image;
        if (base64Image.includes('base64,')) {
            base64Data = base64Image.split('base64,')[1];
        }
        
        // Convert base64 to buffer
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Read image from buffer
        const image = await Jimp.read(buffer);
        const { data, width, height } = image.bitmap;
        const imageData = new Uint8ClampedArray(data);
        const code = decode(imageData, width, height);
        
        if (code && code.data) {
            res.json({
                success: true,
                data: code.data,
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({
                success: false,
                message: 'No QR code found in the image'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============ QR CODE GENERATOR API ============

// Generate QR code
app.post('/api/generate', async (req, res) => {
    try {
        const { text, size = 300, margin = 2, color = '#000000', bgColor = '#ffffff' } = req.body;
        
        if (!text || text.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Text is required to generate QR code'
            });
        }
        
        // Generate QR code as data URL
        const qrCodeDataURL = await QRCode.toDataURL(text, {
            width: parseInt(size),
            margin: parseInt(margin),
            color: {
                dark: color,
                light: bgColor
            },
            errorCorrectionLevel: 'H'
        });
        
        res.json({
            success: true,
            qrCode: qrCodeDataURL,
            text: text,
            size: size,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('QR Generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating QR code: ' + error.message
        });
    }
});

// Generate QR code as file download
app.post('/api/generate-file', async (req, res) => {
    try {
        const { text, size = 300, format = 'png' } = req.body;
        
        if (!text || text.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Text is required'
            });
        }
        
        // Generate QR code as buffer
        const qrBuffer = await QRCode.toBuffer(text, {
            width: parseInt(size),
            margin: 2,
            errorCorrectionLevel: 'H'
        });
        
        res.setHeader('Content-Type', `image/${format}`);
        res.setHeader('Content-Disposition', `attachment; filename=qrcode.${format}`);
        res.send(qrBuffer);
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============ UTILITY ENDPOINTS ============

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'QR Code API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        endpoints: {
            scan: 'POST /api/scan',
            scanBase64: 'POST /api/scan-base64',
            generate: 'POST /api/generate',
            generateFile: 'POST /api/generate-file',
            health: 'GET /api/health'
        }
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'QR Code Generator & Scanner API',
        version: '1.0.0',
        status: 'active',
        documentation: {
            scan: {
                method: 'POST',
                url: '/api/scan',
                body: 'multipart/form-data with field "qrImage"',
                example: 'curl -X POST /api/scan -F "qrImage=@qrcode.png"'
            },
            generate: {
                method: 'POST',
                url: '/api/generate',
                body: 'JSON with "text" field',
                example: 'curl -X POST /api/generate -H "Content-Type: application/json" -d \'{"text":"Hello World"}\''
            }
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

module.exports = app;
