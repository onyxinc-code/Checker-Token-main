const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const getKeys = () => {
    const keysPath = path.join(__dirname, 'keys.json');
    try {
        if (!fs.existsSync(keysPath)) {
            // Create default keys file if it doesn't exist
            const defaultKeys = [
                "PREMIUM-KEY-1",
                "PREMIUM-KEY-2",
                "ADMIN-TEST"
            ];
            fs.writeFileSync(keysPath, JSON.stringify(defaultKeys, null, 4));
        }
        const data = fs.readFileSync(keysPath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Anahtar okuma hatası:", e);
        return ["ADMIN-TEST"];
    }
};

const verifyKey = (req, res, next) => {
    const userKey = req.headers['authorization'];
    const validKeys = getKeys();
    
    if (!userKey || !validKeys.includes(userKey)) {
        return res.status(401).json({ error: 'Geçersiz veya eksik anahtar (Key)!' });
    }
    
    next();
};

app.post('/api/verify-key', (req, res) => {
    const { key } = req.body;
    const validKeys = getKeys();
    
    if (validKeys.includes(key)) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Geçersiz Key!' });
    }
});

const getCreationDate = (id) => {
    try {
        const snowflake = BigInt(id);
        const timestamp = Number((snowflake >> 22n) + 1420070400000n);
        const date = new Date(timestamp);
        return date.toLocaleString('tr-TR', { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return "Bilinmiyor";
    }
};

app.post('/api/check-token', verifyKey, async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({ error: 'Token gereklidir.' });
    }

    try {
        const response = await axios.get('https://discord.com/api/v9/users/@me', {
            headers: {
                'Authorization': token
            },
            timeout: 8000 // 8 second timeout
        });

        const data = response.data;
        const creationDate = getCreationDate(data.id);
        
        return res.json({
            valid: true,
            id: data.id,
            username: data.username,
            global_name: data.global_name || 'Yok',
            email: data.email || 'Gizli',
            phone: data.phone || 'Gizli',
            verified: data.verified,
            creationDate: creationDate
        });
    } catch (error) {
        let errorMsg = 'Bilinmeyen Hata';
        
        if (error.response) {
            if (error.response.status === 401) {
                errorMsg = 'Geçersiz Token (Çalışmıyor)';
            } else if (error.response.status === 403) {
                errorMsg = 'Doğrulama Gerekiyor (Kilitli)';
            } else {
                errorMsg = `Hata Kodu: ${error.response.status}`;
            }
        } else if (error.request) {
            errorMsg = 'Zaman Aşımı / Bağlantı Hatası';
        }
        
        return res.json({
            valid: false,
            error: errorMsg
        });
    }
});

app.listen(PORT, () => {
    console.log(`\n==============================================`);
    console.log(`✅ Token Checker VDS üzerinde başlatıldı.`);
    console.log(`🌐 Dinlenen Port: ${PORT}`);
    console.log(`🔒 Diğer uygulamanız (Port 3000) ile çakışmaz.`);
    console.log(`🔑 Lisans Anahtarları 'keys.json' dosyasındadır.`);
    console.log(`==============================================\n`);
});
