export function handleFirestoreError(error) {
  const messages = {
    'permission-denied': 'No tienes permiso para esta operación.',
    'unavailable': 'Sin conexión. Los datos se sincronizarán al reconectar.',
    'not-found': 'Datos no encontrados.',
  };
  
  const msg = messages[error.code] || 'Error inesperado. Intenta de nuevo.';
  console.error("Firestore Error:", error);
  
  if (window.showToast) {
    window.showToast(msg, 'error');
  } else {
    alert(msg);
  }
}

export function showLoadingState(elementId, isLoading) {
  const el = document.getElementById(elementId);
  if (el) {
    if (isLoading) {
      el.classList.add('loading');
      el.style.opacity = '0.5';
      el.style.pointerEvents = 'none';
    } else {
      el.classList.remove('loading');
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
    }
  }
}
