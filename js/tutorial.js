/**
 * SantoPadre® Minimal Tutorial System
 */

const tutorialStyles = `
.tutorial-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    z-index: 9999;
    display: none;
}

.tutorial-step-box {
    position: fixed;
    z-index: 10001;
    background: #06241a;
    border: 2px solid #ff6b00;
    border-radius: 8px;
    padding: 15px;
    width: 260px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    display: none;
    color: #f4f4f2;
}

.tutorial-step-box h4 {
    color: #ff6b00;
    margin-bottom: 5px;
    font-size: 14px;
    font-weight: 800;
    text-transform: uppercase;
}

.tutorial-step-box p {
    font-size: 13px;
    line-height: 1.4;
    margin-bottom: 15px;
}

.tutorial-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.tutorial-btn {
    padding: 5px 12px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
}

.tutorial-btn.next {
    background: #ff6b00;
    color: #000;
}

.tutorial-btn.skip {
    background: #124032;
    color: #f4f4f2;
}

.tutorial-highlight {
    position: relative;
    z-index: 10000 !important;
    box-shadow: 0 0 0 1000vmax rgba(0, 0, 0, 0.4);
    border-radius: 4px;
}

/* Notificación inicial pequeña */
.tutorial-start-toast {
    position: fixed;
    bottom: 30px;
    right: 30px;
    background: #0a3325;
    border: 1px solid #ff6b00;
    padding: 20px;
    border-radius: 12px;
    z-index: 10002;
    width: 280px;
    box-shadow: 0 15px 40px rgba(0,0,0,0.6);
    animation: slideInRight 0.5s ease;
}

.tutorial-start-toast h3 { font-size: 16px; color: #ff6b00; margin-bottom: 8px; }
.tutorial-start-toast p { font-size: 12px; margin-bottom: 15px; opacity: 0.9; }

@keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
`;

class ShopTutorial {
    constructor() {
        this.currentStep = 0;
        this.steps = [
            {
                title: "Tu Carrito",
                text: "Aquí podrás ver todo lo que has seleccionado.",
                selector: ".cart-trigger",
                position: "bottom"
            },
            {
                title: "Finalizar Pedido",
                text: "Haz clic aquí para confirmar y enviarnos tu pedido por WhatsApp.",
                selector: ".cart-trigger",
                position: "left",
                action: () => {
                   if (typeof openCart === 'function') openCart();
                }
            }
        ];

        this.init();
    }

    init() {
        const styleSheet = document.createElement("style");
        styleSheet.innerText = tutorialStyles;
        document.head.appendChild(styleSheet);

        if (localStorage.getItem('santopadre_tutorial_seen')) return;
        this.showStartToast();
    }

    showStartToast() {
        const toast = document.createElement("div");
        toast.className = "tutorial-start-toast";
        toast.innerHTML = `
            <h3>¿Ayuda con tu pedido?</h3>
            <p>Te enseñamos rápidamente cómo comprar.</p>
            <div class="tutorial-buttons">
                <button class="tutorial-btn skip">Omitir</button>
                <button class="tutorial-btn next">Empezar</button>
            </div>
        `;
        document.body.appendChild(toast);

        toast.querySelector('.next').onclick = () => {
            toast.remove();
            this.startTutorial();
        };

        toast.querySelector('.skip').onclick = () => {
            toast.remove();
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

        if (step.action) step.action();

        this.clearHighlights();
        target.classList.add('tutorial-highlight');
        
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        this.stepBox.style.display = "block";
        this.stepBox.innerHTML = `
            <h4>${step.title}</h4>
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
        let top, left;

        if (position === 'bottom') {
            top = rect.bottom + window.scrollY + 15;
            left = rect.left + (rect.width / 2) - 130;
        } else if (position === 'left') {
            top = rect.top + window.scrollY;
            left = rect.left - 280;
        }

        if (left < 10) left = 10;
        if (left + 260 > window.innerWidth) left = window.innerWidth - 270;

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
        if (this.overlay) this.overlay.remove();
        if (this.stepBox) this.stepBox.remove();
        localStorage.setItem('santopadre_tutorial_seen', 'true');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => new ShopTutorial(), 1000);
});
