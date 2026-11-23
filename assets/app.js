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

  var chips = [
    ["#c826d8", "✦", total + " vagas", ""],
    ["#ff3f74", "!", altas + " alta aderência", ""],
    ["#3b37b5", "⌂", remotas + " remotas", ""],
    ["#6a12b0", "SP", sp + " em São Paulo", ""],
    ["#1f9d6b", "+", novas + " novas", "24h"]
  ];
  $("chips").innerHTML = chips.map(function (c) {
    return '<li class="chip"><i style="background:' + c[0] + '">' + c[1] + "</i>" + esc(c[2]) +
      (c[3] ? " <small>" + c[3] + "</small>" : "") + "</li>";
  }).join("");

  $("offer-de").textContent = "De " + total + " vagas:";
  $("offer-num").textContent = altas + " com alta aderência";
  $("offer-sub").textContent = novas + " novas nas últimas 24h";
  var pct = total ? Math.round((feitas / total) * 100) : 0;
  $("bar-label").textContent = feitas + " de " + total + " já salvas ou candidatadas (" + pct + "%)";
  $("bar-wrap").setAttribute("aria-label", pct + "% das vagas já salvas ou candidatadas");
  requestAnimationFrame(function () { setTimeout(function () { $("bar").style.width = pct + "%"; }, 300); });

  // ---- destaques ----
  var top = vagas.filter(function (v) { return v.aderencia === "Alta"; }).slice(0, 8);
  $("top-list").innerHTML = top.length ? top.map(function (v, i) {
    var url = safeUrl(v.link);
    return '<li class="top-item reveal">' +
      '<span class="top-n">.' + String(i + 1).padStart(2, "0") + "</span>" +
      '<div class="top-body"><h3>' + esc(v.vaga) + "</h3>" +
      '<p class="meta">' + esc(v.empresa) + " · " + esc(v.local) + (v.publicada ? " · " + ddmm(v.publicada) : "") + "</p>" +
      (v.obs ? '<p class="obs">' + esc(v.obs) + "</p>" : "") + "</div>" +
      (url ? '<a class="pill-cta" href="' + esc(url) + '" target="_blank" rel="noopener">Abrir vaga ↗</a>' : "") +
      "</li>";
  }).join("") : '<li class="top-item">Nenhuma vaga de alta aderência hoje.</li>';

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
      if (p < 0.45) {
        foto.style.zIndex = 2;
        foto.style.opacity = a;
        foto.style.transform = "translateX(" + (60 * (1 - a)) + "%) scale(" + (1.08 - 0.08 * a) + ")";
        blurBase = 14 * (1 - a); brilho = 1;
        txt.style.opacity = 1 - a;
        txt.style.filter = "blur(" + (8 * a) + "px)";
        txt.style.transform = "translateY(" + (-30 * a) + "px)";
      } else {
        foto.style.zIndex = 0;
        foto.style.opacity = 1 - 0.55 * b;
        foto.style.transform = "translateY(" + (4 * b) + "%) scale(" + (1 - 0.22 * b) + ")";
        blurBase = 8 * b; brilho = 1 - 0.5 * b;
        txt.style.opacity = b;
        txt.style.filter = "blur(" + (8 * (1 - b)) + "px)";
        txt.style.transform = "translateY(" + (30 * (1 - b)) + "px)";
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
