// ==========================================================
// ============== CONFIGURACIÓN FIREBASE & GLOBALES =========
// ==========================================================

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

const TOTAL_CARDS = 75;
const CARD_PRICE = 300;
const BINGO_DATE_STRING = 'December 8, 2025 19:00:00'; 
const BINGO_DATE = new Date(BINGO_DATE_STRING).getTime(); 

let selectedCards = JSON.parse(localStorage.getItem('omega_selected_cards')) || [];
let liveData = {};
let previewCard = null;
let timerInterval;
let adminClicks = 0;
let isStoreOpen = true; 

// ================== INICIALIZACIÓN ==================
window.onload = () => {
    document.getElementById('bingoDateDisplay').textContent = new Date(BINGO_DATE).toLocaleDateString('es-ES', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    startRealtimeSync();
    startBingoTimer();
    checkStoreStatus(); 
    
    const pendingTimer = localStorage.getItem('omega_payment_start');
    if (pendingTimer && selectedCards.length > 0) {
            startPaymentTimer(); 
    }

    document.getElementById('payFile').addEventListener('change', function(e) {
        if(this.files[0]) document.getElementById('fileNameDisplay').textContent = this.files[0].name;
    });
};

function saveLocalSelection() {
    localStorage.setItem('omega_selected_cards', JSON.stringify(selectedCards));
}

// ----------------------------------------------------
// =========== TIENDA Y ADMIN LOCK ====================
// ----------------------------------------------------

function checkStoreStatus() {
    db.collection('config').doc('general').onSnapshot(doc => {
        if (doc.exists) {
            isStoreOpen = doc.data().isStoreOpen;
        } else {
            db.collection('config').doc('general').set({ isStoreOpen: true });
            isStoreOpen = true;
        }
        updateStoreUI();
    });
}

function updateStoreUI() {
    const overlay = document.getElementById('closedStoreOverlay');
    const currentUser = auth.currentUser;
    const btn = document.getElementById('toggleStoreBtn');
    const statusText = document.getElementById('storeStatusText');

    if(btn) {
        if(isStoreOpen) {
            btn.textContent = "CERRAR TIENDA 🔒";
            btn.className = "px-6 py-3 rounded-lg font-black text-white transition-colors shadow-lg bg-red-600 hover:bg-red-700";
            statusText.textContent = "La tienda está ABIERTA al público.";
            statusText.className = "text-sm text-green-600 font-bold";
        } else {
            btn.textContent = "ABRIR TIENDA 🔓";
            btn.className = "px-6 py-3 rounded-lg font-black text-white transition-colors shadow-lg bg-green-600 hover:bg-green-700";
            statusText.textContent = "La tienda está CERRADA al público.";
            statusText.className = "text-sm text-red-600 font-bold";
        }
    }

    if (!isStoreOpen && !currentUser) {
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } else {
        overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
        stopGameLogic();
    }
}

function toggleStoreStatus() {
    const newState = !isStoreOpen;
    if(confirm(newState ? "¿ABRIR la tienda al público?" : "¿CERRAR la tienda? Nadie podrá comprar.")) {
        db.collection('config').doc('general').set({ isStoreOpen: newState }, { merge: true })
        .catch(err => alert("Error: " + err.message));
    }
}

let lockClicks = 0;
document.getElementById('adminSecretLock').addEventListener('click', () => {
    lockClicks++;
    if(lockClicks >= 6) {
        document.getElementById('closedStoreOverlay').style.display = 'none'; 
        stopGameLogic();
        document.getElementById('clientContent').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('adminLogin').classList.remove('hidden');
        lockClicks = 0;
    }
});

// ----------------------------------------------------
// =========== SINCRONIZACIÓN Y LÓGICA DE BINGO =======
// ----------------------------------------------------

function startRealtimeSync() {
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

    db.collection('reservasPendientes').onSnapshot(snap => {
        snap.docChanges().forEach(change => {
            const d = change.doc.data();
            const docId = change.doc.id; 
            (d.cards || []).forEach(c => {
                const isSold = liveData[c]?.status === 'sold';
                if(change.type === 'removed') {
                    if (!isSold) delete liveData[c];
                } else {
                    if(!isSold) liveData[c] = { status: 'reserved', reservationId: docId, ...d };
                }
            });
        });
        updateUI();
        if(auth.currentUser) renderAdminPendingList();
    });

    auth.onAuthStateChanged(u => {
        updateStoreUI(); 
        if(u) {
            document.getElementById('clientContent').classList.add('hidden');
            document.getElementById('adminPanel').classList.remove('hidden');
            document.getElementById('adminLogin').classList.add('hidden');
            document.getElementById('adminDashboard').classList.remove('hidden');
            renderAdminPendingList();
            renderAdminSoldList();
        } else {
            document.getElementById('clientContent').classList.remove('hidden');
            document.getElementById('adminPanel').classList.add('hidden');
        }
    });
}

function updateUI() {
    let sold = 0;
    for(let i=1; i<=TOTAL_CARDS; i++) {
        if(liveData[i]?.status === 'sold') sold++;
    }
    document.getElementById('availableCount').textContent = TOTAL_CARDS - sold;
    
    if(document.getElementById('cardSelectionModal').style.display === 'flex') renderGrid();
    if(document.getElementById('paymentProcessModal').style.display === 'flex') checkPaymentConflicts();
}

function checkPaymentConflicts() {
    let conflicts = [];
    let newSelection = [];
    selectedCards.forEach(card => {
        const status = getStatus(card);
        if (status === 'sold' || status === 'reserved') conflicts.push(card);
        else newSelection.push(card);
    });

    if (conflicts.length > 0) {
        alert(`⚠️ ¡ATENCIÓN! El número(s) ${conflicts.join(', ')} acaba de ser comprado. Han sido retirados.`);
        selectedCards = newSelection;
        saveLocalSelection();
        if (selectedCards.length === 0) {
            hidePaymentModal(); 
            localStorage.removeItem('omega_payment_start'); 
        } else {
            document.getElementById('payCardsList').textContent = selectedCards.join(', ');
            document.getElementById('payTotal').textContent = `Bs. ${(selectedCards.length * CARD_PRICE).toFixed(2)}`;
        }
    }
}

function showCardSelectionModal() {
    document.getElementById('cardPreviewModal').style.display = 'none';
    document.getElementById('paymentProcessModal').style.display = 'none';
    document.getElementById('legalModal').style.display = 'none'; 
    document.getElementById('cardSelectionModal').style.display = 'flex'; 
    renderGrid();
    updateTotal();
    if(selectedCards.length > 0 && localStorage.getItem('omega_payment_start')) startPaymentTimer();
    else clearInterval(timerInterval);
}

function hideCardSelectionModal() {
    document.getElementById('cardSelectionModal').style.display = 'none';
}

function getStatus(n) {
    if(liveData[n]?.status === 'sold') return 'sold';
    if(liveData[n]?.status === 'reserved') return 'reserved';
    if(selectedCards.includes(n)) return 'selected'; 
    return 'available';
}

function renderGrid() {
    const container = document.getElementById('cardListContainer');
    container.innerHTML = '';
    for(let i=1; i<=TOTAL_CARDS; i++) {
        const st = getStatus(i);
        let tag = st === 'sold' ? 'VENDIDA' : (st === 'reserved' ? 'OCUPADA' : (st === 'selected' ? 'TUYA' : 'VER'));
        
        const div = document.createElement('div');
        div.className = `card-item-container status-${st}`;
        div.innerHTML = `
            <div class="bingo-ball" onclick="handleBallClick(${i}, '${st}')">${i}</div>
            <span class="ver-tag" onclick="event.stopPropagation(); openPreview(${i})">${tag}</span>
        `;
        container.appendChild(div);
    }
}

function handleBallClick(n, st) {
    if(st === 'sold' || st === 'reserved') {
        openPreview(n);
    } else {
        if(selectedCards.includes(n)) selectedCards = selectedCards.filter(x => x !== n);
        else {
            if (liveData[n]?.status === 'sold' || liveData[n]?.status === 'reserved') {
                    openPreview(n);
                    return;
            }
            selectedCards.push(n);
        }
        saveLocalSelection(); 
        updateTotal();
        renderGrid(); 
    }
}

function updateTotal() {
    document.getElementById('totalCostDisplay').textContent = `Bs. ${(selectedCards.length * CARD_PRICE).toFixed(2)}`;
}

function openPreview(n) {
    previewCard = n;
    const st = getStatus(n);
    const d = liveData[n];
    const btn = document.getElementById('btnPreviewAction');
    const txt = document.getElementById('previewStatusText');
    
    document.getElementById('previewNum').textContent = n;
    document.getElementById('previewImgContainer').innerHTML = `<img src="./tablas/tabla_${n}.png" class="bingo-card-image" onerror="this.src='https://placehold.co/300?text=Tabla+${n}'">`;
    
    if(st === 'sold') {
        txt.textContent = `❌ VENDIDA. (${d.name || 'Otro jugador'})`;
        txt.className = "text-red-600 font-bold mb-4";
        btn.style.display = 'none';
    } else if(st === 'reserved') {
        txt.textContent = `⏳ OCUPADA. (${d.name || 'Otro jugador'}) Esperando confirmación.`;
        txt.className = "text-orange-500 font-bold mb-4";
        btn.style.display = 'none';
    } else {
        const isSel = selectedCards.includes(n);
        txt.textContent = isSel ? "¿Ya no quieres esta tabla?" : "¿Te gusta esta tabla?";
        txt.className = "text-gray-700 font-bold mb-4";
        btn.style.display = 'block';
        btn.textContent = isSel ? "QUITAR DE MI LISTA" : "AGREGAR A MI LISTA";
        btn.className = isSel ? "flex-1 py-2 bg-red-500 text-white font-bold rounded-lg" : "flex-1 py-2 bg-green-500 text-white font-bold rounded-lg";
        btn.onclick = () => {
            if(isSel) selectedCards = selectedCards.filter(x => x !== n);
            else selectedCards.push(n);
            saveLocalSelection();
            updateTotal();
            closePreview();
            showCardSelectionModal();
        };
    }
    document.getElementById('cardSelectionModal').style.display = 'none';
    document.getElementById('cardPreviewModal').style.display = 'flex';
}

function closePreview() {
    document.getElementById('cardPreviewModal').style.display = 'none';
    showCardSelectionModal();
}

// ================== PAGO ==================
function preparePayment() {
    if(selectedCards.length === 0) return alert("Selecciona al menos una tabla");
    
    // Validación final
    for (const card of selectedCards) {
        if (liveData[card] && (liveData[card].status === 'sold' || liveData[card].status === 'reserved')) {
            alert("⚠️ Alguna tabla seleccionada ya no está disponible.");
            return showCardSelectionModal();
        }
    }

    document.getElementById('payName').value = '';
    document.getElementById('payPhone').value = '';
    document.getElementById('payRef').value = '';
    document.getElementById('fileNameDisplay').textContent = '';

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
    const startTime = parseInt(localStorage.getItem('omega_payment_start'));
    if (!startTime) return; 

    timerInterval = setInterval(() => {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const remaining = Math.max(0, 300 - elapsedSeconds);
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        display.textContent = `0${m}:${s<10?'0'+s:s}`;

        if(remaining <= 0) {
            clearInterval(timerInterval);
            alert("Tiempo agotado. Tablas liberadas.");
            localStorage.removeItem('omega_payment_start');
            selectedCards = []; 
            localStorage.removeItem('omega_selected_cards');
            hidePaymentModal();
            updateUI();
        }
    }, 1000);
}

function hidePaymentModal() {
    document.getElementById('paymentProcessModal').style.display = 'none';
    showCardSelectionModal();
}

async function submitPayment() {
    const YOUR_CLOUD_NAME = "dcenrp74j"; 
    const YOUR_UPLOAD_PRESET = "bingo_comprobantes"; 
    
    const name = document.getElementById('payName').value;
    const phone = document.getElementById('payPhone').value.replace(/\D/g,'');
    const ref = document.getElementById('payRef').value;
    const file = document.getElementById('payFile').files[0];
    const statusMsg = document.getElementById('uploadStatus');

    if(!name || phone.length < 10 || !ref || !file) {
        statusMsg.textContent = "Datos incompletos.";
        statusMsg.className = "text-center text-sm mt-2 font-bold text-red-600 block";
        return;
    }

    statusMsg.textContent = "Subiendo comprobante... ⏳";
    statusMsg.className = "text-center text-sm mt-2 font-bold text-blue-600 block";

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', YOUR_UPLOAD_PRESET);
        formData.append('public_id', `${phone}_${Date.now()}`); 
        
        const res = await fetch(`https://api.cloudinary.com/v1_1/${YOUR_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        
        if (!res.ok || !data.secure_url) throw new Error(data.error?.message || res.statusText);

        await db.collection('reservasPendientes').add({ 
            name, phone, reference: ref, proofURL: data.secure_url, 
            cards: selectedCards, totalAmount: selectedCards.length * CARD_PRICE,
            timestamp: Date.now(), status: 'PENDING_CONFIRMATION'
        });

        statusMsg.textContent = "¡Enviado! 🎉";
        confetti({ particleCount: 100, spread: 70 });
        
        selectedCards = [];
        localStorage.removeItem('omega_selected_cards');
        localStorage.removeItem('omega_payment_start');
        clearInterval(timerInterval);

        setTimeout(() => {
            hidePaymentModal();
            alert("Pago enviado. Espera confirmación.");
        }, 1500);

    } catch(e) {
        statusMsg.textContent = `Error: ${e.message}`;
        statusMsg.className = "text-center text-sm mt-2 font-bold text-red-600 block";
    }
}

// ================== ADMIN ==================
document.getElementById('footer-logo').addEventListener('click', () => {
    adminClicks++;
    if(adminClicks >= 6) {
        document.getElementById('clientContent').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        if(auth.currentUser) {
            document.getElementById('adminLogin').classList.add('hidden');
            document.getElementById('adminDashboard').classList.remove('hidden');
        }
        adminClicks = 0;
    }
});

function adminLogin() {
    const e = document.getElementById('adminEmail').value;
    const p = document.getElementById('adminPassword').value;
    auth.signInWithEmailAndPassword(e, p).then(() => {
        document.getElementById('adminLogin').classList.add('hidden');
        document.getElementById('adminDashboard').classList.remove('hidden');
    }).catch(err => document.getElementById('adminLoginError').textContent = err.message);
}

function adminLogout() { auth.signOut().then(() => location.reload()); }

function renderAdminPendingList() {
    db.collection('reservasPendientes').where('status', '==', 'PENDING_CONFIRMATION').onSnapshot(snap => {
        const div = document.getElementById('pendingCardsList');
        div.innerHTML = '';
        document.getElementById('pendingCount').textContent = snap.size;
        snap.forEach(doc => {
            const d = doc.data();
            div.innerHTML += `<div class="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-400"><div class="flex justify-between mb-2"><span class="font-bold text-gray-800">${d.name}</span><span class="text-sm bg-gray-200 px-2 rounded">${d.phone}</span></div><p class="text-sm text-gray-600 mb-1">Ref: <b>${d.reference}</b> | Bs. ${d.totalAmount}</p><p class="text-sm mb-2">Tablas: <b class="text-purple-600">${d.cards.join(', ')}</b></p><a href="${d.proofURL}" target="_blank" class="block text-center bg-blue-50 text-blue-600 py-1 rounded text-sm font-bold mb-3 border border-blue-200">Ver Comprobante</a><div class="flex gap-2"><button onclick="confirmSale('${doc.id}')" class="flex-1 bg-green-500 text-white py-2 rounded font-bold hover:bg-green-600">APROBAR</button><button onclick="rejectSale('${doc.id}')" class="flex-1 bg-red-500 text-white py-2 rounded font-bold hover:bg-red-600">RECHAZAR</button></div></div>`;
        });
    });
}

function renderAdminSoldList() {
    db.collection('ventasConfirmadas').orderBy('saleDate', 'desc').limit(50).onSnapshot(snap => {
        const tbody = document.getElementById('soldPlayersTableBody');
        tbody.innerHTML = '';
        document.getElementById('soldCount').textContent = snap.size;
        snap.forEach(doc => {
            const d = doc.data();
            tbody.innerHTML += `<tr class="border-b hover:bg-gray-50"><td class="p-3 font-bold">${d.name}</td><td class="p-3 text-xs">${d.phone}</td><td class="p-3 text-green-600 font-bold text-xs break-all">${d.cards.join(',')}</td><td class="p-3"><button onclick="deleteSale('${doc.id}')" class="text-red-500 text-xs underline">Eliminar</button></td></tr>`;
        });
    });
}

function confirmSale(id) {
    if(!confirm("¿Confirmar pago y vender tablas?")) return;
    db.collection('reservasPendientes').doc(id).get().then(doc => {
        if (!doc.exists) return alert("Reserva no encontrada.");
        const d = doc.data();
        let cardsToSell = [];
        
        d.cards.forEach(c => {
            if (liveData[c]?.status !== 'sold') cardsToSell.push(c);
        });
        
        if (cardsToSell.length === 0) return alert("Todas estas tablas ya fueron vendidas a otro.");
        
        const batch = db.batch();
        batch.set(db.collection('ventasConfirmadas').doc(), { 
            name: d.name, phone: d.phone, cards: cardsToSell,
            saleDate: firebase.firestore.FieldValue.serverTimestamp() 
        });
        batch.delete(db.collection('reservasPendientes').doc(id));
        batch.commit().then(() => alert("Venta confirmada.")).catch(e => alert("Error"));
    });
}

function rejectSale(id) { 
    if(confirm("¿Rechazar?")) db.collection('reservasPendientes').doc(id).delete();
}

function deleteSale(id) { 
    if(confirm("¿Eliminar venta?")) db.collection('ventasConfirmadas').doc(id).delete();
}

function downloadSoldList() {
    db.collection('ventasConfirmadas').get().then(snap => {
        let csv = "Nombre,Telefono,Tablas\n";
        snap.forEach(doc => { 
            const d = doc.data(); 
            csv += `${d.name},${d.phone},"${d.cards.join(';')}"\n`; 
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
        a.download = 'ventas_omega.csv';
        a.click();
    });
}

// ================== OTROS ==================
function startBingoTimer() {
    const cd = document.getElementById('countdownTimer');
    setInterval(() => {
        const dist = BINGO_DATE - new Date().getTime();
        if (dist < 0) { cd.textContent = "¡JUEGO EN VIVO! 🎉"; return; }
        const d = Math.floor(dist / (1000 * 60 * 60 * 24));
        const h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((dist % (1000 * 60)) / 1000);
        cd.textContent = `${d>0?d+'D ':''}${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }, 1000);
}

function searchCardByPhone() {
    const p = document.getElementById('searchPhoneInput').value.replace(/\D/g,'');
    if(p.length < 10) return alert("Teléfono inválido");
    document.getElementById('searchResultArea').classList.remove('hidden');
    document.getElementById('resultTitle').textContent = `Jugador: ${p}`;
    // Nota: Esta es una búsqueda simple, en producción idealmente usa índices compuestos
    alert("Función simplificada para demo. Busca en consola o panel admin.");
}

function searchCard() {
    const n = parseInt(document.getElementById('cardNumberInput').value);
    if(!n) return;
    document.getElementById('searchResultArea').classList.remove('hidden');
    const d = liveData[n];
    const st = d ? (d.status === 'sold' ? 'VENDIDA' : 'RESERVADA') : 'DISPONIBLE';
    const col = d ? (d.status === 'sold' ? 'green' : 'orange') : 'purple';
    document.getElementById('resultContent').innerHTML = `<div class="text-center"><p class="font-bold text-${col}-600 text-xl">${st}</p>${d?.name ? `<p class="text-sm">Jugador: ${d.name}</p>` : ''}</div>`;
}

function copyToClipboard(txt) { navigator.clipboard.writeText(txt); alert("Copiado!"); }

// Funciones Legales (Simplificadas para archivo separado)
const legalContent = {
    terms: `<h2 class="font-bold mb-2">Términos</h2><p>Uso de la plataforma Omega...</p>`,
    privacy: `<h2 class="font-bold mb-2">Privacidad</h2><p>Sus datos están seguros...</p>`
};

function showLegalModal(type) {
    document.getElementById('legalModal').style.display = 'flex';
    document.getElementById('legalModalBody').innerHTML = legalContent[type];
}
function hideLegalModal() { document.getElementById('legalModal').style.display = 'none'; }
