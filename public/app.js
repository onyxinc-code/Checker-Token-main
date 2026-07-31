document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const loginScreen = document.getElementById('login-screen');
    const mainScreen = document.getElementById('main-screen');
    const accessKeyInput = document.getElementById('access-key');
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');

    const tokenInput = document.getElementById('token-input');
    const startBtn = document.getElementById('start-btn');
    const clearBtn = document.getElementById('clear-btn');
    
    const statTotal = document.getElementById('stat-total');
    const statValid = document.getElementById('stat-valid');
    const statInvalid = document.getElementById('stat-invalid');
    
    const validTbody = document.getElementById('valid-tbody');
    const invalidTbody = document.getElementById('invalid-tbody');
    const validContainer = document.querySelector('#valid-results .table-container');
    const invalidContainer = document.querySelector('#invalid-results .table-container');
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    const resultTabs = document.querySelectorAll('.result-tab');

    // State
    let isChecking = false;

    // Check Auto-Login
    const savedKey = localStorage.getItem('access_key');
    if (savedKey) {
        verifyKey(savedKey).then(isValid => {
            if (isValid) showMainScreen();
            else localStorage.removeItem('access_key');
        });
    }

    // Handlers
    loginBtn.addEventListener('click', handleLogin);
    accessKeyInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') handleLogin();
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('access_key');
        loginScreen.classList.add('active');
        mainScreen.classList.remove('active');
        accessKeyInput.value = '';
        loginError.textContent = '';
    });

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            resultTabs.forEach(t => t.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    clearBtn.addEventListener('click', () => {
        if(isChecking) return;
        tokenInput.value = '';
        validTbody.innerHTML = '';
        invalidTbody.innerHTML = '';
        statTotal.textContent = '0';
        statValid.textContent = '0';
        statInvalid.textContent = '0';
        validContainer.classList.remove('has-data');
        invalidContainer.classList.remove('has-data');
    });

    startBtn.addEventListener('click', startChecking);

    // Functions
    async function handleLogin() {
        const key = accessKeyInput.value.trim();
        if (!key) return;

        loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Doğrulanıyor...';
        loginBtn.disabled = true;

        const isValid = await verifyKey(key);
        
        if (isValid) {
            localStorage.setItem('access_key', key);
            showMainScreen();
        } else {
            loginError.textContent = 'Geçersiz veya süresi dolmuş Lisans Anahtarı!';
        }

        loginBtn.innerHTML = 'Giriş Yap';
        loginBtn.disabled = false;
    }

    async function verifyKey(key) {
        try {
            const res = await fetch('/api/verify-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key })
            });
            const data = await res.json();
            return data.success === true;
        } catch (e) {
            return false;
        }
    }

    function showMainScreen() {
        loginScreen.classList.remove('active');
        mainScreen.classList.add('active');
    }

    function extractToken(line) {
        let t = line.trim();
        if(!t) return null;

        t = t.replace(/"/g, '').replace(/'/g, '');
        return t;
    }

    function maskToken(token) {
        if(token.length < 20) return token;
        return token.substring(0, 8) + '...' + token.substring(token.length - 6);
    }

    async function startChecking() {
        if (isChecking) return;

        const rawText = tokenInput.value;
        const lines = rawText.split('\n');
        
        const tokensToVerify = [];
        for (const line of lines) {
            const token = extractToken(line);
            if (token) tokensToVerify.push(token);
        }

        if (tokensToVerify.length === 0) {
            alert('Lütfen kutuya en az bir token girin.');
            return;
        }

        // Lock UI
        isChecking = true;
        startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kontrol Ediliyor...';
        startBtn.disabled = true;
        tokenInput.disabled = true;

        // Reset Table
        validTbody.innerHTML = '';
        invalidTbody.innerHTML = '';
        validContainer.classList.remove('has-data');
        invalidContainer.classList.remove('has-data');
        
        statTotal.textContent = tokensToVerify.length;
        
        let validCount = 0;
        let invalidCount = 0;
        statValid.textContent = '0';
        statInvalid.textContent = '0';

        const accessKey = localStorage.getItem('access_key');

        for (const token of tokensToVerify) {
            try {
                const res = await fetch('/api/check-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': accessKey
                    },
                    body: JSON.stringify({ token })
                });

                if (res.status === 401) {
                    alert('Güvenlik ihlali: Lisans anahtarınız geçersiz. Sisteme tekrar giriş yapın.');
                    logoutBtn.click();
                    break;
                }

                const data = await res.json();

                if (data.valid) {
                    validCount++;
                    statValid.textContent = validCount;
                    validContainer.classList.add('has-data');
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="token-cell" title="${token}">${maskToken(token)}</td>
                        <td class="user-info">
                            <strong>${data.global_name}</strong>
                            <small>@${data.username}</small>
                        </td>
                        <td>${data.creationDate}</td>
                        <td><span class="badge success">Aktif</span></td>
                    `;
                    validTbody.appendChild(tr);
                } else {
                    invalidCount++;
                    statInvalid.textContent = invalidCount;
                    invalidContainer.classList.add('has-data');

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="token-cell" title="${token}">${maskToken(token)}</td>
                        <td><span class="badge danger">${data.error || 'Geçersiz Token'}</span></td>
                    `;
                    invalidTbody.appendChild(tr);
                }
            } catch (err) {
                invalidCount++;
                statInvalid.textContent = invalidCount;
                invalidContainer.classList.add('has-data');
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="token-cell">${maskToken(token)}</td>
                    <td><span class="badge danger">Ağ/Bağlantı Hatası</span></td>
                `;
                invalidTbody.appendChild(tr);
            }

            // Sleep 250ms between checks to prevent IP Rate Limit from Discord
            await new Promise(r => setTimeout(r, 250));
        }

        // Unlock UI
        isChecking = false;
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Kontrolü Başlat';
        startBtn.disabled = false;
        tokenInput.disabled = false;
    }
});
