import {
  DEMO, listarProdutos, salvarProduto, excluirProduto,
  observarLogin, entrar, sair,
} from "./store.js";

const $ = (s) => document.querySelector(s);
const brl = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const MAX_DIM = 1000;   // lado maior da foto, em px
const MAX_FOTOS = 5;

let editando = null;
let fotos = [];      // caminhos existentes ou data URLs novas
let removidas = [];  // caminhos existentes que o usuário tirou

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

// ---------- Fotos: reduz no navegador antes de enviar ----------
async function reduzir(file) {
  const bmp = await createImageBitmap(file);
  const esc = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * esc);
  c.height = Math.round(bmp.height * esc);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

function desenharFotos() {
  const box = $("#pvs");
  box.replaceChildren();
  fotos.forEach((src, i) => {
    const d = document.createElement("div");
    d.className = "pv";
    const img = document.createElement("img"); img.src = src; img.alt = "";
    const x = document.createElement("button");
    x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", "Remover foto");
    x.addEventListener("click", () => {
      const [f] = fotos.splice(i, 1);
      if (!f.startsWith("data:")) removidas.push(f);
      desenharFotos();
    });
    const pr = document.createElement("button");
    pr.type = "button";
    pr.className = "pr" + (i === 0 ? " on" : "");
    pr.textContent = i === 0 ? "★ Principal" : "Tornar principal";
    if (i > 0) pr.addEventListener("click", () => {
      const [f] = fotos.splice(i, 1);
      fotos.unshift(f);
      desenharFotos();
    });
    d.append(img, x, pr);
    box.append(d);
  });
}

$("#foto").addEventListener("change", async (e) => {
  for (const f of [...e.target.files]) {
    if (fotos.length >= MAX_FOTOS) { toast(`Máximo de ${MAX_FOTOS} fotos.`); break; }
    try { fotos.push(await reduzir(f)); } catch { toast("Não consegui ler uma das imagens."); }
  }
  e.target.value = "";
  desenharFotos();
});

// ---------- Formulário ----------
function limpar() {
  editando = null; fotos = []; removidas = [];
  $("#form").reset();
  $("#disponivel").checked = true;
  desenharFotos();
  $("#form-titulo").textContent = "Novo produto";
  $("#cancelar").hidden = true;
}
$("#cancelar").addEventListener("click", limpar);
$("#aviso-pub").hidden = DEMO;

$("#form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!fotos.length) return toast("Escolha pelo menos uma foto.");
  const btn = $("#salvar");
  btn.disabled = true; btn.textContent = "Publicando…";
  try {
    await salvarProduto({
      id: editando?.id,
      nome: $("#nome").value.trim(),
      preco: parseFloat($("#preco").value),
      descricao: $("#descricao").value.trim(),
      fotos, removidas,
      disponivel: $("#disponivel").checked,
    });
    toast(DEMO ? "Salvo!" : "Publicado! Aparece no site em ~1 minuto.");
    limpar();
    await desenhar();
  } catch (err) {
    console.error(err);
    toast("Erro ao publicar. Confira a chave e sua internet.");
  } finally {
    btn.disabled = false; btn.textContent = "Publicar produto";
  }
});

function editar(p) {
  editando = p; fotos = [...(p.fotos || [])]; removidas = [];
  $("#nome").value = p.nome;
  $("#preco").value = p.preco;
  $("#descricao").value = p.descricao || "";
  $("#disponivel").checked = p.disponivel !== false;
  desenharFotos();
  $("#form-titulo").textContent = "Editar produto";
  $("#cancelar").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Lista ----------
function btn(texto, cls, fn) {
  const b = document.createElement("button");
  b.className = "btn small " + cls;
  b.type = "button";
  b.textContent = texto;
  b.addEventListener("click", async () => {
    b.disabled = true;
    try { await fn(); } catch (e) { console.error(e); toast("Erro. Tente de novo."); }
    b.disabled = false;
  });
  return b;
}

async function desenhar() {
  const lista = await listarProdutos({ admin: true });
  const box = $("#lista");
  box.replaceChildren();
  if (!lista.length) {
    const p = document.createElement("p");
    p.style.color = "var(--mute)";
    p.textContent = "Nenhum produto ainda.";
    box.append(p);
    return;
  }
  for (const p of lista) {
    const row = document.createElement("div");
    row.className = "item";
    const img = document.createElement("img");
    img.src = p.fotos?.[0] || ""; img.alt = "";
    const t = document.createElement("div");
    t.className = "t";
    const b = document.createElement("b"); b.textContent = p.nome;
    const s = document.createElement("span");
    s.textContent = brl(p.preco) + (p.disponivel === false ? " · vendido" : "");
    t.append(b, s);
    const btns = document.createElement("div");
    btns.className = "btns";
    btns.append(
      btn("Editar", "ghost", async () => editar(p)),
      btn(p.disponivel === false ? "Reabrir" : "Vendido", "ghost", async () => {
        await salvarProduto({ ...p, disponivel: p.disponivel === false });
        await desenhar();
      }),
      btn("Excluir", "ghost danger", async () => {
        if (!confirm(`Excluir "${p.nome}"?`)) return;
        await excluirProduto(p.id);
        await desenhar();
      })
    );
    row.append(img, t, btns);
    box.append(row);
  }
}

// ---------- Acesso ----------
$("#demo").hidden = !DEMO;
if (DEMO) $("#chave").required = false;
$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const erro = $("#erro-login");
  erro.hidden = true;
  $("#entrar").disabled = true;
  try { await entrar($("#chave").value.trim()); $("#chave").value = ""; }
  catch (err) { erro.textContent = err.message || "Não foi possível entrar."; erro.hidden = false; }
  $("#entrar").disabled = false;
});
$("#sair").addEventListener("click", () => sair());

observarLogin((user) => {
  $("#login").hidden = !!user;
  $("#app").hidden = !user;
  if (user) desenhar().catch(console.error);
});
