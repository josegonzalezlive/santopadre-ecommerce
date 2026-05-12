/**
 * SantoPadre® Minimal Floating Tutorial
 */

const tutorialStyles = `
.tutorial-step-box {
    position: fixed;
    z-index: 10001;
    background: #06241a;
    border: 2px solid #ff6b00;
    border-radius: 8px;
    padding: 15px;
    width: 240px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.8);
    display: none;
    color: #f4f4f2;
    animation: fadeIn 0.3s ease;
}

.tutorial-step-box::after {
    content: '';
    position: absolute;
    width: 0; height: 0;
    border: 10px solid transparent;
}

/* Arrow positions */
.tutorial-step-box.pos-bottom::after {
    border-bottom-color: #ff6b00;
    top: -20px; left: 50%; transform: translateX(-50%);
}
.tutorial-step-box.pos-top::after {
    border-top-color: #ff6b00;
    bottom: -20px; left: 50%; transform: translateX(-50%);
}
.tutorial-step-box.pos-left::after {
    border-left-color: #ff6b00;
    right: -20px; top: 50%; transform: translateY(-50%);
}

.tutorial-step-box h4 {
    color: #ff6b00;
    margin-bottom: 5px;
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
}

.tutorial-step-box p {
    font-size: 12px;
    line-height: 1.4;
    margin-bottom: 12px;
}

.tutorial-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.tutorial-btn {
    padding: 4px 10px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-weight: 700;
    font-size: 10px;
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

/* Notificación inicial pequeña */
.tutorial-start-toast {
    position: fixed;
    bottom: 30px;
    right: 30px;
    background: #0a3325;
    border: 1px solid #ff6b00;
    padding: 18px;
    border-radius: 12px;
    z-index: 10002;
    width: 260px;
    box-shadow: 0 15px 40px rgba(0,0,0,0.6);
    animation: slideInRight 0.5s ease;
}

.tutorial-start-toast h3 { font-size: 15px; color: #ff6b00; margin-bottom: 6px; }
.tutorial-start-toast p { font-size: 12px; margin-bottom: 12px; opacity: 0.9; }

@keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
`;

class ShopTutorial {
    constructor() {
        this.currentStep = 0;
        this.steps = [
            {
                title: "1. Agrega un producto",
                text: "Elige lo que más te guste y haz clic en Añadir.",
                selector: ".btn-add:first-of-type",
                position: "top"
            },
            {
                title: "2. Selecciona Variantes",
                text: "Elige el tamaño o sabor ideal para ti.",
                selector: ".btn-add:first-of-type",
                position: "bottom"
            },
            {
                title: "3. Revisa tu pedido",
                text: "Todo lo que elijas se guardará aquí en el carrito.",
                selector: ".cart-trigger",
                position: "bottom"
            },
            {
                title: "4. Finalizar Compra",
                text: "Confirma tu pedido y envíalo por WhatsApp para el pago.",
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
        this.stepBox = document.createElement("div");
        this.stepBox.className = "tutorial-step-box";
        document.body.appendChild(this.stepBox);
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

        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        this.stepBox.style.display = "block";
        this.stepBox.className = `tutorial-step-box pos-${step.position}`;
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
            top = rect.bottom + window.scrollY + 25;
            left = rect.left + (rect.width / 2) - 120;
        } else if (position === 'top') {
            top = rect.top + window.scrollY - 130;
            left = rect.left + (rect.width / 2) - 120;
        } else if (position === 'left') {
            top = rect.top + window.scrollY;
            left = rect.left - 260;
        }

        if (left < 10) left = 10;
        if (left + 240 > window.innerWidth) left = window.innerWidth - 250;

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

    finish() {
        if (this.stepBox) this.stepBox.remove();
        localStorage.setItem('santopadre_tutorial_seen', 'true');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => new ShopTutorial(), 1000);
});
