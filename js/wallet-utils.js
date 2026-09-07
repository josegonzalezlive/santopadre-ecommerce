
// Focus Trap Utility
window.trapFocus = function(modal) {
  const focusableElements = modal.querySelectorAll('a[href], button, textarea, input, select');
  if (focusableElements.length === 0) return;
  const firstFocusableElement = focusableElements[0];
  const lastFocusableElement = focusableElements[focusableElements.length - 1];

  modal.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstFocusableElement) {
          lastFocusableElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusableElement) {
          firstFocusableElement.focus();
          e.preventDefault();
        }
      }
    }
  });
  firstFocusableElement.focus();
};

window.openModal = function(modalId) {
  const m = document.getElementById(modalId);
  if (m) {
    m.style.display = 'flex';
  if (window.trapFocus) window.trapFocus(m);
    setTimeout(() => {
      m.style.opacity = '1';
      window.trapFocus(m);
    }, 10);
  }
};

// Global Variables usually defined in dashboard or HTML script block
// Make sure to attach these if they are used elsewhere
window.walletConnected = false;
window.padreBalance = 0;
window.usdcBalance = 0.00;
window.walletAddress = "SA-" + Math.floor(100000 + Math.random() * 900000) + "-PADRE";

function connectSimulatedWallet() {
  window.walletConnected = true;
  
  // Update Tag
  const tag = document.getElementById('wallet-status-tag');
  if (tag) {
    tag.style.background = 'rgba(34, 197, 94, 0.1)';
    tag.style.borderColor = 'rgba(34, 197, 94, 0.2)';
    tag.style.color = '#22c55e';
    tag.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background: #22c55e; display: inline-block; animation: pulse 1.5s infinite;"></span> Activo';
  }

  // Switch Views
  const disconnectedView = document.getElementById('wallet-disconnected-view');
  if (disconnectedView) disconnectedView.style.display = 'none';
  
  const connectedView = document.getElementById('wallet-connected-view');
  if (connectedView) connectedView.style.display = 'block';

  // Set Balances
  const mainPointsEl = document.getElementById('wallet-points-value');
  if (mainPointsEl) {
    const val = parseInt(mainPointsEl.innerText);
    if (!isNaN(val) && val > 0) {
      window.padreBalance = val;
    } else {
      mainPointsEl.innerText = window.padreBalance + " $PADRE";
    }
  }
  
  // Show action buttons and history panel
  const actionBtnAddFunds = document.getElementById('action-btn-add-funds');
  if (actionBtnAddFunds) actionBtnAddFunds.style.display = 'inline-flex';

  const actionBtnQr = document.getElementById('action-btn-qr');
  if (actionBtnQr) actionBtnQr.style.display = 'inline-flex';

  const historyPanel = document.getElementById('wallet-history-panel');
  if (historyPanel) historyPanel.style.display = 'block';
  
  updateBalancesUI();

  // Clear Tx Feed and Add Conectado Tx
  const feed = document.getElementById('solana-transactions-feed');
  if (feed) {
    feed.innerHTML = '';
    addSimulatedTx('Activación', 'Cuenta digital de lealtad activada', 'Completado');
  }
}

function updateBalancesUI() {
  const padreEl = document.getElementById('sol-padre-balance');
  if (padreEl) padreEl.innerText = window.padreBalance + " $PADRE";
  
  const usdcEl = document.getElementById('sol-usdc-balance');
  if (usdcEl) usdcEl.innerText = "$" + window.usdcBalance.toFixed(2);
  
  // Also update main layout PTS
  const mainPointsEl = document.getElementById('wallet-points-value');
  if (mainPointsEl) {
    mainPointsEl.innerText = window.padreBalance + " $PADRE";
  }

  // Sync inactive view points too
  const inactivePointsEl = document.getElementById('wallet-points-value-inactive');
  if (inactivePointsEl) {
    inactivePointsEl.innerText = window.padreBalance + " $PADRE";
  }
}

function copyWalletAddress() {
  navigator.clipboard.writeText(window.walletAddress).then(() => {
    alert("ID de Cuenta SantoPadre copiado al portapapeles: " + window.walletAddress);
  }).catch(err => {
    console.error('Error al copiar la dirección de la cuenta: ', err);
  });
}

function showWalletQR() {
  const qrImg = document.getElementById('solana-qr-img');
  const qrData = `santopadre:account?id=${window.walletAddress}&balance=${window.usdcBalance}`;
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrData)}`;
  
  const modal = document.getElementById('solana-qr-modal');
  modal.style.display = 'flex';
  if (window.trapFocus) window.trapFocus(modal);
  setTimeout(() => modal.style.opacity = '1', 10);
}

function addSimulatedTx(type, desc, status) {
  const feed = document.getElementById('solana-transactions-feed');
  if (!feed) return;
  const txHash = Math.random().toString(36).substring(2, 10).toUpperCase();
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const txRow = document.createElement('div');
  txRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);";
  txRow.innerHTML = `
    <div style="text-align: left;">
      <strong style="color: var(--white); font-size: 11px; display: block;">${type}</strong>
      <span style="color: var(--mute); font-size: 9px; font-family: var(--space);">OP-${txHash}</span>
    </div>
    <div style="text-align: right;">
      <span style="color: ${desc.includes('-') ? '#ff4d4d' : 'var(--lime)'}; font-size: 11px; font-weight: bold; display: block;">${desc}</span>
      <span style="color: var(--mute); font-size: 9px;">${time} | <span style="color: #22c55e;">${status}</span></span>
    </div>
  `;
  
  if (feed.innerText.includes('No hay operaciones')) {
    feed.innerHTML = '';
  }
  
  feed.insertBefore(txRow, feed.firstChild);
}

function openAddFundsModal() {
  const modal = document.getElementById('add-funds-modal');
  modal.style.display = 'flex';
  if (window.trapFocus) window.trapFocus(modal);
  setTimeout(() => modal.style.opacity = '1', 10);
  document.getElementById('add-funds-amount').value = '';
  document.getElementById('estimated-padre-pts').innerText = '0';
  selectPaymentMethod('efectivo');
}

function selectPaymentMethod(method) {
  document.getElementById('selected-payment-method').value = method;
  
  const cards = document.querySelectorAll('.modal-payment-card');
  cards.forEach(card => {
    if (card.getAttribute('data-value') === method) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
  
  const boxes = document.querySelectorAll('.payment-info-box');
  boxes.forEach(box => {
    if (box.id === 'details-' + method) {
      box.style.display = 'block';
    } else {
      box.style.display = 'none';
    }
  });
  
  const submitWhatsApp = document.getElementById('modal-submit-whatsapp');
  const submitPhantom = document.getElementById('modal-submit-phantom');
  if (method === 'phantom') {
    if(submitWhatsApp) submitWhatsApp.style.display = 'none';
    if(submitPhantom) submitPhantom.style.display = 'block';
  } else {
    if(submitWhatsApp) submitWhatsApp.style.display = 'block';
    if(submitPhantom) submitPhantom.style.display = 'none';
  }
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = btn.innerText;
    btn.innerText = 'Copiado!';
    btn.style.color = '#22c55e';
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.color = '';
    }, 1500);
  }).catch(err => {
    console.error('Error al copiar: ', err);
  });
}

function updateEstimatedPadre() {
  const amountInput = document.getElementById('add-funds-amount');
  const amount = parseFloat(amountInput.value) || 0;
  const points = Math.round(amount * 100);
  const el = document.getElementById('estimated-padre-pts');
  if (el) el.innerText = points;
}

function submitDepositWhatsApp() {
  const amount = document.getElementById('add-funds-amount').value || '0';
  const methodVal = document.getElementById('selected-payment-method').value;
  
  let methodText = 'Efectivo';
  if (methodVal === 'pago-movil') methodText = 'Pago Móvil';
  if (methodVal === 'zelle') methodText = 'Zelle';
  
  if (parseFloat(amount) <= 0 || isNaN(parseFloat(amount))) {
    alert("Por favor ingresa un monto válido antes de enviar el comprobante.");
    return;
  }

  const msg = `Hola, quiero recargar $${parseFloat(amount).toFixed(2)} a mi Cartera SantoPadre. Mi método de pago es ${methodText}. Adjunto mi comprobante de pago.`;
  window.open(`https://wa.me/584125540246?text=${encodeURIComponent(msg)}`, '_blank');
  
  const m = document.getElementById('add-funds-modal');
  if (m) {
      m.style.opacity = '0';
      setTimeout(() => m.style.display = 'none', 400);
  }
}

async function payWithPhantomModalDirect() {
  const amountInput = document.getElementById('add-funds-amount');
  const amount = parseFloat(amountInput.value) || 0;
  
  if (amount <= 0 || isNaN(amount)) {
    alert("Por favor ingresa un monto válido.");
    return;
  }

  const isPhantomInstalled = window.solana && window.solana.isPhantom;
  
  if (!isPhantomInstalled) {
    const confirmSim = confirm("Phantom Wallet no detectada en este navegador.\n\n¿Deseas simular una transacción exitosa en Solana Devnet para recargar tu saldo?");
    if (confirmSim) {
      simulateSuccessfulWeb3Deposit(amount);
    }
    return;
  }

  const phantomBtn = document.getElementById('modal-submit-phantom');
  const originalText = phantomBtn.innerText;
  
  try {
    phantomBtn.innerText = "Conectando Phantom...";
    phantomBtn.disabled = true;
    
    const resp = await window.solana.connect();
    const senderPubkey = resp.publicKey;
    
    phantomBtn.innerText = "Preparando transacción...";
    
    const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('devnet'), 'confirmed');
    const solPrice = 150;
    const solAmount = amount / solPrice;
    const lamports = Math.round(solAmount * solanaWeb3.LAMPORTS_PER_SOL);
    
    const receiverPubkey = new solanaWeb3.PublicKey(window.PAYMENT_INFO.solanaWallet);
    
    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: senderPubkey,
        toPubkey: receiverPubkey,
        lamports: lamports,
      })
    );
    
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderPubkey;
    
    phantomBtn.innerText = "Aprobando en Phantom...";
    
    const { signature } = await window.solana.signAndSendTransaction(transaction);
    
    phantomBtn.innerText = "Confirmando en Solana...";
    await connection.confirmTransaction(signature);
    
    phantomBtn.innerText = "¡Pago Completado!";
    if (typeof confetti !== 'undefined') {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
    }
    
    window.usdcBalance += amount;
    const earnedPoints = Math.round(amount * 100);
    window.padreBalance += earnedPoints;
    updateBalancesUI();
    
    addSimulatedTx('Depósito SOL (Phantom)', `+$${amount.toFixed(2)} / +${earnedPoints} $PADRE`, 'Completado');
    
    setTimeout(() => {
      const m = document.getElementById('add-funds-modal');
      if (m) {
          m.style.opacity = '0';
          setTimeout(() => {
            m.style.display = 'none';
            phantomBtn.innerText = originalText;
            phantomBtn.disabled = false;
          }, 400);
      }
    }, 1500);

  } catch (err) {
    console.error("Phantom Transaction Error: ", err);
    alert("Error en la transacción o usuario rechazó el pago.\n\nDetalle: " + err.message);
    phantomBtn.innerText = originalText;
    phantomBtn.disabled = false;
  }
}

function simulateSuccessfulWeb3Deposit(amount) {
  const earnedPoints = Math.floor(amount * 10);
  
  // Real atomic transaction via Firebase
  if (window.processRecarga && window.currentUser) {
    window.processRecarga(window.currentUser.uid, earnedPoints, 'PADRE')
      .then(() => {
        if (window.triggerConfetti) window.triggerConfetti();
        closeModal('modal-add-funds');
        if (window.showToast) window.showToast(`¡Recarga exitosa! Ganaste ${earnedPoints} $PADRE`, 'success');
      })
      .catch((err) => {
        console.error("Error processing recarga:", err);
      });
  } else {
    console.error("processRecarga or currentUser not available");
  }
}

function setupPointsSync() {
  const targetNode = document.getElementById('wallet-points-value');
  if (!targetNode) return;
  
  const config = { characterData: true, childList: true, subtree: true };
  
  const callback = function(mutationsList, observer) {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        const rawText = targetNode.innerText;
        const pointsVal = parseInt(rawText);
        if (!isNaN(pointsVal)) {
          window.padreBalance = pointsVal;
          
          const inactiveEl = document.getElementById('wallet-points-value-inactive');
          if (inactiveEl && inactiveEl.innerText !== rawText) {
            inactiveEl.innerText = rawText;
          }
          
          const subDisplayEl = document.getElementById('sol-padre-balance');
          if (subDisplayEl && subDisplayEl.innerText !== rawText) {
            subDisplayEl.innerText = rawText;
          }
        }
      }
    }
  };
  
  const observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
}

document.addEventListener("DOMContentLoaded", () => {
  setupPointsSync();
});

// Bind to window since bindings use these functions globally
window.connectSimulatedWallet = connectSimulatedWallet;
window.copyWalletAddress = copyWalletAddress;
window.showWalletQR = showWalletQR;
window.simulateConsumption = simulateConsumption;
window.openAddFundsModal = openAddFundsModal;
window.selectPaymentMethod = selectPaymentMethod;
window.copyToClipboard = copyToClipboard;
window.updateEstimatedPadre = updateEstimatedPadre;
window.submitDepositWhatsApp = submitDepositWhatsApp;
window.payWithPhantomModalDirect = payWithPhantomModalDirect;
window.simulateSuccessfulWeb3Deposit = simulateSuccessfulWeb3Deposit;

// Modal utilities
window.closeModal = function(modalId) {
    const m = document.getElementById(modalId);
    if (m) {
        m.style.opacity = '0';
        setTimeout(() => m.style.display = 'none', 400);
    }
};

window.setupModals = function() {
    const modals = ['reward-popup-modal', 'add-funds-modal', 'solana-qr-modal'];
    
    modals.forEach(modalId => {
        const m = document.getElementById(modalId);
        if (m) {
            // Close on background click
            m.addEventListener('click', function(e) {
                if (e.target === m) window.closeModal(modalId);
            });
            
            // Close on any close button inside
            const closeBtns = m.querySelectorAll('button');
            closeBtns.forEach(btn => {
                if (btn.innerText.includes('×') || btn.innerText.includes('Entendido')) {
                    btn.addEventListener('click', () => window.closeModal(modalId));
                }
            });
            
            // Special links
            const links = m.querySelectorAll('a');
            links.forEach(link => {
                if (link.innerText.includes('Ver más tarde')) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        window.closeModal(modalId);
                        if (window.switchTopTab) window.switchTopTab('canjear');
                    });
                }
            });
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    window.setupModals();
});
