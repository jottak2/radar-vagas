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
    camera.position.set(0, 1.1, w / h > 1 ? 7.4 : 10);
    camera.lookAt(0, 0.45, 0);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', tamanho); tamanho();

  var pronto = false, inicio = 0;
  // personagem: corre, pula o carro, tropeça e cai (animações "Jumping" e "Soccer Trip" do Mixamo, roupa roxa)
  var pulo = new THREE.Group(); palco.add(pulo);
  var boneco = null, mixer = null, aPulo = null, aTrop = null, durPulo = 1, durTrop = 1, ultimoT = 0, eixoLongoX = true;
  var meioPulo = 1.6, offTrop = new THREE.Vector3(), estado = 'pulo', tEst = 0, mats = [];
  var ESC_BONECO = 0.009, ALTURA_ARCO = 1.5, VEL = 0.85, ENCURTA_QUEDA = 0.4, DESVIO = 0.45, CAIDO = 0.35, SOME = 0.5, APARECE = 0.3, VOO = 0.75, RACHADO = 1.6;
  var quadrilOsso = null, vooIni = new THREE.Vector3(), vooFim = new THREE.Vector3(), tmp = new THREE.Vector3(), pausaPos = 0;
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
      quadrilOsso = boneco.getObjectByName('mixamorigHips') || null;
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
  function iniciaVoo() {
    (quadrilOsso || boneco).getWorldPosition(vooIni); vooIni.y += 0.2;
    // ponto logo à frente da lente, um pouco abaixo do centro
    camera.getWorldPosition(vooFim);
    tmp.set(0, 0.04, -1).applyQuaternion(camera.quaternion);
    vooFim.addScaledVector(tmp, 1.05);
  }
  // camada do impacto: clarão, vidro rachado e estilhaços roxos sobre a capa
  var camada = null, ctxC = null;
  function preparaCamada() {
    if (camada) return;
    camada = document.createElement('canvas'); camada.className = 'impacto'; camada.setAttribute('aria-hidden', 'true');
    (holder.parentNode || hero).appendChild(camada); ctxC = camada.getContext('2d');
  }
  function impacto() {
    preparaCamada();
    var r = camada.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    camada.width = r.width * dpr; camada.height = r.height * dpr;
    tmp.copy(vooFim).project(camera);
    var hr = holder.getBoundingClientRect();
    var cx = (hr.left - r.left + (tmp.x + 1) / 2 * hr.width) * dpr, cy = (hr.top - r.top + (1 - tmp.y) / 2 * hr.height) * dpr;
    var R = Math.max(camada.width, camada.height);
    var c = ctxC; c.clearRect(0, 0, camada.width, camada.height);
    // rachaduras radiais e anéis
    var raios = [], n = 14 + Math.floor(Math.random() * 6);
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 + (Math.random() - 0.5) * 0.35, pts = [[cx, cy]], x = cx, y = cy, len = R * (0.35 + Math.random() * 0.5);
      for (var d = 0; d < len; d += 28 * dpr) { a += (Math.random() - 0.5) * 0.18; x += Math.cos(a) * 28 * dpr; y += Math.sin(a) * 28 * dpr; pts.push([x, y]); }
      raios.push(pts);
    }
    c.lineCap = 'round'; c.lineJoin = 'round';
    function traco(lw, cor) {
      c.strokeStyle = cor; c.lineWidth = lw;
      raios.forEach(function (pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var j = 1; j < pts.length; j++) c.lineTo(pts[j][0], pts[j][1]); c.stroke(); });
      [0.06, 0.13, 0.22].forEach(function (f) {
        c.beginPath();
        raios.forEach(function (pts, ii) { var p = pts[Math.min(pts.length - 1, Math.round(pts.length * f * (0.8 + (ii % 3) * 0.15)))]; if (ii === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]); });
        c.closePath(); c.stroke();
      });
    }
    traco(4 * dpr, 'rgba(240,112,240,.35)');
    traco(1.4 * dpr, 'rgba(255,255,255,.9)');
    var g = c.createRadialGradient(cx, cy, 0, cx, cy, 90 * dpr);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.4, 'rgba(240,112,240,.5)'); g.addColorStop(1, 'rgba(200,38,216,0)');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 90 * dpr, 0, Math.PI * 2); c.fill();
    camada.classList.remove('ativa'); void camada.offsetWidth; camada.classList.add('ativa');
    hero.classList.remove('tremendo'); void hero.offsetWidth; hero.classList.add('tremendo');
    estilhacos(cx / dpr + r.left, cy / dpr + r.top);
  }
  function estilhacos(x, y) {
    var cores = ['#c826d8', '#f070f0', '#8a2be2', '#ffffff', '#5b57ff'];
    var box = document.createElement('div'); box.className = 'estilhacos'; box.setAttribute('aria-hidden', 'true');
    box.style.left = x + 'px'; box.style.top = y + 'px';
    for (var i = 0; i < 42; i++) {
      var p = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 520, s = 6 + Math.random() * 22;
      p.style.width = s + 'px'; p.style.height = s * (0.4 + Math.random()) + 'px';
      p.style.background = cores[i % cores.length];
      p.style.setProperty('--dx', Math.cos(a) * d + 'px'); p.style.setProperty('--dy', Math.sin(a) * d + 'px');
      p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDelay = Math.random() * 60 + 'ms';
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 1600);
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
      if (tEst >= CAIDO) { iniciaVoo(); estado = 'voo'; tEst = 0; }
    } else if (estado === 'voo') {
      if (tEst >= VOO) { estado = 'rachado'; tEst = 0; impacto(); }
    } else if (estado === 'rachado') {
      if (tEst >= RACHADO) { estado = 'pulo'; tEst = 0; boneco.rotation.set(0, 0, 0); }
    }
    if (estado === 'pulo') {
      usa(aPulo); aPulo.time = Math.min(tEst, durPulo - 1e-4);
      boneco.position.set(0, 0, -meioPulo);
      var u = clamp((aPulo.time / durPulo - 0.12) / (0.93 - 0.12));
      // arco de topo achatado: passa alto sobre o teto do carro
      y = ALTURA_ARCO * Math.pow(Math.sin(Math.PI * u), 0.55);
      op = clamp(tEst / APARECE);
    } else if (estado === 'voo' || estado === 'rachado') {
      // voa na direção de quem está vendo, girando, e bate na lente
      var acaoV = aTrop || aPulo; usa(acaoV);
      acaoV.time = (aTrop ? durTrop : durPulo) * 0.42; // pose de mergulho, braços à frente
      var k = clamp(tEst / VOO), ke = k * k * (1.6 - 0.6 * k);
      var alvo = new THREE.Vector3().lerpVectors(vooIni, vooFim, ke); alvo.y += Math.sin(Math.PI * k) * 0.9;
      mixer.update(0);
      camera.getWorldPosition(tmp); boneco.lookAt(tmp);
      boneco.rotateZ(k * 5.5); boneco.rotateX(-0.25);
      // o quadril (centro do corpo) é que segue a trajetória até a lente
      boneco.updateMatrixWorld(true);
      var hb = quadrilOsso || boneco, hw = new THREE.Vector3(), bw = new THREE.Vector3();
      hb.getWorldPosition(hw); boneco.getWorldPosition(bw);
      alvo.sub(hw.sub(bw)); pulo.worldToLocal(alvo); boneco.position.copy(alvo);
      if (estado === 'rachado') op = 0;
      opacidade(op); return;
    } else {
      var acaoFim = aTrop || aPulo;
      usa(acaoFim);
      acaoFim.time = estado === 'tropeco' ? tEst : (aTrop ? durTrop : durPulo) - 1e-4;
      boneco.position.set(aTrop ? offTrop.x : 0, 0, -meioPulo + (aTrop ? offTrop.z : 0));
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
