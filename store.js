// Camada de dados: GitHub (produção) ou localStorage (modo demonstração).
// Produção: os produtos ficam em docs/produtos.json e as fotos em docs/fotos/.
// O GitHub Pages publica a pasta docs automaticamente depois de cada alteração.
import { CONFIG } from "./config.js";

const G = CONFIG.github;
export const DEMO = !G.owner;
const API = `https://api.github.com/repos/${G.owner}/${G.repo}/`;
const TK = "loja3d-token";

// ---------- MODO DEMONSTRAÇÃO ----------
const LS = "loja3d-demo-produtos";
const svg = (bg, forma) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${bg}"/>${forma}</svg>`);
const SEED = [
  { nome: "Vaso geométrico", preco: 35, descricao: "Vaso decorativo em PLA, 12 cm de altura.", fotos: [svg("#e8e4dc", `<polygon points="200,90 290,150 290,270 200,320 110,270 110,150" fill="#8a7f6a"/>`), svg("#d9d3c6", `<polygon points="200,120 270,160 270,260 200,300 130,260 130,160" fill="#6f6552"/>`)] },
  { nome: "Suporte de headset", preco: 29.9, descricao: "Suporte de mesa, cabe a maioria dos headsets.", fotos: [svg("#dde5ec", `<rect x="170" y="90" width="60" height="200" rx="20" fill="#5b7389"/><rect x="120" y="280" width="160" height="30" rx="15" fill="#5b7389"/>`)] },
  { nome: "Chaveiro personalizado", preco: 12, descricao: "Com o nome que você quiser.", fotos: [svg("#ecdfe0", `<circle cx="200" cy="200" r="90" fill="#a0646b"/><circle cx="200" cy="200" r="30" fill="#ecdfe0"/>`)] },
  { nome: "Organizador de cabos", preco: 18, descricao: "Pacote com 4 unidades.", disponivel: false, fotos: [svg("#dfe8de", `<rect x="110" y="140" width="180" height="120" rx="40" fill="#6b8a68"/>`)] },
  { nome: "Porta-copos hexagonal", preco: 22, descricao: "Kit com 4 peças.", fotos: [svg("#ece8d8", `<polygon points="200,100 280,145 280,255 200,300 120,255 120,145" fill="#9a8f4f"/>`)] },
  { nome: "Miniatura articulada", preco: 45, descricao: "Impressão em resina, pintada à mão.", fotos: [svg("#e3dcec", `<circle cx="200" cy="130" r="45" fill="#7a66a0"/><rect x="150" y="185" width="100" height="130" rx="30" fill="#7a66a0"/>`)] },
];
function lerDemo() {
  let l;
  try { l = JSON.parse(localStorage.getItem(LS)); } catch {}
  if (!Array.isArray(l)) {
    l = SEED.map((p, i) => ({ disponivel: true, ...p, id: "demo" + i, criadoEm: Date.now() - i * 1000 }));
    try { localStorage.setItem(LS, JSON.stringify(l)); } catch {}
  }
  return l;
}
const gravarDemo = (l) => localStorage.setItem(LS, JSON.stringify(l));

// ---------- GITHUB ----------
const token = () => localStorage.getItem(TK);
const b64txt = (s) => btoa(unescape(encodeURIComponent(s)));
const unb64txt = (s) => decodeURIComponent(escape(atob(s.replace(/\n/g, ""))));

async function gh(path, method = "GET", body) {
  const url = API + (path.startsWith("http") ? "" : "") + path + (method === "GET" ? `?ref=${G.branch}&t=${Date.now()}` : "");
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json" },
    body: body ? JSON.stringify({ ...body, branch: G.branch }) : undefined,
  });
  if (r.status === 404 && method === "GET") return null;
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return r.json();
}

async function lerJsonRepo() {
  const f = await gh("contents/docs/produtos.json");
  if (!f) return { sha: null, lista: [] };
  return { sha: f.sha, lista: JSON.parse(unb64txt(f.content)) };
}
const gravarJsonRepo = (lista, sha, msg) =>
  gh("contents/docs/produtos.json", "PUT", {
    message: msg, content: b64txt(JSON.stringify(lista, null, 1)), ...(sha ? { sha } : {}),
  });

async function enviarFoto(dataUrl, nome) {
  const caminho = `fotos/${nome}.jpg`;
  await gh("contents/docs/" + caminho, "PUT", {
    message: "Foto " + nome, content: dataUrl.split(",")[1],
  });
  return caminho;
}
async function apagarFoto(caminho) {
  try {
    const f = await gh("contents/docs/" + caminho);
    if (f) await gh("contents/docs/" + caminho, "DELETE", { message: "Remove foto", sha: f.sha });
  } catch {}
}

// ---------- API ----------
export async function listarProdutos({ admin = false } = {}) {
  if (DEMO) return lerDemo().sort((a, b) => b.criadoEm - a.criadoEm);
  let lista;
  if (admin && token()) lista = (await lerJsonRepo()).lista;
  else {
    const r = await fetch("produtos.json?t=" + Date.now());
    lista = r.ok ? await r.json() : [];
  }
  return lista.sort((a, b) => b.criadoEm - a.criadoEm);
}

// p.fotos: caminhos existentes ou data URLs novas. p.removidas: caminhos a apagar.
export async function salvarProduto(p) {
  if (DEMO) {
    const l = lerDemo();
    const dados = { nome: p.nome, preco: p.preco, descricao: p.descricao || "", fotos: p.fotos, disponivel: p.disponivel !== false };
    if (p.id) { const i = l.findIndex((x) => x.id === p.id); if (i >= 0) l[i] = { ...l[i], ...dados }; }
    else l.push({ ...dados, id: "demo" + Date.now(), criadoEm: Date.now() });
    return gravarDemo(l);
  }
  const id = p.id || "p" + Date.now().toString(36);
  const fotos = [];
  let n = 0;
  for (const f of p.fotos) {
    fotos.push(f.startsWith("data:") ? await enviarFoto(f, `${id}-${Date.now().toString(36)}${n++}`) : f);
  }
  const { sha, lista } = await lerJsonRepo();
  const dados = { id, nome: p.nome, preco: p.preco, descricao: p.descricao || "", fotos, disponivel: p.disponivel !== false };
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = { ...lista[i], ...dados };
  else lista.push({ ...dados, criadoEm: Date.now() });
  await gravarJsonRepo(lista, sha, `${i >= 0 ? "Atualiza" : "Adiciona"} ${dados.nome}`);
  for (const r of p.removidas || []) await apagarFoto(r);
}

export async function excluirProduto(id) {
  if (DEMO) return gravarDemo(lerDemo().filter((x) => x.id !== id));
  const { sha, lista } = await lerJsonRepo();
  const alvo = lista.find((x) => x.id === id);
  await gravarJsonRepo(lista.filter((x) => x.id !== id), sha, `Remove ${alvo?.nome || id}`);
  for (const f of alvo?.fotos || []) await apagarFoto(f);
}

// ---------- ACESSO (chave do GitHub guardada neste navegador) ----------
export async function observarLogin(cb) {
  if (DEMO) {
    const ok = () => cb(sessionStorage.getItem("loja3d-demo-login") ? { demo: true } : null);
    window.addEventListener("demo-auth", ok);
    return ok();
  }
  cb(token() ? { github: true } : null);
  window.addEventListener("gh-auth", () => cb(token() ? { github: true } : null));
}
export async function entrar(chave) {
  if (DEMO) {
    sessionStorage.setItem("loja3d-demo-login", "1");
    return window.dispatchEvent(new Event("demo-auth"));
  }
  const r = await fetch(API.slice(0, -1), {
    headers: { Authorization: `Bearer ${chave}`, Accept: "application/vnd.github+json" },
  });
  if (!r.ok) throw new Error("Chave inválida ou sem acesso ao repositório.");
  const info = await r.json();
  if (!info.permissions?.push) throw new Error("A chave precisa de permissão de escrita (Contents: Read and write).");
  localStorage.setItem(TK, chave);
  window.dispatchEvent(new Event("gh-auth"));
}
export async function sair() {
  if (DEMO) {
    sessionStorage.removeItem("loja3d-demo-login");
    return window.dispatchEvent(new Event("demo-auth"));
  }
  localStorage.removeItem(TK);
  window.dispatchEvent(new Event("gh-auth"));
}
