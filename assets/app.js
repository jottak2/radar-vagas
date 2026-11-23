(function () {
  "use strict";

  var data = window.VAGAS_DATA || { vagas: [], atualizadoEm: null, planilhaUrl: "#" };
  var vagas = data.vagas.slice();
  var RANK = { "Alta": 0, "Média": 1, "Baixa": 2 };
  var FEITO = ["Salva", "Candidatado", "Entrevista", "Recusado"];

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var safeUrl = function (u) { return /^https:\/\//.test(u || "") ? u : ""; };
  var ddmm = function (iso) {
    if (!iso) return "";
    var p = iso.slice(0, 10).split("-");
    return p[2] + "/" + p[1];
  };
  var dia = function (iso) { return iso ? new Date(iso.slice(0, 10) + "T12:00:00") : null; };

  // ---- datas e "novas" ----
  var atualizado = data.atualizadoEm ? new Date(data.atualizadoEm) : null;
  var hojeRef = atualizado ? dia(data.atualizadoEm) : new Date();
  var isNova = function (v) {
    var d = dia(v.publicada);
    return d ? (hojeRef - d) / 86400000 <= 1 : false;
  };
  var isDA = function (v) { return /diretor|diretora|art director/i.test(v.vaga + " " + v.tipo); };
  var isRemoto = function (v) { return /remoto|home office/i.test(v.local); };
  var isSP = function (v) { return /^são paulo/i.test(v.local); };

  vagas.sort(function (a, b) {
    var r = (RANK[a.aderencia] ?? 1) - (RANK[b.aderencia] ?? 1);
    if (r) return r;
    return (b.publicada || "").localeCompare(a.publicada || "");
  });

  // ---- cabeçalho / hero ----
  var quando = atualizado
    ? atualizado.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " às " +
      atualizado.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";
  $("nav-data").textContent = "ATUALIZADO " + quando;
  $("foot-data").textContent = "Última atualização: " + quando;
  ["cta-planilha", "cta-planilha-2"].forEach(function (id) { $(id).href = safeUrl(data.planilhaUrl) || "#"; });

  var total = vagas.length;
  var altas = vagas.filter(function (v) { return v.aderencia === "Alta"; }).length;
  var remotas = vagas.filter(isRemoto).length;
  var sp = vagas.filter(isSP).length;
  var novas = vagas.filter(isNova).length;
  var feitas = vagas.filter(function (v) { return FEITO.indexOf(v.status) > -1; }).length;

  var selos = [
    ["", "vagas", total],
    ["quente", "alta aderência", altas],
    ["claro", "novas 24h", novas]
  ];
  $("chips").innerHTML = selos.map(function (c) {
    return '<li class="selo ' + c[0] + '"><small>' + esc(c[1]) + "</small><b>" + esc(c[2]) + "</b></li>";
  }).join("");

  $("offer-de").textContent = remotas + " remotas e " + sp + " em São Paulo.";
  $("offer-num").textContent = altas + " combinam muito com você.";
  $("offer-sub").textContent = "Atualizado " + quando;
  var pct = total ? Math.round((feitas / total) * 100) : 0;
  $("bar-label").textContent = feitas + " de " + total + " já salvas ou candidatadas (" + pct + "%)";
  $("bar-wrap").setAttribute("aria-label", pct + "% das vagas já salvas ou candidatadas");
  requestAnimationFrame(function () { setTimeout(function () { $("bar").style.width = pct + "%"; }, 300); });

  // ---- destaques (cards do carrossel dentro do cartão) ----
  var top = vagas.filter(function (v) { return v.aderencia === "Alta"; }).slice(0, 8);
  $("carrossel-trilho").innerHTML = top.map(function (v, i) {
    var url = safeUrl(v.link);
    return '<article class="vcard">' +
      '<span class="top-n">.' + String(i + 1).padStart(2, "0") + "</span>" +
      "<h3>" + esc(v.vaga) + "</h3>" +
      '<p class="meta">' + esc(v.empresa) + " · " + esc(v.local) + (v.publicada ? " · " + ddmm(v.publicada) : "") + "</p>" +
      (v.obs ? '<p class="obs">' + esc(v.obs) + "</p>" : '<p class="obs"></p>') +
      (url ? '<a class="pill-cta" href="' + esc(url) + '" target="_blank" rel="noopener">Abrir vaga ↗</a>' : "") +
      "</article>";
  }).join("");

  // ---- grade com filtros ----
  var filtro = "todas";
  var termo = "";
  var FILTROS = {
    todas: function () { return true; },
    novas: isNova,
    alta: function (v) { return v.aderencia === "Alta"; },
    da: isDA,
    designer: function (v) { return !isDA(v); },
    sp: isSP,
    remoto: isRemoto,
    pendentes: function (v) { return v.status === "A candidatar"; }
  };

  function card(v) {
    var url = safeUrl(v.link);
    var classe = v.aderencia === "Alta" ? "alta" : v.aderencia === "Baixa" ? "baixa" : "media";
    var feito = FEITO.indexOf(v.status) > -1 && v.status !== "Salva";
    return '<article class="card">' +
      '<div class="card-top"><div class="tags">' +
        '<span class="tag ' + classe + '">' + esc(v.aderencia) + "</span>" +
        (isNova(v) ? '<span class="tag nova">Nova</span>' : "") +
      "</div>" +
      '<span class="status' + (feito ? " feito" : "") + '">' + esc(v.status) + "</span></div>" +
      "<h3>" + esc(v.vaga) + "</h3>" +
      '<p class="empresa">' + esc(v.empresa) + "</p>" +
      '<div class="meta"><span>' + esc(v.local) + "</span>" +
        (v.tipo ? "<span>" + esc(v.tipo) + "</span>" : "") +
        (v.publicada ? "<span>" + ddmm(v.publicada) + "</span>" : "") + "</div>" +
      (v.obs ? '<p class="obs">' + esc(v.obs) + "</p>" : '<p class="obs"></p>') +
      (url ? '<a class="btn" href="' + esc(url) + '" target="_blank" rel="noopener">Abrir vaga ↗</a>' : "") +
      "</article>";
  }

  function render() {
    var t = termo.trim().toLowerCase();
    var lista = vagas.filter(FILTROS[filtro]).filter(function (v) {
      return !t || (v.vaga + " " + v.empresa + " " + v.local + " " + v.obs).toLowerCase().indexOf(t) > -1;
    });
    $("count").textContent = lista.length + (lista.length === 1 ? " vaga" : " vagas");
    $("grid").innerHTML = lista.length ? lista.map(card).join("")
      : '<p class="empty">Nenhuma vaga com esse filtro.</p>';
  }

  document.querySelectorAll(".filter").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".filter").forEach(function (x) { x.classList.remove("is-on"); });
      b.classList.add("is-on");
      filtro = b.getAttribute("data-f");
      render();
    });
  });
  $("busca").addEventListener("input", function (e) { termo = e.target.value; render(); });
  render();

  // ---- paralaxe da capa: só o personagem se move, com desfoque na rolagem ----
  (function () {
    var hero = $("hero"), foto = $("hero-photo"), txt = document.querySelector(".hero-inner"), hint = $("scroll-hint");
    if (!hero || !foto) return;
    var reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var clamp = function (x) { return Math.max(0, Math.min(1, x)); };
    var ease = function (x) { return 1 - Math.pow(1 - x, 3); };
    var ultimoY = window.scrollY, ultimoT = performance.now(), velBlur = 0, rodando = false;

    function quadro() {
      var agora = performance.now();
      var dy = Math.abs(window.scrollY - ultimoY), dt = Math.max(16, agora - ultimoT);
      ultimoY = window.scrollY; ultimoT = agora;
      // desfoque de movimento: cresce com a velocidade da rolagem e some quando para
      velBlur = Math.max(velBlur * 0.86, Math.min(10, (dy / dt) * 6));

      var total = hero.offsetHeight - window.innerHeight;
      var p = reduz ? 1 : clamp(-hero.getBoundingClientRect().top / (total || 1));
      var a = ease(clamp(p / 0.45));          // fase 1: o personagem chega
      var b = ease(clamp((p - 0.45) / 0.45)); // fase 2: vai para o segundo plano
      var blurBase, brilho;
      var wm = $("wordmark"), base = document.querySelector(".hero-base");
      if (p < 0.45) {
        foto.style.zIndex = 2;
        foto.style.opacity = 1;
        foto.style.transform = "translateY(" + (-4 * a) + "%) scale(" + (1 + 0.14 * a) + ")";
        blurBase = 0; brilho = 1;
        wm.style.transform = "scale(" + (1 - 0.06 * a) + ")"; wm.style.opacity = 1 - 0.5 * a;
        base.style.opacity = 1 - a; base.style.transform = "translateY(" + (30 * a) + "px)";
        txt.style.filter = "none";
      } else {
        foto.style.zIndex = 0;
        foto.style.opacity = 1 - 0.6 * b;
        foto.style.transform = "translateY(" + (-4 + 8 * b) + "%) scale(" + (1.14 - 0.34 * b) + ")";
        blurBase = 8 * b; brilho = 1 - 0.5 * b;
        wm.style.transform = "scale(" + (0.94 + 0.06 * b) + ")"; wm.style.opacity = 0.5 + 0.5 * b;
        base.style.opacity = b; base.style.transform = "translateY(" + (30 * (1 - b)) + "px)";
        txt.style.filter = "none";
      }
      var blur = reduz ? blurBase : blurBase + velBlur;
      foto.style.filter = "blur(" + blur.toFixed(2) + "px) brightness(" + brilho.toFixed(3) + ")";
      if (hint) hint.style.opacity = p > 0.05 ? 0 : 1;

      if (velBlur > 0.05 && !reduz) { requestAnimationFrame(quadro); } else { velBlur = 0; rodando = false; }
    }
    function pedir() { if (!rodando) { rodando = true; requestAnimationFrame(quadro); } }
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    rodando = true; quadro();
  })();

  // ---- zíper abre, o rapaz estica a mão, o cartão sai dela e as vagas passam ----
  (function () {
    var sec = $("zip"); if (!sec) return;
    var aberto = $("zip-aberto"), fechado = $("zip-fechado"), cima = $("zip-cima"), baixo = $("zip-baixo");
    var azul = $("fundo-azul"), cartao = $("cartao"), conteudo = $("cartao-conteudo");
    var trilho = $("carrossel-trilho"), cards = [].slice.call(trilho.children);
    var reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var clamp = function (x) { return Math.max(0, Math.min(1, x)); };
    var ease = function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    var fase = function (p, a, b) { return ease(clamp((p - a) / (b - a))); };
    var pedido = false;
    function quadro() {
      pedido = false;
      var vw = window.innerWidth, vh = window.innerHeight;
      var total = sec.offsetHeight - vh;
      var p = reduz ? 1 : clamp(-sec.getBoundingClientRect().top / (total || 1));
      var fecha = fase(p, 0, .08);
      var abre  = fase(p, .08, .3);    // zíper abre
      var mao   = fase(p, .28, .38);   // rapaz estica a mão
      var sai   = fase(p, .36, .48);   // cartão inclinado sai da mão
      var toma  = fase(p, .48, .58);   // cartão endireita e toma a tela
      var anda  = clamp((p - .6) / .38); // vagas passam da direita para a esquerda

      // zíper
      fechado.style.transform = "scale(" + (1.25 - .25 * fecha) + ")";
      fechado.style.filter = "blur(" + (abre * 6) + "px) brightness(" + (1 - abre * .4) + ")";
      cima.style.transform = "translateY(" + (-abre * 55) + "vh)";
      baixo.style.transform = "translateY(" + (abre * 55) + "vh)";
      aberto.style.setProperty("--rx", (abre * 95) + "%");
      aberto.style.setProperty("--ry", (abre * 80) + "%");
      aberto.style.transform = "scale(" + (1.18 - .18 * abre + .1 * mao) + ")";
      aberto.style.filter = "blur(" + ((1 - abre) * 10 + sai * 6) + "px)";

      // fundo azul entra atrás do cartão, como na referência
      azul.style.opacity = sai;

      // cartão: pequeno e inclinado na mão → grande inclinado → reto em tela cheia
      var w0 = .08, w1 = .8, h1 = .78;
      var sx = sai < 1 ? (w0 + (w1 - w0) * sai) : (w1 + (1 - w1) * toma);
      var sy = sai < 1 ? (w0 + (h1 - w0) * sai) : (h1 + (1 - h1) * toma);
      var rot = sai < 1 ? (-12 + 9 * sai) : (-3 + 3 * toma);
      var dx = (1 - sai) * vw * .15, dy = (1 - sai) * vh * .06; // começa sobre a mão
      cartao.style.opacity = clamp(sai * 3);
      cartao.style.width = (sx * 100) + "vw";
      cartao.style.height = (sy * 100) + "vh";
      cartao.style.borderRadius = ((1 - toma) * 6) + "px";
      cartao.style.transform = "translate(-50%, -50%) translate(" + dx + "px," + dy + "px) rotate(" + rot + "deg)";
      conteudo.style.opacity = toma;
      conteudo.style.width = vw + "px"; conteudo.style.height = vh + "px";
      conteudo.style.left = (-(1 - sx) * vw / 2) + "px"; conteudo.style.top = (-(1 - sy) * vh / 2) + "px";

      // carrossel: anda da direita para a esquerda, com curva
      var larguraTrilho = trilho.scrollWidth - vw;
      trilho.style.transform = "translateX(" + (-larguraTrilho * anda) + "px)";
      var meio = vw / 2;
      cards.forEach(function (c) {
        var r = c.getBoundingClientRect();
        var d = (r.left + r.width / 2 - meio) / meio; // -1 (esq) .. 1 (dir)
        var dd = Math.max(-1.4, Math.min(1.4, d));
        c.style.transform = "rotateY(" + (-dd * 16) + "deg) translateZ(" + (-Math.abs(dd) * 60) + "px)";
      });
      cartao.style.pointerEvents = toma > .95 ? "auto" : "none";
    }
    window.addEventListener("scroll", function () { if (!pedido) { pedido = true; requestAnimationFrame(quadro); } }, { passive: true });
    window.addEventListener("resize", quadro);
    quadro();
  })();

  // ---- entrada suave ----
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: .15 });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
  }
})();
