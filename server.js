const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const TonWeb = require('tonweb');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tonclicker', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// TON Web initialization
const tonweb = new TonWeb(new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC', {
    apiKey: process.env.TONCENTER_API_KEY
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/game', require('./routes/game'));
app.use('/api/transactions', require('./routes/transactions'));

// WebSocket connections
const connections = new Map();

wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'auth' && data.token) {
                const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
                connections.set(decoded.userId, ws);
                ws.userId = decoded.userId;
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });
    
    ws.on('close', () => {
        if (ws.userId) {
            connections.delete(ws.userId);
        }
    });
});

// Function to send updates to specific user
function sendToUser(userId, data) {
    const ws = connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

// Serve frontend
app.use(express.static('../frontend'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { sendToUser, tonweb };
