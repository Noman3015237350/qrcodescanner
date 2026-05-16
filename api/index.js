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

// ============ QR CODE GENERATOR API (GET & POST উভয়ই) ============

// GET method - ব্রাউজারের URL থেকে直接用 করা যাবে
// উদাহরণ: /api/generate?text=Hello&size=300
app.get('/api/generate', async (req, res) => {
    try {
        const text = req.query.text;
        const size = parseInt(req.query.size) || 300;
        const color = req.query.color || '#000000';
        const bgColor = req.query.bgColor || '#ffffff';
        
        if (!text || text.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Please provide text parameter. Example: /api/generate?text=Hello'
            });
        }
        
        // Generate QR code as data URL
        const qrCodeDataURL = await QRCode.toDataURL(text, {
            width: size,
            margin: 2,
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

// POST method - JSON body সহ
app.post('/api/generate', async (req, res) => {
    try {
        const { text, size = 300, color = '#000000', bgColor = '#ffffff' } = req.body;
        
        if (!text || text.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Text is required to generate QR code'
            });
        }
        
        const qrCodeDataURL = await QRCode.toDataURL(text, {
            width: parseInt(size),
            margin: 2,
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

// Generate QR as image file download
app.get('/api/generate-file', async (req, res) => {
    try {
        const text = req.query.text;
        const size = parseInt(req.query.size) || 300;
        
        if (!text) {
            return res.status(400).json({ success: false, message: 'text parameter required' });
        }
        
        const qrBuffer = await QRCode.toBuffer(text, {
            width: size,
            margin: 2,
            errorCorrectionLevel: 'H'
        });
        
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename=qrcode.png`);
        res.send(qrBuffer);
        
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============ QR CODE SCANNER API ============

// POST method - image file upload করে স্ক্যান করুন
app.post('/api/scan', upload.single('qrImage'), async (req, res) => {
    try {
        console.log('📸 Scan request received');
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file uploaded. Please select a QR code image.'
            });
        }

        const image = await Jimp.read(req.file.buffer);
        const { data, width, height } = image.bitmap;
        const imageData = new Uint8ClampedArray(data);
        const code = decode(imageData, width, height);

        if (code && code.data) {
            console.log('✅ QR Code scanned successfully:', code.data);
            
            let dataType = 'text';
            let formattedData = code.data;
            
            // Check if it's a URL
            try {
                const url = new URL(code.data);
                if (url.protocol === 'http:' || url.protocol === 'https:') {
                    dataType = 'url';
                } else if (url.protocol === 'mailto:') {
                    dataType = 'email';
                } else if (url.protocol === 'tel:') {
                    dataType = 'phone';
                }
            } catch(e) {}
            
            res.json({
                success: true,
                data: code.data,
                formattedData: formattedData,
                dataType: dataType,
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({
                success: false,
                message: 'No QR code found in the image'
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
        
        let base64Data = base64Image;
        if (base64Image.includes('base64,')) {
            base64Data = base64Image.split('base64,')[1];
        }
        
        const buffer = Buffer.from(base64Data, 'base64');
        const image = await Jimp.read(buffer);
        const { data, width, height } = image.bitmap;
        const imageData = new Uint8ClampedArray(data);
        const code = decode(imageData, width, height);
        
        if (code && code.data) {
            res.json({ success: true, data: code.data });
        } else {
            res.json({ success: false, message: 'No QR code found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============ BEAUTIFUL HTML PAGE FOR QR GENERATOR ============

app.get('/qr', (req, res) => {
    const text = req.query.text || '';
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>QR Code Generator</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 20px;
                }
                .container {
                    max-width: 550px;
                    margin: 0 auto;
                }
                .card {
                    background: white;
                    border-radius: 24px;
                    padding: 30px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                }
                h1 {
                    text-align: center;
                    color: #333;
                    margin-bottom: 10px;
                    font-size: 1.8rem;
                }
                .subtitle {
                    text-align: center;
                    color: #666;
                    margin-bottom: 25px;
                    font-size: 0.9rem;
                }
                label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #555;
                }
                input, textarea, select {
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #e0e0e0;
                    border-radius: 10px;
                    font-size: 14px;
                    margin-bottom: 15px;
                    transition: border 0.3s;
                }
                input:focus, textarea:focus {
                    outline: none;
                    border-color: #667eea;
                }
                button {
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                button:hover { transform: translateY(-2px); }
                .result-area {
                    margin-top: 25px;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 12px;
                    text-align: center;
                    display: none;
                }
                .result-area.show { display: block; }
                .qr-image img {
                    max-width: 100%;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                .loading {
                    text-align: center;
                    padding: 20px;
                }
                .spinner {
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #667eea;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 10px;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .url-examples {
                    background: #e8f4f8;
                    padding: 12px;
                    border-radius: 8px;
                    margin-top: 15px;
                    font-size: 12px;
                }
                .url-examples a {
                    color: #667eea;
                    text-decoration: none;
                }
                @media (max-width: 480px) {
                    .card { padding: 20px; }
                    h1 { font-size: 1.5rem; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <h1>📱 QR Code Generator</h1>
                    <div class="subtitle">টেক্সট বা URL থেকে QR কোড বানান</div>
                    
                    <label>🔤 টেক্সট বা URL লিখুন</label>
                    <textarea id="textInput" rows="3" placeholder="যেমন: https://google.com বা আপনার টেক্সট">${escapeHtml(text)}</textarea>
                    
                    <label>📏 সাইজ (পিক্সেল)</label>
                    <input type="number" id="sizeInput" value="300" min="100" max="800">
                    
                    <label>🎨 রং (অপশনাল)</label>
                    <input type="color" id="colorInput" value="#000000">
                    
                    <label>⚪ ব্যাকগ্রাউন্ড রং</label>
                    <input type="color" id="bgColorInput" value="#ffffff">
                    
                    <button onclick="generateQR()">✨ QR কোড জেনারেট করুন</button>
                    
                    <div id="result" class="result-area"></div>
                    
                    <div class="url-examples">
                        <strong>🔗 API直接用 করার নিয়ম:</strong><br>
                        <code>/api/generate?text=Hello</code><br>
                        <code>/api/generate?text=https://google.com&size=500</code><br>
                        <a href="/api/generate?text=Hello" target="_blank">টেস্ট করুন →</a>
                    </div>
                </div>
            </div>

            <script>
                async function generateQR() {
                    const text = document.getElementById('textInput').value;
                    const size = document.getElementById('sizeInput').value;
                    const color = document.getElementById('colorInput').value;
                    const bgColor = document.getElementById('bgColorInput').value;
                    
                    if (!text.trim()) {
                        alert('দয়া করে টেক্সট বা URL লিখুন');
                        return;
                    }
                    
                    const resultDiv = document.getElementById('result');
                    resultDiv.innerHTML = \`
                        <div class="loading">
                            <div class="spinner"></div>
                            <div>⏳ জেনারেট করা হচ্ছে...</div>
                        </div>
                    \`;
                    resultDiv.classList.add('show');
                    
                    try {
                        const url = \`/api/generate?text=\${encodeURIComponent(text)}&size=\${size}&color=\${encodeURIComponent(color)}&bgColor=\${encodeURIComponent(bgColor)}\`;
                        const response = await fetch(url);
                        const data = await response.json();
                        
                        if (data.success) {
                            resultDiv.innerHTML = \`
                                <div class="qr-image">
                                    <img src="\${data.qrCode}" alt="QR Code">
                                </div>
                                <div style="margin-top: 15px;">
                                    <strong>📝 কন্টেন্ট:</strong><br>
                                    <code style="background: #e9ecef; padding: 8px; display: block; border-radius: 6px; word-break: break-all;">\${escapeHtml(data.text)}</code>
                                </div>
                                <button onclick="downloadQR('\${data.qrCode}')" style="margin-top: 15px;">💾 ডাউনলোড করুন</button>
                            \`;
                        } else {
                            resultDiv.innerHTML = \`<div style="color: #dc3545;">❌ \${data.message}</div>\`;
                        }
                    } catch (error) {
                        resultDiv.innerHTML = \`<div style="color: #dc3545;">❌ Error: \${error.message}</div>\`;
                    }
                }
                
                function downloadQR(qrDataURL) {
                    const link = document.createElement('a');
                    link.download = 'qrcode.png';
                    link.href = qrDataURL;
                    link.click();
                }
                
                function escapeHtml(text) {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }
                
                // Auto-generate if text is provided in URL
                window.onload = () => {
                    const urlText = document.getElementById('textInput').value;
                    if (urlText && urlText !== '') {
                        generateQR();
                    }
                }
            </script>
        </body>
        </html>
    `);
    
    function escapeHtml(text) {
        return text.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
            return c;
        });
    }
});

// ============ HEALTH CHECK & UTILITY ENDPOINTS ============

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'QR Code API is running',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        endpoints: {
            generate_get: 'GET /api/generate?text=your_text',
            generate_post: 'POST /api/generate',
            scan: 'POST /api/scan',
            web_interface: 'GET /qr',
            health: 'GET /api/health'
        }
    });
});

app.get('/', (req, res) => {
    res.json({
        name: 'QR Code Generator & Scanner API',
        version: '2.0.0',
        status: 'active',
        documentation: {
            generate_via_url: 'GET /api/generate?text=Hello',
            generate_via_post: 'POST /api/generate',
            scan: 'POST /api/scan (multipart/form-data with field "qrImage")',
            web_interface: 'GET /qr',
            health: 'GET /api/health'
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

module.exports = app;
