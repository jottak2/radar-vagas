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
  // personagem que pula o carro (animação "Jumping" do Mixamo, roupa roxa)
  var pulo = new THREE.Group(); palco.add(pulo);
  var boneco = null, mixer = null, acao = null, duracao = 1, sentido = 0, pausa = 0, ultimoT = 0, eixoLongoX = true, meioPulo = 1.6;
  var ESC_BONECO = 0.009, ALTURA_ARCO = 1.5, VEL = 0.85, DESCANSO = 0.9;
  var urlBoneco = holder.getAttribute('data-personagem');
  function posicionaPulo() {
    // o personagem anda no seu +Z: atravessa o carro pela largura
    pulo.rotation.y = (eixoLongoX ? 0 : Math.PI / 2) + sentido * Math.PI;
  }
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

  function carregaBoneco() {
    loader.load(urlBoneco, function (g2) {
      boneco = g2.scene; boneco.scale.setScalar(ESC_BONECO);
      boneco.traverse(function (o) { if (o.isMesh) { o.frustumCulled = false; if (o.material) o.material.envMapIntensity = 0.8; } });
      var clip = g2.animations[0];
      mixer = new THREE.AnimationMixer(boneco);
      acao = mixer.clipAction(clip); acao.setLoop(THREE.LoopOnce); acao.clampWhenFinished = true;
      duracao = clip.duration;
      // o quadril anda ~3,5 m no clipe: centraliza o pulo no meio do carro
      var hp = clip.tracks.filter(function (tr) { return /Hips\.position$/.test(tr.name); })[0];
      if (hp) { var v = hp.values; meioPulo = (v[2] + v[v.length - 1]) / 2 * ESC_BONECO; }
      boneco.position.z = -meioPulo;
      pulo.add(boneco);
      acao.play(); acao.paused = !!reduz;
      if (reduz) { mixer.setTime(0); }
      pedir();
    });
  }
  function atualizaPulo(t) {
    if (!mixer) return;
    var dt = Math.min(0.05, Math.max(0, (t - (ultimoT || t)) / 1000)); ultimoT = t;
    if (reduz) { mixer.update(0); pulo.position.y = 0; return; }
    if (pausa > 0) {
      pausa -= dt;
      if (pausa <= 0) { sentido = 1 - sentido; posicionaPulo(); acao.reset().play(); }
    } else {
      mixer.update(dt * VEL);
      if (acao.time >= duracao - 1e-3) pausa = DESCANSO;
    }
    // arco extra para passar por cima do teto do carro
    var u = clamp((acao.time / duracao - 0.12) / (0.93 - 0.12));
    // arco de topo achatado: sobe rápido, fica alto sobre o teto e desce no fim
    pulo.position.y = ALTURA_ARCO * Math.pow(Math.sin(Math.PI * u), 0.55);
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
