document.addEventListener('DOMContentLoaded', () => {

  const el_evt_0a3625 = document.getElementById('evt-0a3625');
  if (el_evt_0a3625) {
    el_evt_0a3625.addEventListener('click', function(event) {
      window.location.href='https://www.santopadre.store'
    });
  }
  const el_mobile_hamburger_btn = document.getElementById('mobile-hamburger-btn');
  if (el_mobile_hamburger_btn) {
    el_mobile_hamburger_btn.addEventListener('click', function(event) {
      toggleMobileMenu()
    });
  }
  const el_sidebar_overlay = document.getElementById('sidebar-overlay');
  if (el_sidebar_overlay) {
    el_sidebar_overlay.addEventListener('click', function(event) {
      toggleMobileMenu()
    });
  }
  const el_evt_7465ed = document.getElementById('evt-7465ed');
  if (el_evt_7465ed) {
    el_evt_7465ed.addEventListener('click', function(event) {
      toggleMobileMenu()
    });
  }
  const el_nav_recompensas = document.getElementById('nav-recompensas');
  if (el_nav_recompensas) {
    el_nav_recompensas.addEventListener('click', function(event) {
      switchSidebarTab('recompensas')
    });
  }
  const el_nav_favoritos = document.getElementById('nav-favoritos');
  if (el_nav_favoritos) {
    el_nav_favoritos.addEventListener('click', function(event) {
      switchSidebarTab('favoritos')
    });
  }
  const el_nav_perfil = document.getElementById('nav-perfil');
  if (el_nav_perfil) {
    el_nav_perfil.addEventListener('click', function(event) {
      switchSidebarTab('perfil-detalles')
    });
  }
  const el_nav_pedidos = document.getElementById('nav-pedidos');
  if (el_nav_pedidos) {
    el_nav_pedidos.addEventListener('click', function(event) {
      switchTopTab('actividad')
    });
  }
  const el_nav_direcciones = document.getElementById('nav-direcciones');
  if (el_nav_direcciones) {
    el_nav_direcciones.addEventListener('click', function(event) {
      switchSidebarTab('direcciones')
    });
  }
  const el_evt_ccfde1 = document.getElementById('evt-ccfde1');
  if (el_evt_ccfde1) {
    el_evt_ccfde1.addEventListener('click', function(event) {
      window.location.href='https://www.santopadre.store'
    });
  }
  const el_tab_cartera = document.getElementById('tab-cartera');
  if (el_tab_cartera) {
    el_tab_cartera.addEventListener('click', function(event) {
      switchTopTab('cartera')
    });
  }
  const el_tab_sellos = document.getElementById('tab-sellos');
  if (el_tab_sellos) {
    el_tab_sellos.addEventListener('click', function(event) {
      switchTopTab('sellos')
    });
  }
  const el_tab_referidos = document.getElementById('tab-referidos');
  if (el_tab_referidos) {
    el_tab_referidos.addEventListener('click', function(event) {
      switchTopTab('referidos')
    });
  }
  const el_tab_ganar = document.getElementById('tab-ganar');
  if (el_tab_ganar) {
    el_tab_ganar.addEventListener('click', function(event) {
      switchTopTab('ganar')
    });
  }
  const el_tab_canjear = document.getElementById('tab-canjear');
  if (el_tab_canjear) {
    el_tab_canjear.addEventListener('click', function(event) {
      switchTopTab('canjear')
    });
  }
  const el_tab_actividad = document.getElementById('tab-actividad');
  if (el_tab_actividad) {
    el_tab_actividad.addEventListener('click', function(event) {
      switchTopTab('actividad')
    });
  }
  const el_evt_8315c9 = document.getElementById('evt-8315c9');
  if (el_evt_8315c9) {
    el_evt_8315c9.addEventListener('click', function(event) {
      connectSimulatedWallet()
    });
  }
  const el_evt_fb7514 = document.getElementById('evt-fb7514');
  if (el_evt_fb7514) {
    el_evt_fb7514.addEventListener('click', function(event) {
      copyWalletAddress()
    });
  }
  const el_action_btn_add_funds = document.getElementById('action-btn-add-funds');
  if (el_action_btn_add_funds) {
    el_action_btn_add_funds.addEventListener('click', function(event) {
      openAddFundsModal()
    });
  }
  const el_action_btn_qr = document.getElementById('action-btn-qr');
  if (el_action_btn_qr) {
    el_action_btn_qr.addEventListener('click', function(event) {
      showWalletQR()
    });
  }
  const el_evt_f000de = document.getElementById('evt-f000de');
  if (el_evt_f000de) {
    el_evt_f000de.addEventListener('click', function(event) {
      window.claimPendingReward()
    });
  }
  const el_evt_7484ba = document.getElementById('evt-7484ba');
  if (el_evt_7484ba) {
    el_evt_7484ba.addEventListener('click', function(event) {
      window.downloadPasskitMock('apple'); return false;
    });
  }
  const el_evt_615e07 = document.getElementById('evt-615e07');
  if (el_evt_615e07) {
    el_evt_615e07.addEventListener('click', function(event) {
      window.downloadPasskitMock('google'); return false;
    });
  }
  const el_evt_2a100b = document.getElementById('evt-2a100b');
  if (el_evt_2a100b) {
    el_evt_2a100b.addEventListener('click', function(event) {
      window.location.href='https://www.santopadre.store'
    });
  }
  const el_evt_dd383e = document.getElementById('evt-dd383e');
  if (el_evt_dd383e) {
    el_evt_dd383e.addEventListener('click', function(event) {
      toggleDetails('birthday-details')
    });
  }
  const el_evt_9d1d8a = document.getElementById('evt-9d1d8a');
  if (el_evt_9d1d8a) {
    el_evt_9d1d8a.addEventListener('click', function(event) {
      toggleDetails('review-details')
    });
  }
  const el_evt_d671f2 = document.getElementById('evt-d671f2');
  if (el_evt_d671f2) {
    el_evt_d671f2.addEventListener('click', function(event) {
      window.trackReviewClick(); window.open('https://g.page/r/CRyfApltCzMbEAE/review', '_blank')
    });
  }
  const el_claim_review_btn = document.getElementById('claim-review-btn');
  if (el_claim_review_btn) {
    el_claim_review_btn.addEventListener('click', function(event) {
      window.showReviewVerificationForm()
    });
  }
  const el_submit_review_verification_btn = document.getElementById('submit-review-verification-btn');
  if (el_submit_review_verification_btn) {
    el_submit_review_verification_btn.addEventListener('click', function(event) {
      window.submitReviewVerification()
    });
  }
  const el_evt_65a2f0 = document.getElementById('evt-65a2f0');
  if (el_evt_65a2f0) {
    el_evt_65a2f0.addEventListener('click', function(event) {
      toggleDetails('instagram-details')
    });
  }
  const el_evt_b66e0d = document.getElementById('evt-b66e0d');
  if (el_evt_b66e0d) {
    el_evt_b66e0d.addEventListener('click', function(event) {
      window.open('https://instagram.com/santopadre.ve', '_blank')
    });
  }
  const el_evt_f24e45 = document.getElementById('evt-f24e45');
  if (el_evt_f24e45) {
    el_evt_f24e45.addEventListener('click', function(event) {
      toggleDetails('igstory-details')
    });
  }
  const el_evt_f6f272 = document.getElementById('evt-f6f272');
  if (el_evt_f6f272) {
    el_evt_f6f272.addEventListener('click', function(event) {
      window.open('https://instagram.com/santopadre.ve', '_blank')
    });
  }
  const el_claim_igstory_btn = document.getElementById('claim-igstory-btn');
  if (el_claim_igstory_btn) {
    el_claim_igstory_btn.addEventListener('click', function(event) {
      window.showIgStoryForm()
    });
  }
  const el_submit_igstory_btn = document.getElementById('submit-igstory-btn');
  if (el_submit_igstory_btn) {
    el_submit_igstory_btn.addEventListener('click', function(event) {
      window.submitIgStoryVerification()
    });
  }
  const el_evt_69ef69 = document.getElementById('evt-69ef69');
  if (el_evt_69ef69) {
    el_evt_69ef69.addEventListener('click', function(event) {
      toggleDetails('igpost-details')
    });
  }
  const el_claim_igpost_btn = document.getElementById('claim-igpost-btn');
  if (el_claim_igpost_btn) {
    el_claim_igpost_btn.addEventListener('click', function(event) {
      window.showIgPostForm()
    });
  }
  const el_submit_igpost_btn = document.getElementById('submit-igpost-btn');
  if (el_submit_igpost_btn) {
    el_submit_igpost_btn.addEventListener('click', function(event) {
      window.submitIgPostVerification()
    });
  }
  const el_evt_1383c3 = document.getElementById('evt-1383c3');
  if (el_evt_1383c3) {
    el_evt_1383c3.addEventListener('click', function(event) {
      toggleDetails('tiktok-details')
    });
  }
  const el_claim_tiktok_btn = document.getElementById('claim-tiktok-btn');
  if (el_claim_tiktok_btn) {
    el_claim_tiktok_btn.addEventListener('click', function(event) {
      window.showTikTokForm()
    });
  }
  const el_submit_tiktok_btn = document.getElementById('submit-tiktok-btn');
  if (el_submit_tiktok_btn) {
    el_submit_tiktok_btn.addEventListener('click', function(event) {
      window.submitTikTokVerification()
    });
  }
  const el_evt_996afa = document.getElementById('evt-996afa');
  if (el_evt_996afa) {
    el_evt_996afa.addEventListener('click', function(event) {
      toggleDetails('invite-details')
    });
  }
  const el_evt_56b8ae = document.getElementById('evt-56b8ae');
  if (el_evt_56b8ae) {
    el_evt_56b8ae.addEventListener('click', function(event) {
      switchTopTab('referidos')
    });
  }
  const el_evt_a34219 = document.getElementById('evt-a34219');
  if (el_evt_a34219) {
    el_evt_a34219.addEventListener('click', function(event) {
      redeemReward('bebida', 1000)
    });
  }
  const el_evt_21979b = document.getElementById('evt-21979b');
  if (el_evt_21979b) {
    el_evt_21979b.addEventListener('click', function(event) {
      redeemReward('tacos-pastor', 2800)
    });
  }
  const el_evt_424e6c = document.getElementById('evt-424e6c');
  if (el_evt_424e6c) {
    el_evt_424e6c.addEventListener('click', function(event) {
      redeemReward('nachos', 3500)
    });
  }
  const el_evt_4c0200 = document.getElementById('evt-4c0200');
  if (el_evt_4c0200) {
    el_evt_4c0200.addEventListener('click', function(event) {
      redeemReward('birria-ramen', 6500)
    });
  }
  const el_evt_6a1862 = document.getElementById('evt-6a1862');
  if (el_evt_6a1862) {
    el_evt_6a1862.addEventListener('click', function(event) {
      redeemReward('tacos-birria', 6500)
    });
  }
  const el_evt_47242f = document.getElementById('evt-47242f');
  if (el_evt_47242f) {
    el_evt_47242f.addEventListener('click', function(event) {
      redeemReward('burritos', 7200)
    });
  }
  const el_evt_3bace8 = document.getElementById('evt-3bace8');
  if (el_evt_3bace8) {
    el_evt_3bace8.addEventListener('click', function(event) {
      redeemReward('flautas-pollo', 7500)
    });
  }
  const el_evt_f2d4cf = document.getElementById('evt-f2d4cf');
  if (el_evt_f2d4cf) {
    el_evt_f2d4cf.addEventListener('click', function(event) {
      redeemReward('tacos-carne', 8500)
    });
  }
  const el_evt_77c7be = document.getElementById('evt-77c7be');
  if (el_evt_77c7be) {
    el_evt_77c7be.addEventListener('click', function(event) {
      redeemReward('cap-trucker', 9000)
    });
  }
  const el_evt_92844c = document.getElementById('evt-92844c');
  if (el_evt_92844c) {
    el_evt_92844c.addEventListener('click', function(event) {
      redeemReward('tshirt-logo', 12500)
    });
  }
  const el_evt_1416bd = document.getElementById('evt-1416bd');
  if (el_evt_1416bd) {
    el_evt_1416bd.addEventListener('click', function(event) {
      redeemReward('gift-card-25', 12500)
    });
  }
  const el_evt_5e48f4 = document.getElementById('evt-5e48f4');
  if (el_evt_5e48f4) {
    el_evt_5e48f4.addEventListener('click', function(event) {
      redeemReward('gift-card-50', 25000)
    });
  }
  const el_copy_ref_btn_new = document.getElementById('copy-ref-btn-new');
  if (el_copy_ref_btn_new) {
    el_copy_ref_btn_new.addEventListener('click', function(event) {
      window.copyReferralLink()
    });
  }
  const el_evt_85ea40 = document.getElementById('evt-85ea40');
  if (el_evt_85ea40) {
    el_evt_85ea40.addEventListener('click', function(event) {
      alert('Se actualizará automáticamente en tu próxima compra.')
    });
  }
  const el_add_funds_content = document.getElementById('add-funds-content');
  if (el_add_funds_content) {
    el_add_funds_content.addEventListener('click', function(event) {
      event.stopPropagation();
    });
  }
  const el_evt_71acb6 = document.getElementById('evt-71acb6');
  if (el_evt_71acb6) {
    el_evt_71acb6.addEventListener('click', function(event) {
      document.getElementById('add-funds-amount').value='10.00'; updateEstimatedPadre();
    });
  }
  const el_evt_d8341f = document.getElementById('evt-d8341f');
  if (el_evt_d8341f) {
    el_evt_d8341f.addEventListener('click', function(event) {
      document.getElementById('add-funds-amount').value='20.00'; updateEstimatedPadre();
    });
  }
  const el_evt_818b45 = document.getElementById('evt-818b45');
  if (el_evt_818b45) {
    el_evt_818b45.addEventListener('click', function(event) {
      document.getElementById('add-funds-amount').value='50.00'; updateEstimatedPadre();
    });
  }
  const el_evt_24315c = document.getElementById('evt-24315c');
  if (el_evt_24315c) {
    el_evt_24315c.addEventListener('click', function(event) {
      selectPaymentMethod('efectivo')
    });
  }
  const el_evt_b7abea = document.getElementById('evt-b7abea');
  if (el_evt_b7abea) {
    el_evt_b7abea.addEventListener('click', function(event) {
      selectPaymentMethod('pago-movil')
    });
  }
  const el_evt_ce3a0c = document.getElementById('evt-ce3a0c');
  if (el_evt_ce3a0c) {
    el_evt_ce3a0c.addEventListener('click', function(event) {
      selectPaymentMethod('zelle')
    });
  }
  const el_evt_9f5eb8 = document.getElementById('evt-9f5eb8');
  if (el_evt_9f5eb8) {
    el_evt_9f5eb8.addEventListener('click', function(event) {
      selectPaymentMethod('phantom')
    });
  }
  const el_evt_20419c = document.getElementById('evt-20419c');
  if (el_evt_20419c) {
    el_evt_20419c.addEventListener('click', function(event) {
      copyToClipboard(window.PAYMENT_INFO.bank, this)
    });
  }
  const el_evt_6cb266 = document.getElementById('evt-6cb266');
  if (el_evt_6cb266) {
    el_evt_6cb266.addEventListener('click', function(event) {
      copyToClipboard(window.PAYMENT_INFO.ci, this)
    });
  }
  const el_evt_0c1e15 = document.getElementById('evt-0c1e15');
  if (el_evt_0c1e15) {
    el_evt_0c1e15.addEventListener('click', function(event) {
      copyToClipboard(window.PAYMENT_INFO.phone, this)
    });
  }
  const el_evt_be57b9 = document.getElementById('evt-be57b9');
  if (el_evt_be57b9) {
    el_evt_be57b9.addEventListener('click', function(event) {
      copyToClipboard(window.PAYMENT_INFO.email, this)
    });
  }
  const el_evt_78fa7a = document.getElementById('evt-78fa7a');
  if (el_evt_78fa7a) {
    el_evt_78fa7a.addEventListener('click', function(event) {
      copyToClipboard(window.PAYMENT_INFO.solanaWallet, this)
    });
  }
  const el_modal_submit_whatsapp = document.getElementById('modal-submit-whatsapp');
  if (el_modal_submit_whatsapp) {
    el_modal_submit_whatsapp.addEventListener('click', function(event) {
      submitDepositWhatsApp()
    });
  }
  const el_modal_submit_phantom = document.getElementById('modal-submit-phantom');
  if (el_modal_submit_phantom) {
    el_modal_submit_phantom.addEventListener('click', function(event) {
      payWithPhantomModalDirect()
    });
  }
  const el_evt_8c0de0 = document.getElementById('evt-8c0de0');
  if (el_evt_8c0de0) {
    el_evt_8c0de0.addEventListener('click', function(event) {
      window.location.href='https://www.santopadre.store'
    });
  }
  const el_evt_1e7b3e = document.getElementById('evt-1e7b3e');
  if (el_evt_1e7b3e) {
    el_evt_1e7b3e.addEventListener('click', function(event) {
      toggleMobileMenu()
    });
  }
  const el_evt_ca9dad = document.getElementById('evt-ca9dad');
  if (el_evt_ca9dad) {
    el_evt_ca9dad.addEventListener('click', function(event) {
      window.location.href='index.html'
    });
  }
  const el_evt_f0f3fc = document.getElementById('evt-f0f3fc');
  if (el_evt_f0f3fc) {
    el_evt_f0f3fc.addEventListener('click', function(event) {
      connectSimulatedWallet()
    });
  }
  const el_evt_72d39d = document.getElementById('evt-72d39d');
  if (el_evt_72d39d) {
    el_evt_72d39d.addEventListener('click', function(event) {
      copyWalletAddress()
    });
  }
  const el_evt_c7744b = document.getElementById('evt-c7744b');
  if (el_evt_c7744b) {
    el_evt_c7744b.addEventListener('click', function(event) {
      window.claimPendingReward()
    });
  }
  const el_evt_d71a28 = document.getElementById('evt-d71a28');
  if (el_evt_d71a28) {
    el_evt_d71a28.addEventListener('click', function(event) {
      window.downloadPasskitMock('apple'); return false;
    });
  }
  const el_evt_c9aaaa = document.getElementById('evt-c9aaaa');
  if (el_evt_c9aaaa) {
    el_evt_c9aaaa.addEventListener('click', function(event) {
      window.downloadPasskitMock('google'); return false;
    });
  }
  const el_evt_09a9b3 = document.getElementById('evt-09a9b3');
  if (el_evt_09a9b3) {
    el_evt_09a9b3.addEventListener('click', function(event) {
      window.location.href='index.html'
    });
  }
  const el_evt_399573 = document.getElementById('evt-399573');
  if (el_evt_399573) {
    el_evt_399573.addEventListener('click', function(event) {
      toggleDetails('birthday-details')
    });
  }
  const el_evt_7ab230 = document.getElementById('evt-7ab230');
  if (el_evt_7ab230) {
    el_evt_7ab230.addEventListener('click', function(event) {
      toggleDetails('review-details')
    });
  }
  const el_evt_58d941 = document.getElementById('evt-58d941');
  if (el_evt_58d941) {
    el_evt_58d941.addEventListener('click', function(event) {
      window.trackReviewClick(); window.open('https://g.page/r/CRyfApltCzMbEAE/review', '_blank')
    });
  }
  const el_evt_ce2f01 = document.getElementById('evt-ce2f01');
  if (el_evt_ce2f01) {
    el_evt_ce2f01.addEventListener('click', function(event) {
      toggleDetails('instagram-details')
    });
  }
  const el_evt_9dad6a = document.getElementById('evt-9dad6a');
  if (el_evt_9dad6a) {
    el_evt_9dad6a.addEventListener('click', function(event) {
      window.open('https://instagram.com/santopadre.ve', '_blank')
    });
  }
  const el_evt_227d7b = document.getElementById('evt-227d7b');
  if (el_evt_227d7b) {
    el_evt_227d7b.addEventListener('click', function(event) {
      toggleDetails('igstory-details')
    });
  }
  const el_evt_73f1bb = document.getElementById('evt-73f1bb');
  if (el_evt_73f1bb) {
    el_evt_73f1bb.addEventListener('click', function(event) {
      window.open('https://instagram.com/santopadre.ve', '_blank')
    });
  }
  const el_evt_21588d = document.getElementById('evt-21588d');
  if (el_evt_21588d) {
    el_evt_21588d.addEventListener('click', function(event) {
      toggleDetails('igpost-details')
    });
  }
  const el_evt_75e8ea = document.getElementById('evt-75e8ea');
  if (el_evt_75e8ea) {
    el_evt_75e8ea.addEventListener('click', function(event) {
      toggleDetails('tiktok-details')
    });
  }
  const el_evt_92b742 = document.getElementById('evt-92b742');
  if (el_evt_92b742) {
    el_evt_92b742.addEventListener('click', function(event) {
      toggleDetails('invite-details')
    });
  }
  const el_evt_1f9468 = document.getElementById('evt-1f9468');
  if (el_evt_1f9468) {
    el_evt_1f9468.addEventListener('click', function(event) {
      switchTopTab('referidos')
    });
  }
  const el_evt_501338 = document.getElementById('evt-501338');
  if (el_evt_501338) {
    el_evt_501338.addEventListener('click', function(event) {
      redeemReward('bebida', 1000)
    });
  }
  const el_evt_4ef323 = document.getElementById('evt-4ef323');
  if (el_evt_4ef323) {
    el_evt_4ef323.addEventListener('click', function(event) {
      redeemReward('tacos-pastor', 2800)
    });
  }
  const el_evt_5f0fbc = document.getElementById('evt-5f0fbc');
  if (el_evt_5f0fbc) {
    el_evt_5f0fbc.addEventListener('click', function(event) {
      redeemReward('nachos', 3500)
    });
  }
  const el_evt_ff560e = document.getElementById('evt-ff560e');
  if (el_evt_ff560e) {
    el_evt_ff560e.addEventListener('click', function(event) {
      redeemReward('birria-ramen', 6500)
    });
  }
  const el_evt_89cdf6 = document.getElementById('evt-89cdf6');
  if (el_evt_89cdf6) {
    el_evt_89cdf6.addEventListener('click', function(event) {
      redeemReward('tacos-birria', 6500)
    });
  }
  const el_evt_e6e267 = document.getElementById('evt-e6e267');
  if (el_evt_e6e267) {
    el_evt_e6e267.addEventListener('click', function(event) {
      redeemReward('burritos', 7200)
    });
  }
  const el_evt_2c5cb6 = document.getElementById('evt-2c5cb6');
  if (el_evt_2c5cb6) {
    el_evt_2c5cb6.addEventListener('click', function(event) {
      redeemReward('flautas-pollo', 7500)
    });
  }
  const el_evt_8bd837 = document.getElementById('evt-8bd837');
  if (el_evt_8bd837) {
    el_evt_8bd837.addEventListener('click', function(event) {
      redeemReward('tacos-carne', 8500)
    });
  }
  const el_evt_6425f2 = document.getElementById('evt-6425f2');
  if (el_evt_6425f2) {
    el_evt_6425f2.addEventListener('click', function(event) {
      redeemReward('cap-trucker', 9000)
    });
  }
  const el_evt_ee13ad = document.getElementById('evt-ee13ad');
  if (el_evt_ee13ad) {
    el_evt_ee13ad.addEventListener('click', function(event) {
      redeemReward('tshirt-logo', 12500)
    });
  }
  const el_evt_70ff8a = document.getElementById('evt-70ff8a');
  if (el_evt_70ff8a) {
    el_evt_70ff8a.addEventListener('click', function(event) {
      redeemReward('gift-card-25', 12500)
    });
  }
  const el_evt_96e530 = document.getElementById('evt-96e530');
  if (el_evt_96e530) {
    el_evt_96e530.addEventListener('click', function(event) {
      redeemReward('gift-card-50', 25000)
    });
  }
  const el_evt_44178d = document.getElementById('evt-44178d');
  if (el_evt_44178d) {
    el_evt_44178d.addEventListener('click', function(event) {
      alert('Se actualizará automáticamente en tu próxima compra.')
    });
  }
  const el_evt_1433a6 = document.getElementById('evt-1433a6');
  if (el_evt_1433a6) {
    el_evt_1433a6.addEventListener('click', function(event) {
      document.getElementById('add-funds-amount').value='10.00'; updateEstimatedPadre();
    });
  }
  const el_evt_187cb0 = document.getElementById('evt-187cb0');
  if (el_evt_187cb0) {
    el_evt_187cb0.addEventListener('click', function(event) {
      document.getElementById('add-funds-amount').value='20.00'; updateEstimatedPadre();
    });
  }
  const el_evt_214ec2 = document.getElementById('evt-214ec2');
  if (el_evt_214ec2) {
    el_evt_214ec2.addEventListener('click', function(event) {
      document.getElementById('add-funds-amount').value='50.00'; updateEstimatedPadre();
    });
  }
  const el_evt_8679d8 = document.getElementById('evt-8679d8');
  if (el_evt_8679d8) {
    el_evt_8679d8.addEventListener('click', function(event) {
      selectPaymentMethod('efectivo')
    });
  }
  const el_evt_17de8e = document.getElementById('evt-17de8e');
  if (el_evt_17de8e) {
    el_evt_17de8e.addEventListener('click', function(event) {
      selectPaymentMethod('pago-movil')
    });
  }
  const el_evt_784cee = document.getElementById('evt-784cee');
  if (el_evt_784cee) {
    el_evt_784cee.addEventListener('click', function(event) {
      selectPaymentMethod('zelle')
    });
  }
  const el_evt_291d79 = document.getElementById('evt-291d79');
  if (el_evt_291d79) {
    el_evt_291d79.addEventListener('click', function(event) {
      selectPaymentMethod('phantom')
    });
  }
  const el_evt_8b2f0b = document.getElementById('evt-8b2f0b');
  if (el_evt_8b2f0b) {
    el_evt_8b2f0b.addEventListener('click', function(event) {
      copyToClipboard(window.PAYMENT_INFO.bank, this)
    });
  }
  const el_evt_bbbe30 = document.getElementById('evt-bbbe30');
  if (el_evt_bbbe30) {
    el_evt_bbbe30.addEventListener('click', function(event) {
      copyToClipboard(window.PAYMENT_INFO.ci, this)
    });
  }
  const el_evt_4d0f7d = document.getElementById('evt-4d0f7d');
  if (el_evt_4d0f7d) {
    el_evt_4d0f7d.addEventListener('click', function(event) {
      copyToClipboard(window.PAYMENT_INFO.phone, this)
    });
  }
  const el_evt_61a26e = document.getElementById('evt-61a26e');
  if (el_evt_61a26e) {
    el_evt_61a26e.addEventListener('click', function(event) {
      copyToClipboard(window.PAYMENT_INFO.email, this)
    });
  }
  const el_evt_b274a6 = document.getElementById('evt-b274a6');
  if (el_evt_b274a6) {
    el_evt_b274a6.addEventListener('click', function(event) {
      copyToClipboard(window.PAYMENT_INFO.solanaWallet, this)
    });
  }
});
