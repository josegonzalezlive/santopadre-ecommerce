// Fuente única de los datos de pago públicos de SantoPadre® (banco, teléfono, correo,
// wallet Solana). Antes estaban duplicados literalmente en cuenta.html, signup.html,
// checkout.html, js/checkout.js y dos veces en js/wallet-bindings.js — un cambio de
// cuenta bancaria requería recordar actualizar 7+ lugares a mano.
// Script clásico (no módulo) a propósito: se carga con <script> simple antes que
// wallet-bindings.js / wallet-utils.js / checkout.js, que no son módulos ES.
window.PAYMENT_INFO = {
  bank: 'BNC - 0191',
  ci: '21564286',
  phone: '04125540246',
  email: 'luisgonzalez372f@gmail.com',
  solanaWallet: '7pHnSvY3ki2SZ9YgXUt2ZxeS2F3cS5j2qNwgdHTQLFk3'
};
