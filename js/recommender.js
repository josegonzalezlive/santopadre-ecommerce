/**
 * SantoPadre® Recommendation System
 * Triggers after 1 minute of inactivity with empty cart
 */

const recommenderStyles = `
.recommender-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(4, 28, 20, 0.95);
    z-index: 11000;
    display: none;
    align-items: center;
    justify-content: center;
    font-family: 'Archivo', sans-serif;
}

.recommender-modal {
    background: #06241a;
    border: 1px solid #ff6b00;
    width: 90%;
    max-width: 500px;
    padding: 40px;
    border-radius: 20px;
    position: relative;
    box-shadow: 0 30px 60px rgba(0,0,0,0.5);
}

.recommender-modal h2 {
    font-family: 'Syne', sans-serif;
    color: #ff6b00;
    font-size: 24px;
    margin-bottom: 10px;
    text-align: center;
}

.recommender-modal p.intro {
    text-align: center;
    font-size: 14px;
    color: #f4f4f2;
    margin-bottom: 30px;
    opacity: 0.8;
}

.quiz-step {
    display: none;
}

.quiz-step.active {
    display: block;
    animation: fadeIn 0.4s ease;
}

.quiz-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
}

.quiz-option {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    padding: 15px;
    border-radius: 10px;
    cursor: pointer;
    text-align: center;
    transition: all 0.3s ease;
    font-size: 14px;
    font-weight: 600;
}

.quiz-option:hover {
    background: rgba(255, 107, 0, 0.1);
    border-color: #ff6b00;
}

.quiz-option.selected {
    background: #ff6b00;
    color: #000;
    border-color: #ff6b00;
}

.recommender-close {
    position: absolute;
    top: 20px;
    right: 20px;
    color: #9a9a97;
    cursor: pointer;
    font-size: 20px;
}

.recommendation-result {
    text-align: center;
    display: none;
    animation: zoomIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.rec-card {
    background: rgba(255,255,255,0.03);
    border-radius: 15px;
    padding: 20px;
    margin-bottom: 20px;
}

.rec-card img {
    width: 100%;
    height: 180px;
    object-fit: cover;
    border-radius: 10px;
    margin-bottom: 15px;
}

.rec-card h3 {
    font-size: 18px;
    margin-bottom: 8px;
}

.rec-card p {
    font-size: 12px;
    opacity: 0.7;
    margin-bottom: 15px;
}

.btn-add-rec {
    background: #ff6b00;
    color: #000;
    border: none;
    padding: 12px 25px;
    border-radius: 8px;
    font-weight: 800;
    text-transform: uppercase;
    cursor: pointer;
    width: 100%;
}

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes zoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
`;

class OrderRecommender {
    constructor() {
        this.timer = null;
        this.answers = {
            protein: null,
            style: null,
            allergy: null
        };
        this.init();
    }

    init() {
        const styleSheet = document.createElement("style");
        styleSheet.innerText = recommenderStyles;
        document.head.appendChild(styleSheet);

        this.createModal();
        this.startTimer();

        // Global event listener to reset timer if user interacts
        window.addEventListener('click', () => this.resetTimer());
        window.addEventListener('scroll', () => this.resetTimer());
    }

    createModal() {
        this.overlay = document.createElement("div");
        this.overlay.className = "recommender-overlay";
        this.overlay.innerHTML = `
            <div class="recommender-modal">
                <span class="recommender-close">&times;</span>
                <div id="quiz-container">
                    <h2>¿No sabes qué comer? 🤔</h2>
                    <p class="intro">Tranquilo, déjanos ayudarte a elegir el pecado perfecto.</p>
                    
                    <!-- Step 1: Protein -->
                    <div class="quiz-step active" data-step="1">
                        <p style="text-align:center; margin-bottom:15px; font-weight:700;">1. Elige tu proteína favorita:</p>
                        <div class="quiz-options">
                            <div class="quiz-option" data-val="carne">🥩 Carne Res</div>
                            <div class="quiz-option" data-val="pollo">🍗 Pollo</div>
                            <div class="quiz-option" data-val="pork">🐷 Cochinita/Pastor</div>
                            <div class="quiz-option" data-val="veggie">🌱 Vegetariano</div>
                        </div>
                    </div>

                    <!-- Step 2: Style -->
                    <div class="quiz-step" data-step="2">
                        <p style="text-align:center; margin-bottom:15px; font-weight:700;">2. ¿Cómo te sientes hoy?</p>
                        <div class="quiz-options">
                            <div class="quiz-option" data-val="taco">🌮 Clásico (Taco)</div>
                            <div class="quiz-option" data-val="flauta">🌯 Crujiente (Flauta)</div>
                            <div class="quiz-option" data-val="nachos">🏔️ Montaña (Nachos)</div>
                            <div class="quiz-option" data-val="none">🤷 Me da igual</div>
                        </div>
                    </div>

                    <!-- Step 3: Allergies -->
                    <div class="quiz-step" data-step="3">
                        <p style="text-align:center; margin-bottom:15px; font-weight:700;">3. ¿Alguna restricción?</p>
                        <div class="quiz-options">
                            <div class="quiz-option" data-val="none">✅ Ninguna</div>
                            <div class="quiz-option" data-val="cheese">🚫 Sin Lácteos</div>
                            <div class="quiz-option" data-val="gluten">🚫 Sin Gluten</div>
                            <div class="quiz-option" data-val="spicy">🚫 Sin Picante</div>
                        </div>
                    </div>
                </div>

                <!-- Result -->
                <div class="recommendation-result" id="quiz-result">
                    <h2>Tu Match Sagrado ✨</h2>
                    <div id="result-card-container"></div>
                    <button class="btn-add-rec" id="btn-add-recommended">Añadir a mi pedido</button>
                    <p style="margin-top:15px; font-size:11px; cursor:pointer; text-decoration:underline;" onclick="location.reload()">Reintentar</p>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);

        this.overlay.querySelector('.recommender-close').onclick = () => this.hide();
        
        // Handle Options
        this.overlay.querySelectorAll('.quiz-option').forEach(opt => {
            opt.onclick = (e) => this.handleOptionClick(e.target);
        });
    }

    startTimer() {
        this.timer = setTimeout(() => {
            const currentCart = JSON.parse(localStorage.getItem('santopadre_checkout') || '{"items":[]}');
            if (currentCart.items.length === 0) {
                this.show();
            }
        }, 60000); // 1 minute
    }

    resetTimer() {
        clearTimeout(this.timer);
        this.startTimer();
    }

    show() {
        this.overlay.style.display = "flex";
    }

    hide() {
        this.overlay.style.display = "none";
        // Stop timer for this session
        clearTimeout(this.timer);
    }

    handleOptionClick(el) {
        const step = parseInt(el.closest('.quiz-step').dataset.step);
        const val = el.dataset.val;

        if (step === 1) this.answers.protein = val;
        if (step === 2) this.answers.style = val;
        if (step === 3) this.answers.allergy = val;

        if (step < 3) {
            this.goToStep(step + 1);
        } else {
            this.showResult();
        }
    }

    goToStep(step) {
        this.overlay.querySelectorAll('.quiz-step').forEach(s => s.classList.remove('active'));
        this.overlay.querySelector(`.quiz-step[data-step="${step}"]`).classList.add('active');
    }

    showResult() {
        document.getElementById('quiz-container').style.display = "none";
        const resultArea = document.getElementById('quiz-result');
        resultArea.style.display = "block";

        const recommendedProduct = this.getBestMatch();
        const container = document.getElementById('result-card-container');

        container.innerHTML = `
            <div class="rec-card">
                <img src="${recommendedProduct.image}" alt="${recommendedProduct.name}">
                <h3>${recommendedProduct.name}</h3>
                <p>${recommendedProduct.description}</p>
                <div style="font-size: 18px; font-weight: 800; color: #ff6b00;">$${recommendedProduct.price || recommendedProduct.variants[0].price}</div>
            </div>
        `;

        document.getElementById('btn-add-recommended').onclick = () => {
            if (typeof addToCart === 'function') {
                addToCart(recommendedProduct);
                this.hide();
                if (typeof openCart === 'function') openCart();
            }
        };
    }

    getBestMatch() {
        // Simple Logic based on Protein and Style
        let pId = "nachos"; // Default fallback

        const { protein, style } = this.answers;

        if (protein === 'carne') {
            if (style === 'taco') pId = "tacos-carne";
            else if (style === 'flauta') pId = "flauta-cochinita"; // Approximation
            else pId = "nachos";
        } else if (protein === 'pollo') {
            if (style === 'flauta') pId = "flauta-pollo";
            else pId = "tacos-pollo";
        } else if (protein === 'pork') {
            pId = "tacos-pastor";
        } else if (protein === 'veggie') {
            pId = "nachos"; // Should check for actual veggie options
        }

        // Find in catalog
        let found = null;
        CATALOG.categories.forEach(cat => {
            cat.items.forEach(item => {
                if (item.id === pId) found = item;
            });
        });

        return found || CATALOG.categories[1].items[0]; // Fallback to first taco
    }
}

// Start when DOM ready
window.addEventListener('DOMContentLoaded', () => {
    new OrderRecommender();
});
