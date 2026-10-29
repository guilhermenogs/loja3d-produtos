import { CONFIG } from "./config.js";
import { listarProdutos } from "./store.js";

const $ = (s) => document.querySelector(s);
const brl = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

document.title = CONFIG.nomeLoja;
$("#nome").textContent = CONFIG.nomeLoja;
$("#slogan").textContent = CONFIG.slogan;
$("#rodape").textContent = `© ${new Date().getFullYear()} ${CONFIG.nomeLoja}`;

const grid = $("#grid");
const modal = $("#modal");

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function card(p) {
  const vendido = p.disponivel === false;
  const b = el("button", "card" + (vendido ? " sold" : ""));
  b.type = "button";
  const ph = el("div", "ph");
  if (p.fotos?.[0]) {
    const img = el("img");
    img.src = p.fotos[0]; img.alt = p.nome; img.loading = "lazy";
    ph.append(img);
  }
  if (vendido) ph.append(el("span", "badge", "Vendido"));
  const info = el("div", "info");
  info.append(el("span", "nome", p.nome), el("span", "preco", brl(p.preco)));
  b.append(ph, info);
  b.addEventListener("click", () => abrir(p));
  return b;
}

function abrir(p) {
  const fotos = p.fotos || [];
  $("#m-img").src = fotos[0] || "";
  $("#m-img").alt = p.nome;
  const th = $("#m-thumbs");
  th.replaceChildren();
  th.hidden = fotos.length < 2;
  fotos.forEach((src, i) => {
    const t = el("button", "thumb" + (i === 0 ? " on" : ""));
    t.type = "button";
    const im = el("img"); im.src = src; im.alt = `Foto ${i + 1}`;
    t.append(im);
    t.addEventListener("click", () => {
      $("#m-img").src = src;
      th.querySelectorAll(".thumb").forEach((x) => x.classList.remove("on"));
      t.classList.add("on");
    });
    th.append(t);
  });
  $("#m-nome").textContent = p.nome;
  $("#m-preco").textContent = brl(p.preco);
  $("#m-desc").textContent = p.descricao || "";
  $("#m-desc").hidden = !p.descricao;
  const cp = $("#m-copiar");
  cp.dataset.texto = `${p.nome} (${brl(p.preco)})`;
  cp.textContent = p.disponivel === false ? "Já vendido" : "Copiar nome do produto";
  cp.disabled = p.disponivel === false;
  $("#m-dica").hidden = p.disponivel === false;
  const cv = $("#m-conversa");
  cv.hidden = !CONFIG.linkConversa || p.disponivel === false;
  if (CONFIG.linkConversa) cv.href = CONFIG.linkConversa;
  cp.classList.toggle("ghost", !cv.hidden);
  modal.showModal();
}

$("#fechar").addEventListener("click", () => modal.close());
modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });

(async () => {
  try {
    const lista = await listarProdutos();
    grid.replaceChildren();
    if (!lista.length) grid.append(el("p", "empty", "Novos produtos em breve."));
    // disponíveis primeiro
    lista.sort((a, b) => (a.disponivel === false) - (b.disponivel === false));
    lista.forEach((p) => grid.append(card(p)));
  } catch (e) {
    console.error(e);
    grid.replaceChildren(el("p", "empty", "Não foi possível carregar os produtos agora. Tente novamente."));
  }
})();

$("#m-copiar").addEventListener("click", async (e) => {
  const b = e.currentTarget;
  try { await navigator.clipboard.writeText(b.dataset.texto); b.textContent = "Copiado ✓"; }
  catch { b.textContent = b.dataset.texto; }
  setTimeout(() => { b.textContent = "Copiar nome do produto"; }, 2000);
});
