/**
 * SantoPadre® Interactive Tutorial System
 * Designed for premium e-commerce experience.
 */

const tutorialStyles = `
.tutorial-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(4, 28, 20, 0.85);
    z-index: 9999;
    display: none;
    backdrop-filter: blur(4px);
    transition: opacity 0.4s ease;
}

.tutorial-step-box {
    position: fixed;
    z-index: 10001;
    background: #0a3325;
    border: 1px solid rgba(255, 107, 0, 0.3);
    border-radius: 12px;
    padding: 24px;
    width: 320px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    display: none;
    color: #f4f4f2;
    font-family: 'Archivo', sans-serif;
}

.tutorial-step-box h4 {
    color: #ff6b00;
    margin-bottom: 8px;
    font-size: 16px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.tutorial-step-box p {
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 20px;
    opacity: 0.9;
}

.tutorial-buttons {
    display: flex;
    justify-content: space-between;
    gap: 10px;
}

.tutorial-btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-weight: 700;
    font-size: 12px;
    text-transform: uppercase;
    transition: all 0.3s ease;
}

.tutorial-btn.next {
    background: #ff6b00;
    color: #000;
    flex: 1;
}

.tutorial-btn.skip {
    background: transparent;
    border: 1px solid rgba(255, 107, 0, 0.5);
    color: #ff6b00;
}

.tutorial-highlight {
    position: relative;
    z-index: 10000 !important;
    pointer-events: none;
    box-shadow: 0 0 0 1000vmax rgba(4, 28, 20, 0.85), 0 0 20px rgba(255, 107, 0, 0.5);
    border-radius: 8px;
}

/* Modal inicial */
.tutorial-modal-bg {
    position: fixed;
    top:0; left:0; width:100%; height:100%;
    background: rgba(0,0,0,0.8);
    backdrop-filter: blur(8px);
    z-index: 10002;
    display: flex;
    align-items: center;
    justify-content: center;
}

.tutorial-welcome {
    background: #06241a;
    border: 1px solid #124032;
    padding: 40px;
    border-radius: 20px;
    max-width: 450px;
    text-align: center;
    box-shadow: 0 30px 60px rgba(0,0,0,0.5);
}

.tutorial-welcome h2 {
    font-family: 'Syne', sans-serif;
    font-size: 28px;
    margin-bottom: 15px;
    color: #ff6b00;
}

.tutorial-welcome p {
    color: #f4f4f2;
    margin-bottom: 30px;
    opacity: 0.8;
    line-height: 1.6;
}

.welcome-btns {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.btn-start {
    background: #ff6b00;
    color: #000;
    padding: 15px;
    border: none;
    border-radius: 8px;
    font-weight: 800;
    text-transform: uppercase;
    cursor: pointer;
    font-size: 14px;
}

.btn-skip-init {
    background: transparent;
    color: #9a9a97;
    border: none;
    cursor: pointer;
    font-size: 12px;
    text-decoration: underline;
}
`;

class ShopTutorial {
    constructor() {
        this.currentStep = 0;
        this.steps = [
            {
                title: "Explora el Menú",
                text: "Desliza y encuentra tus platos favoritos. Tenemos opciones para todos los gustos.",
                selector: ".categories-slider",
                position: "bottom"
            },
            {
                title: "Personaliza tu pedido",
                text: "Haz clic en 'Añadir' para ver las opciones de cada producto.",
                selector: ".btn-add:first-of-type",
                position: "top"
            },
            {
                title: "Tu Carrito",
                text: "Aquí podrás ver todo lo que has seleccionado y ajustar cantidades.",
                selector: ".cart-trigger",
                position: "bottom"
            },
            {
                title: "Finalizar Pedido",
                text: "¡Ya casi estás! Haz clic en confirmar y envíanos tu pedido por WhatsApp para concretar el pago.",
                selector: ".cart-trigger", // We'll open the cart for this step
                position: "left",
                action: () => {
                   if (typeof openCart === 'function') openCart();
                }
            }
        ];

        this.init();
    }

    init() {
        // Inject Styles
        const styleSheet = document.createElement("style");
        styleSheet.innerText = tutorialStyles;
        document.head.appendChild(styleSheet);

        // Check if already seen
        if (localStorage.getItem('santopadre_tutorial_seen')) return;

        // Create Welcome Modal
        this.showWelcome();
    }

    showWelcome() {
        const modal = document.createElement("div");
        modal.className = "tutorial-modal-bg";
        modal.innerHTML = `
            <div class="tutorial-welcome">
                <h2>¿Nuevo en SantoPadre?</h2>
                <p>Te enseñamos a pedir tus favoritos en menos de 30 segundos. ¡Es muy fácil!</p>
                <div class="welcome-btns">
                    <button class="btn-start">🚀 Empezar Tutorial</button>
                    <button class="btn-skip-init">Quizás luego</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.btn-start').onclick = () => {
            modal.remove();
            this.startTutorial();
        };

        modal.querySelector('.btn-skip-init').onclick = () => {
            modal.remove();
            localStorage.setItem('santopadre_tutorial_seen', 'true');
        };
    }

    startTutorial() {
        this.overlay = document.createElement("div");
        this.overlay.className = "tutorial-overlay";
        document.body.appendChild(this.overlay);

        this.stepBox = document.createElement("div");
        this.stepBox.className = "tutorial-step-box";
        document.body.appendChild(this.stepBox);

        this.overlay.style.display = "block";
        this.renderStep();
    }

    renderStep() {
        const step = this.steps[this.currentStep];
        const target = document.querySelector(step.selector);

        if (!target) {
            this.next();
            return;
        }

        // Action if any
        if (step.action) step.action();

        // Highlight
        this.clearHighlights();
        target.classList.add('tutorial-highlight');
        
        // Scroll to target
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Update Box
        this.stepBox.style.display = "block";
        this.stepBox.innerHTML = `
            <h4>Paso ${this.currentStep + 1}: ${step.title}</h4>
            <p>${step.text}</p>
            <div class="tutorial-buttons">
                <button class="tutorial-btn skip">Omitir</button>
                <button class="tutorial-btn next">${this.currentStep === this.steps.length - 1 ? '¡Listo!' : 'Siguiente'}</button>
            </div>
        `;

        this.positionBox(target, step.position);

        this.stepBox.querySelector('.next').onclick = () => this.next();
        this.stepBox.querySelector('.skip').onclick = () => this.finish();
    }

    positionBox(target, position) {
        const rect = target.getBoundingClientRect();
        const boxRect = this.stepBox.getBoundingClientRect();
        let top, left;

        const margin = 20;

        if (position === 'bottom') {
            top = rect.bottom + window.scrollY + margin;
            left = rect.left + (rect.width / 2) - (320 / 2);
        } else if (position === 'top') {
            top = rect.top + window.scrollY - 200; // Rough estimate
            left = rect.left + (rect.width / 2) - (320 / 2);
        } else if (position === 'left') {
            top = rect.top + window.scrollY;
            left = rect.left - 340;
        }

        // Bounds check
        if (left < 10) left = 10;
        if (left + 320 > window.innerWidth) left = window.innerWidth - 330;

        this.stepBox.style.top = `${top}px`;
        this.stepBox.style.left = `${left}px`;
    }

    next() {
        this.currentStep++;
        if (this.currentStep < this.steps.length) {
            this.renderStep();
        } else {
            this.finish();
        }
    }

    clearHighlights() {
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });
    }

    finish() {
        this.clearHighlights();
        this.overlay.remove();
        this.stepBox.remove();
        localStorage.setItem('santopadre_tutorial_seen', 'true');
        
        // Final Toast
        const toast = document.createElement("div");
        toast.style = "position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:#ff6b00; color:#000; padding:12px 24px; border-radius:30px; font-weight:800; z-index:10000; animation: fadeInUp 0.5s ease;";
        toast.innerText = "¡Tutorial completado! ¡Feliz pedido!";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// Start Tutorial when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        new ShopTutorial();
    }, 1500); // Small delay for premium feel
});
