/* Capa em camadas: fundo, nome e jogador se movem em velocidades diferentes com o mouse e a rolagem. */
(function () {
  var hero = document.getElementById('hero');
  var fundo = document.getElementById('capa-fundo');
  var jogador = document.getElementById('hero-photo');
  if (!hero || !fundo || !jogador) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var imgJ = jogador.querySelector('img'), wm = document.getElementById('wordmark');
  var tx = 0, ty = 0, mx = 0, my = 0, rodando = false;
  window.addEventListener('pointermove', function (e) {
    tx = e.clientX / window.innerWidth - 0.5; ty = e.clientY / window.innerHeight - 0.5; pedir();
  }, { passive: true });
  window.addEventListener('scroll', pedir, { passive: true });
  function pedir() { if (!rodando) { rodando = true; requestAnimationFrame(quadro); } }
  function quadro() {
    rodando = false;
    mx += (tx - mx) * 0.08; my += (ty - my) * 0.08;
    var total = hero.offsetHeight - window.innerHeight;
    var p = Math.max(0, Math.min(1, -hero.getBoundingClientRect().top / (total || 1)));
    // fundo: mexe pouco e devagar (longe); jogador: mexe mais (perto); o nome fica no meio
    fundo.style.transform = 'translate3d(' + (-mx * 18) + 'px,' + (-my * 12 + p * 60) + 'px,0) scale(' + (1 + p * 0.08) + ')';
    imgJ.style.translate = (mx * 34) + 'px ' + (my * 20) + 'px';
    if (wm) wm.style.translate = (mx * -8) + 'px ' + (my * -6) + 'px';
    if (Math.abs(tx - mx) > 0.001 || Math.abs(ty - my) > 0.001) pedir();
  }
  pedir();
})();
