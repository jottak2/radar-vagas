import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

(function () {
  var holder = document.getElementById('hero-photo');
  var hero = document.getElementById('hero');
  if (!holder || !hero) return;
  var url = holder.getAttribute('data-model');
  var reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { holder.classList.add('sem-3d'); return; }
  var mobile = window.matchMedia('(max-width: 760px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  holder.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  // luzes de recorte nas cores do site
  var key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(4, 6, 5); scene.add(key);
  var rosa = new THREE.PointLight(0xf070f0, 40, 0, 2); rosa.position.set(-4, 1.6, -2); scene.add(rosa);
  var azul = new THREE.PointLight(0x5b57ff, 34, 0, 2); azul.position.set(4.5, 1.2, -3); scene.add(azul);
  scene.add(new THREE.HemisphereLight(0xb9a6ff, 0x150a20, 0.5));

  // sombra de contato (gradiente radial)
  var sc = document.createElement('canvas'); sc.width = sc.height = 256;
  var g = sc.getContext('2d'); var grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  var sombra = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2;

  var palco = new THREE.Group(); scene.add(palco);
  var carro = new THREE.Group(); palco.add(carro); palco.add(sombra);

  function tamanho() {
    var w = holder.clientWidth, h = holder.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // enquadra: em tela larga o carro ocupa ~60% da largura
    camera.position.set(0, 1.15, w / h > 1 ? 9 : 11.8);
    camera.lookAt(0, 0.45, 0);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', tamanho); tamanho();

  var pronto = false, inicio = 0;
  // personagem: corre, pula o carro, tropeça e cai (animações "Jumping" e "Soccer Trip" do Mixamo, roupa roxa)
  var pulo = new THREE.Group(); palco.add(pulo);
  var boneco = null, mixer = null, aPulo = null, aTrop = null, durPulo = 1, durTrop = 1, ultimoT = 0, eixoLongoX = true;
  var meioPulo = 1.6, offTrop = new THREE.Vector3(), estado = 'pulo', tEst = 0, mats = [];
  var ESC_BONECO = 0.009, ALTURA_ARCO = 1.5, VEL = 0.85, ENCURTA_QUEDA = 0.4, DESVIO = 0.45, CAIDO = 1.3, SOME = 0.5, APARECE = 0.3;
  function posicionaPulo() {
    // a pista atravessa o carro pela largura
    pulo.rotation.y = (eixoLongoX ? 0 : Math.PI / 2) + DESVIO;
  }
  var urlBoneco = holder.getAttribute('data-personagem');
  var loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(url, function (gltf) {
    var m = gltf.scene;
    var box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    var esc = 4.6 / Math.max(size.x, size.z); // ~4,6 m de comprimento na cena
    m.scale.setScalar(esc);
    m.position.set(-c.x * esc, -box.min.y * esc, -c.z * esc);
    // deixa o comprimento no eixo X
    eixoLongoX = size.x >= size.z;
    carro.add(m);
    var L = Math.max(size.x, size.z) * esc, W = Math.min(size.x, size.z) * esc;
    sombra.scale.set(size.z > size.x ? W * 1.7 : L * 1.25, size.z > size.x ? L * 1.25 : W * 1.7, 1);
    sombra.position.y = 0.01;
    m.traverse(function (o) { if (o.isMesh && o.material) { o.material.envMapIntensity = 1.2; } });
    posicionaPulo();
    if (urlBoneco) carregaBoneco();
    pronto = true; inicio = performance.now();
    holder.classList.add('carregado');
    pedir();
  }, undefined, function () { holder.classList.add('sem-3d'); });

  function quadril(clip) { return clip.tracks.filter(function (tr) { return /Hips\.position$/.test(tr.name); })[0]; }
  function carregaBoneco() {
    loader.load(urlBoneco, function (g2) {
      boneco = g2.scene; boneco.scale.setScalar(ESC_BONECO);
      boneco.traverse(function (o) {
        if (o.isMesh) { o.frustumCulled = false; if (o.material) { o.material.envMapIntensity = 0.8; o.material.userData.transpOriginal = o.material.transparent; mats.push(o.material); } }
      });
      var cPulo = g2.animations.filter(function (c) { return c.name === 'pulo'; })[0] || g2.animations[0];
      var cTrop = g2.animations.filter(function (c) { return c.name === 'tropeco'; })[0];
      durPulo = cPulo.duration;
      var hp = quadril(cPulo), v = hp.values, n = v.length;
      meioPulo = (v[2] + v[n - 1]) / 2 * ESC_BONECO;
      mixer = new THREE.AnimationMixer(boneco);
      aPulo = mixer.clipAction(cPulo); aPulo.play(); aPulo.paused = true;
      if (cTrop) {
        durTrop = cTrop.duration;
        var ht = quadril(cTrop), w = ht.values, z0 = w[2];
        // a queda escorrega menos para ele não sair do quadro
        for (var i = 2; i < w.length; i += 3) w[i] = z0 + (w[i] - z0) * ENCURTA_QUEDA;
        // emenda: o quadril começa o tropeço onde terminou o pulo
        offTrop.set((v[n - 3] - w[0]) * ESC_BONECO, 0, (v[n - 1] - w[2]) * ESC_BONECO);
        aTrop = mixer.clipAction(cTrop); aTrop.play(); aTrop.paused = true; aTrop.setEffectiveWeight(0);
      }
      pulo.add(boneco);
      if (reduz) { aPulo.time = durPulo * 0.55; }
      pedir();
    });
  }
  function usa(acao) {
    aPulo.setEffectiveWeight(acao === aPulo ? 1 : 0);
    if (aTrop) aTrop.setEffectiveWeight(acao === aTrop ? 1 : 0);
  }
  function opacidade(op) {
    for (var k = 0; k < mats.length; k++) {
      var mt = mats[k], tr = op < 0.999 || !!mt.userData.transpOriginal; // olhos, boca e sobrancelhas usam transparência sempre
      if (mt.transparent !== tr) { mt.transparent = tr; mt.needsUpdate = true; }
      mt.opacity = op;
    }
    boneco.visible = op > 0.01;
  }
  function atualizaPulo(t) {
    if (!mixer) return;
    var dt = Math.min(0.05, Math.max(0, (t - (ultimoT || t)) / 1000)); ultimoT = t;
    if (reduz) { usa(aPulo); boneco.position.set(0, 0, -meioPulo); mixer.update(0); opacidade(1); return; }
    tEst += dt * VEL;
    var y = 0, op = 1;
    if (estado === 'pulo') {
      if (tEst >= durPulo) { if (aTrop) { estado = 'tropeco'; tEst = 0; } else { estado = 'caido'; tEst = 0; } }
    } else if (estado === 'tropeco') {
      if (tEst >= durTrop) { estado = 'caido'; tEst = 0; }
    } else if (estado === 'caido') {
      if (tEst >= CAIDO + SOME) { estado = 'pulo'; tEst = 0; }
    }
    if (estado === 'pulo') {
      usa(aPulo); aPulo.time = Math.min(tEst, durPulo - 1e-4);
      boneco.position.set(0, 0, -meioPulo);
      var u = clamp((aPulo.time / durPulo - 0.12) / (0.93 - 0.12));
      // arco de topo achatado: passa alto sobre o teto do carro
      y = ALTURA_ARCO * Math.pow(Math.sin(Math.PI * u), 0.55);
      op = clamp(tEst / APARECE);
    } else {
      var acaoFim = aTrop || aPulo;
      usa(acaoFim);
      acaoFim.time = estado === 'tropeco' ? tEst : (aTrop ? durTrop : durPulo) - 1e-4;
      boneco.position.set(aTrop ? offTrop.x : 0, 0, -meioPulo + (aTrop ? offTrop.z : 0));
      if (estado === 'caido') op = 1 - clamp((tEst - CAIDO) / SOME);
    }
    mixer.update(0);
    boneco.position.y = y;
    opacidade(op);
  }

  var mx = 0, my = 0, tx = 0, ty = 0;
  window.addEventListener('pointermove', function (e) {
    tx = (e.clientX / window.innerWidth - 0.5); ty = (e.clientY / window.innerHeight - 0.5); pedir();
  }, { passive: true });

  var visivel = true;
  new IntersectionObserver(function (es) { visivel = es[0].isIntersecting; if (visivel) pedir(); }).observe(hero);

  var clamp = function (x) { return Math.max(0, Math.min(1, x)); };
  var easeOut = function (x) { return 1 - Math.pow(1 - x, 4); };
  var rodando = false;
  function pedir() { if (!rodando) { rodando = true; requestAnimationFrame(quadro); } }

  function quadro(t) {
    rodando = false;
    if (!pronto || !visivel) return;
    var total = hero.offsetHeight - window.innerHeight;
    var p = clamp(-hero.getBoundingClientRect().top / (total || 1));
    // entrada: o carro chega pela direita fazendo a curva
    var e = reduz ? 1 : easeOut(clamp((t - inicio) / 2200));
    var giroInicial = (1 - e) * -1.25;
    var idle = reduz ? 0 : Math.sin(t / 2600) * 0.12;
    mx += (tx - mx) * 0.06; my += (ty - my) * 0.06;
    // 3/4 dianteiro em repouso; ao rolar, o carro gira e mostra a lateral e a traseira
    palco.rotation.y = -0.65 + giroInicial + idle + p * Math.PI * 1.1 + mx * 0.35;
    palco.rotation.x = my * 0.06;
    palco.position.x = (1 - e) * 7;
    palco.position.y = -0.25 + (1 - e) * 0.15;
    var zoom = 1 + p * 0.18;
    palco.scale.setScalar(zoom);
    atualizaPulo(t);
    renderer.render(scene, camera);
    var anima = !reduz && (e < 1 || Math.abs(tx - mx) > 0.001 || Math.abs(ty - my) > 0.001 || true);
    if (anima) pedir();
  }
  window.addEventListener('scroll', pedir, { passive: true });
})();
