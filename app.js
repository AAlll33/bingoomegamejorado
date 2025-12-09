// 🚨 CONFIGURACIÓN FIREBASE OMEGA 🚨
const firebaseConfig = {
    apiKey: "AIzaSyCwrGuhYZkfnH-Yva8CwaEMfEYhzCByrRA",
    authDomain: "omegareserva369-34542.firebaseapp.com",
    databaseURL: "https://omegareserva369-34542-default-rtdb.firebaseio.com",
    projectId: "omegareserva369-34542",
    storageBucket: "omegareserva369-34542.firebasestorage.app",
    messagingSenderId: "1023263517856",
    appId: "1:1023263517856:web:8dec670aac92b8693a6dc5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// CONFIGURACIÓN BINGO
const TOTAL_CARDS = 75;
const CARD_PRICE = 300;
const BINGO_DATE_STRING = 'December 8, 2025 19:00:00'; 

let selectedCards = JSON.parse(localStorage.getItem('omega_selected_cards')) || [];
let liveData = {};
let timerInterval;
let adminClicks = 0;
let isStoreOpen = true;

// INIT
window.onload = () => {
    // Fecha
    const d = new Date(BINGO_DATE_STRING);
    document.getElementById('bingoDateDisplay').textContent = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' });

    startRealtimeSync();
    startBingoTimer();
    checkStoreStatus();
    
    // Timer Pago Pendiente
    if (localStorage.getItem('omega_payment_start') && selectedCards.length > 0) startPaymentTimer();

    // Input archivo nombre
    document.getElementById('payFile').addEventListener('change', function(e) {
        if(this.files[0]) document.getElementById('fileNameDisplay').textContent = this.files[0].name;
    });

    // Iniciar Carrusel Automático
    setInterval(() => moveCarousel(1), 5000);
};

// --- LOGICA CARRUSEL ---
let currentSlide = 0;
function moveCarousel(dir) {
    const track = document.getElementById('carouselTrack');
    const slides = track.children.length;
    currentSlide = (currentSlide + dir + slides) % slides;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
}

// --- LOGICA TIENDA ---
function checkStoreStatus() {
    db.collection('config').doc('general').onSnapshot(doc => {
        if (doc.exists) {
            isStoreOpen = doc.data().isStoreOpen;
        } else {
            isStoreOpen = true; // Por defecto abierta
        }
        updateStoreUI();
    });
}

function updateStoreUI() {
    const overlay = document.getElementById('closedStoreOverlay');
    const statusText = document.getElementById('storeStatusText');
    const btn = document.getElementById('toggleStoreBtn');
    
    // UI Admin
    if(btn) {
        btn.textContent = isStoreOpen ? "CERRAR TIENDA" : "ABRIR TIENDA";
        btn.className = isStoreOpen ? "bg-red-600 text-white px-4 py-2 rounded font-bold" : "bg-green-600 text-white px-4 py-2 rounded font-bold";
        statusText.textContent = isStoreOpen ? "Tienda ABIERTA" : "Tienda CERRADA";
        statusText.className = isStoreOpen ? "text-green-600 font-bold" : "text-red-600 font-bold";
    }

    // UI Cliente
    if (!isStoreOpen && !auth.currentUser) {
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } else {
        overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
        if(typeof stopGameLogic === 'function') stopGameLogic();
    }
}

function toggleStoreStatus() {
    const newState = !isStoreOpen;
    if(confirm(newState ? "¿ABRIR tienda?" : "¿CERRAR tienda?")) {
        db.collection('config').doc('general').set({ isStoreOpen: newState }, { merge: true });
    }
}

// --- LOGICA SELECCIÓN Y BINGO ---
function startRealtimeSync() {
    // Escuchar Ventas
    db.collection('ventasConfirmadas').onSnapshot(snap => {
        snap.docChanges().forEach(change => {
            const d = change.doc.data();
            (d.cards || []).forEach(c => {
                if(change.type === 'removed') delete liveData[c];
                else liveData[c] = { status: 'sold', ...d };
            });
        });
        updateUI();
        if(auth.currentUser) renderAdminSoldList();
    });

    // Escuchar Pendientes
    db.collection('reservasPendientes').onSnapshot(snap => {
        snap.docChanges().forEach(change => {
            const d = change.doc.data();
            const docId = change.doc.id;
            (d.cards || []).forEach(c => {
                const isSold = liveData[c]?.status === 'sold';
                if(change.type === 'removed') { if(!isSold) delete liveData[c]; }
                else { if(!isSold) liveData[c] = { status: 'reserved', reservationId: docId, ...d }; }
            });
        });
        updateUI();
        if(auth.currentUser) renderAdminPendingList();
    });

    // Auth Listener
    auth.onAuthStateChanged(u => {
        updateStoreUI();
        if(u) {
            document.getElementById('clientContent').classList.add('hidden');
            document.getElementById('adminPanel').classList.remove('hidden');
            document.getElementById('adminLogin').classList.add('hidden');
            document.getElementById('adminDashboard').classList.remove('hidden');
            renderAdminPendingList(); renderAdminSoldList();
        }
    });
}

function updateUI() {
    let sold = 0;
    for(let i=1; i<=TOTAL_CARDS; i++) if(liveData[i]?.status === 'sold') sold++;
    document.getElementById('availableCount').textContent = TOTAL_CARDS - sold;
    if(document.getElementById('cardSelectionModal').style.display === 'flex') renderGrid();
}

function showCardSelectionModal() {
    document.getElementById('cardPreviewModal').style.display = 'none';
    document.getElementById('paymentProcessModal').style.display = 'none';
    document.getElementById('cardSelectionModal').style.display = 'flex';
    renderGrid(); updateTotal();
}
function hideCardSelectionModal() { document.getElementById('cardSelectionModal').style.display = 'none'; }

function renderGrid() {
    const container = document.getElementById('cardListContainer');
    container.innerHTML = '';
    for(let i=1; i<=TOTAL_CARDS; i++) {
        const st = getStatus(i);
        let tag = 'VER';
        if(st === 'sold') tag = 'VEND';
        if(st === 'reserved') tag = 'OCUP';
        if(st === 'selected') tag = 'MIA';

        const div = document.createElement('div');
        div.className = `card-item-container status-${st}`;
        div.innerHTML = `<div class="bingo-ball" onclick="handleBallClick(${i}, '${st}')">${i}</div><span class="ver-tag">${tag}</span>`;
        container.appendChild(div);
    }
}

function getStatus(n) {
    if(liveData[n]?.status === 'sold') return 'sold';
    if(liveData[n]?.status === 'reserved') return 'reserved';
    if(selectedCards.includes(n)) return 'selected';
    return 'available';
}

function handleBallClick(n, st) {
    if(st === 'sold' || st === 'reserved') {
        openPreview(n);
    } else {
        if(selectedCards.includes(n)) selectedCards = selectedCards.filter(x => x !== n);
        else selectedCards.push(n);
        localStorage.setItem('omega_selected_cards', JSON.stringify(selectedCards));
        updateTotal(); renderGrid();
    }
}

function updateTotal() {
    document.getElementById('totalCostDisplay').textContent = `Bs. ${(selectedCards.length * CARD_PRICE).toFixed(2)}`;
}

// --- PREVIEW ---
function openPreview(n) {
    const st = getStatus(n);
    const d = liveData[n];
    const btn = document.getElementById('btnPreviewAction');
    const txt = document.getElementById('previewStatusText');
    
    document.getElementById('previewNum').textContent = n;
    // IMPORTANTE: Asegurate de tener tus imagenes en una carpeta llamada 'tablas'
    document.getElementById('previewImgContainer').innerHTML = `<img src="./tablas/tabla_${n}.png" class="max-w-full h-auto rounded border-2 border-purple-500 shadow" onerror="this.src='https://placehold.co/200?text=Tabla+${n}'">`;
    
    if(st === 'sold') {
        txt.textContent = `❌ VENDIDA (${d.name})`; txt.className = "text-red-600 font-bold mb-4"; btn.style.display = 'none';
    } else if(st === 'reserved') {
        txt.textContent = `⏳ OCUPADA (${d.name})`; txt.className = "text-orange-500 font-bold mb-4"; btn.style.display = 'none';
    } else {
        const isSel = selectedCards.includes(n);
        txt.textContent = isSel ? "¿Quitar de lista?" : "¿Agregar a lista?";
        txt.className = "text-gray-700 font-bold mb-4";
        btn.style.display = 'block';
        btn.textContent = isSel ? "QUITAR" : "AGREGAR";
        btn.className = isSel ? "flex-1 py-2 bg-red-500 text-white font-bold rounded-lg" : "flex-1 py-2 bg-green-500 text-white font-bold rounded-lg";
        btn.onclick = () => {
            if(isSel) selectedCards = selectedCards.filter(x => x !== n); else selectedCards.push(n);
            localStorage.setItem('omega_selected_cards', JSON.stringify(selectedCards));
            updateTotal(); closePreview(); showCardSelectionModal();
        };
    }
    document.getElementById('cardSelectionModal').style.display = 'none';
    document.getElementById('cardPreviewModal').style.display = 'flex';
}
function closePreview() { document.getElementById('cardPreviewModal').style.display = 'none'; showCardSelectionModal(); }

// --- PAGOS ---
function preparePayment() {
    if(selectedCards.length === 0) return alert("Selecciona tablas primero.");
    // Verificar si se ocuparon mientras elegía
    let clean = [];
    selectedCards.forEach(c => { if(!liveData[c]) clean.push(c); });
    if(clean.length !== selectedCards.length) alert("Algunas tablas ya no están disponibles.");
    selectedCards = clean;
    if(selectedCards.length === 0) return hideCardSelectionModal();

    if (!localStorage.getItem('omega_payment_start')) localStorage.setItem('omega_payment_start', Date.now());
    
    hideCardSelectionModal();
    document.getElementById('paymentProcessModal').style.display = 'flex';
    document.getElementById('payCardsList').textContent = selectedCards.join(', ');
    document.getElementById('payTotal').textContent = `Bs. ${(selectedCards.length * CARD_PRICE).toFixed(2)}`;
    startPaymentTimer();
}

function startPaymentTimer() {
    const display = document.getElementById('paymentTimer');
    clearInterval(timerInterval);
    const start = parseInt(localStorage.getItem('omega_payment_start'));
    if (!start) return;

    timerInterval = setInterval(() => {
        const left = 300 - Math.floor((Date.now() - start) / 1000); // 5 min
        if(left <= 0) {
            clearInterval(timerInterval);
            localStorage.removeItem('omega_payment_start'); selectedCards = []; localStorage.removeItem('omega_selected_cards');
            hidePaymentModal(); alert("Tiempo agotado."); updateUI();
        } else {
            const m = Math.floor(left / 60); const s = left % 60;
            display.textContent = `0${m}:${s<10?'0'+s:s}`;
        }
    }, 1000);
}

function hidePaymentModal() { document.getElementById('paymentProcessModal').style.display = 'none'; showCardSelectionModal(); }

async function submitPayment() {
    const name = document.getElementById('payName').value;
    const phone = document.getElementById('payPhone').value;
    const ref = document.getElementById('payRef').value;
    const file = document.getElementById('payFile').files[0];
    const statusMsg = document.getElementById('uploadStatus');

    if(!file) return alert("Falta el capture");
    statusMsg.textContent = "Subiendo... ⏳"; statusMsg.classList.remove('hidden');

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', "bingo_comprobantes"); // TU PRESET CLOUDINARY
        formData.append('public_id', `${phone}_${Date.now()}`); 
        
        // Reemplaza 'dcenrp74j' por tu Cloud Name si cambia
        const res = await fetch(`https://api.cloudinary.com/v1_1/dcenrp74j/image/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        
        if (!res.ok) throw new Error("Error subida");

        await db.collection('reservasPendientes').add({ 
            name, phone, reference: ref, proofURL: data.secure_url, 
            cards: selectedCards, totalAmount: selectedCards.length * CARD_PRICE,
            timestamp: Date.now(), status: 'PENDING_CONFIRMATION'
        });

        statusMsg.textContent = "¡Enviado! 🎉";
        confetti();
        selectedCards = []; localStorage.removeItem('omega_selected_cards'); localStorage.removeItem('omega_payment_start');
        clearInterval(timerInterval);
        setTimeout(() => { document.getElementById('paymentProcessModal').style.display = 'none'; alert("Enviado. Espera confirmación."); }, 1500);
    } catch(e) {
        statusMsg.textContent = "Error al subir."; console.error(e);
    }
}

// --- ADMIN ---
// Login secreto: Click 6 veces en el logo del footer
document.getElementById('footer-logo').addEventListener('click', () => {
    adminClicks++;
    if(adminClicks >= 6) {
        document.getElementById('closedStoreOverlay').style.display = 'none';
        document.getElementById('clientContent').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        adminClicks = 0;
    }
});
// Login secreto 2: Click 6 veces candado overlay
document.getElementById('adminSecretLock').addEventListener('click', () => {
    adminClicks++;
    if(adminClicks >= 6) {
        document.getElementById('closedStoreOverlay').style.display = 'none';
        document.getElementById('clientContent').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        adminClicks = 0;
    }
});

function adminLogin() {
    auth.signInWithEmailAndPassword(document.getElementById('adminEmail').value, document.getElementById('adminPassword').value)
    .catch(e => document.getElementById('adminLoginError').textContent = e.message);
}
function adminLogout() { auth.signOut().then(()=>location.reload()); }

function renderAdminPendingList() {
    db.collection('reservasPendientes').where('status', '==', 'PENDING_CONFIRMATION').onSnapshot(snap => {
        const div = document.getElementById('pendingCardsList');
        div.innerHTML = '';
        document.getElementById('pendingCount').textContent = snap.size;
        snap.forEach(doc => {
            const d = doc.data();
            div.innerHTML += `
            <div class="bg-gray-50 p-3 rounded border border-gray-200">
                <p class="font-bold">${d.name} (${d.phone})</p>
                <p class="text-xs">Ref: ${d.reference} | Bs.${d.totalAmount}</p>
                <p class="text-xs font-bold text-purple-600">Tablas: ${d.cards.join(',')}</p>
                <a href="${d.proofURL}" target="_blank" class="text-blue-500 text-xs underline block mb-2">Ver Capture</a>
                <div class="flex gap-2">
                    <button onclick="confirmSale('${doc.id}')" class="bg-green-500 text-white px-3 py-1 rounded text-xs">Vender</button>
                    <button onclick="rejectSale('${doc.id}')" class="bg-red-500 text-white px-3 py-1 rounded text-xs">Rechazar</button>
                </div>
            </div>`;
        });
    });
}

function renderAdminSoldList() {
    db.collection('ventasConfirmadas').orderBy('saleDate', 'desc').limit(20).onSnapshot(snap => {
        const tb = document.getElementById('soldPlayersTableBody');
        tb.innerHTML = '';
        document.getElementById('soldCount').textContent = snap.size;
        snap.forEach(doc => {
            const d = doc.data();
            tb.innerHTML += `<tr><td class="p-2">${d.name}</td><td class="p-2">${d.phone}</td><td class="p-2 text-green-600 font-bold">${d.cards.join(',')}</td><td class="p-2"><button onclick="deleteSale('${doc.id}')" class="text-red-500 text-xs">X</button></td></tr>`;
        });
    });
}

function confirmSale(id) {
    db.collection('reservasPendientes').doc(id).get().then(doc => {
        const d = doc.data();
        const batch = db.batch();
        batch.set(db.collection('ventasConfirmadas').doc(), { name: d.name, phone: d.phone, cards: d.cards, saleDate: firebase.firestore.FieldValue.serverTimestamp() });
        batch.delete(db.collection('reservasPendientes').doc(id));
        batch.commit().then(() => alert("Venta confirmada"));
    });
}

function rejectSale(id) { if(confirm("¿Rechazar?")) db.collection('reservasPendientes').doc(id).delete(); }
function deleteSale(id) { if(confirm("¿Eliminar venta?")) db.collection('ventasConfirmadas').doc(id).delete(); }

function downloadSoldList() {
    db.collection('ventasConfirmadas').get().then(snap => {
        let csv = "Nombre,Tlf,Tablas\n";
        snap.forEach(doc => { const d = doc.data(); csv += `${d.name},${d.phone},"${d.cards.join(';')}"\n`; });
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = 'ventas.csv'; a.click();
    });
}

// --- UTILS ---
function startBingoTimer() {
    const el = document.getElementById('countdownTimer');
    const target = new Date(BINGO_DATE_STRING).getTime();
    setInterval(() => {
        const diff = target - Date.now();
        if(diff<0) { el.textContent="¡EN VIVO!"; return; }
        const h = Math.floor((diff % (1000*60*60*24))/(1000*60*60));
        const m = Math.floor((diff % (1000*60*60))/(1000*60));
        const s = Math.floor((diff % (1000*60))/1000);
        el.textContent = `${h}:${m<10?'0'+m:m}:${s<10?'0'+s:s}`;
    }, 1000);
}

function searchCardByPhone() {
    const p = document.getElementById('searchPhoneInput').value;
    if(!p) return;
    const res = document.getElementById('resultContent');
    document.getElementById('searchResultArea').classList.remove('hidden');
    res.innerHTML = "Buscando...";
    db.collection('ventasConfirmadas').where('phone','==',p).get().then(snap => {
        res.innerHTML = '';
        if(snap.empty) { res.innerHTML = "No encontrado."; return; }
        snap.forEach(doc => {
            doc.data().cards.forEach(c => {
                res.innerHTML += `<div class="bg-green-100 border border-green-500 p-2 rounded"><span class="text-xl font-bold text-green-700">${c}</span></div>`;
            });
        });
        document.getElementById('resultTitle').textContent = "Tus Tablas:";
    });
}

function copyToClipboard(txt) { navigator.clipboard.writeText(txt); alert("Copiado: " + txt); }

function showLegalModal(type) {
    document.getElementById('legalModal').style.display = 'flex';
    document.getElementById('legalModalTitle').textContent = type === 'terms' ? 'Términos' : 'Privacidad';
    document.getElementById('legalModalBody').innerHTML = type === 'terms' ? '<p>Términos legales de OMEGA Bingo...</p>' : '<p>Política de privacidad...</p>';
}
function hideLegalModal() { document.getElementById('legalModal').style.display = 'none'; }
