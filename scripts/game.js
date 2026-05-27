// LIB FOR GAMERS — Detalhes do Jogo (game.js)
// Cuida do carregamento de informações detalhadas de um jogo específico (screenshots, lojas, ficha técnica).
// Ele pega a descrição em inglês da API RAWG, resume e traduz automaticamente para o português. 
// Também coordena o seletor visual de enviar notas (0,5 a 5 estrelas) e de salvar o seu comentário.

let RAWG_API_KEY = "";
const RAWG_BASE_URL = "https://api.rawg.io/api";
// Configuração para funcionar tanto localmente quanto no Vercel
const API_BASE_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname) || window.location.protocol === "file:" 
  ? "http://localhost:3333" 
  : "";

// Cache de lojas da RAWG (id → nome), carregado uma única vez
const rawgStoreMap = new Map();

// Referências ao DOM
const ui = {};

// Estado da página — acessível pelas funções de avaliação
let usuarioLogado = null;
let currentGameId = null;

document.addEventListener("DOMContentLoaded", init);

// ============================================================
//  INICIALIZAÇÃO
// ============================================================

async function init() {
    mapElements();
    
    try {
        const configResp = await fetch(`${API_BASE_URL}/api/config`);
        const configData = await configResp.json();
        if (configData.rawgApiKey) RAWG_API_KEY = configData.rawgApiKey;
    } catch(err) {
        console.warn("Aviso: Chave da API não foi recebida do servidor.");
    }
    applySavedTheme();
    usuarioLogado = localStorage.getItem("gamer_current_user");

    if (ui.btnTema) {
        ui.btnTema.addEventListener("click", alternarTema);
        atualizarRotuloBtnTema();
    }

    if (ui.btnSair) {
        ui.btnSair.style.display = usuarioLogado ? "inline-block" : "none";
        ui.btnSair.addEventListener("click", lidarComSaida);
    }

    const gameId = new URLSearchParams(window.location.search).get("id");

    if (!gameId) {
        showError("Jogo não encontrado. Volte para o catálogo e escolha um jogo válido.");
        return;
    }

    loadGameDetail(gameId);
}

// Mapeia os elementos do DOM usados nessa página
function mapElements() {
    // Controles do topo (Nav)
    ui.btnTema = document.getElementById("btnTema");
    ui.btnSair = document.getElementById("btnSair");

    // Estados da página (carregando / detalhes / erro)
    ui.detail = document.getElementById("detalheJogo");
    ui.loading = document.getElementById("carregandoDetalhe");
    ui.error = document.getElementById("erroDetalhe");

    // Hero
    ui.heroImage = document.getElementById("imagemHero");
    ui.gameName = document.getElementById("nomeJogo");
    ui.gameSubtitle = document.getElementById("subtituloJogo");
    ui.scoreBadge = document.getElementById("emblemaScore");

    // Conteúdo do jogo
    ui.gameDescription = document.getElementById("descricaoJogo");
    ui.gameFacts = document.getElementById("fatosJogo");
    ui.gamePlatforms = document.getElementById("plataformasJogo");
    ui.gameGenres = document.getElementById("generosJogo");
    ui.gameTags = document.getElementById("tagsJogo");
    ui.storeLinks = document.getElementById("linksLoja");
    ui.screenshotsGrid = document.getElementById("gradeCaptura");

    // Card de pontuações
    ui.metacriticDetalhe = document.getElementById("metacriticDetalhe");
    ui.estrelasPontuacao = document.getElementById("estrelasPontuacao");
    ui.textoMedia = document.getElementById("textoMedia");

    // Formulário de avaliação
    ui.listaAvaliacoes = document.getElementById("listaAvaliacoes");
    ui.painelFormAvaliacao = document.getElementById("painelFormAvaliacao");
    ui.formularioAvaliacao = document.getElementById("formularioAvaliacao");
    ui.notaAvaliacao = document.getElementById("notaAvaliacao");
    ui.comentarioAvaliacao = document.getElementById("comentarioAvaliacao");
    ui.retornoAvaliacao = document.getElementById("retornoAvaliacao");
    ui.avisoLoginAvaliacao = document.getElementById("avisoLoginAvaliacao");
    ui.seletorEstrelas = document.getElementById("seletorEstrelas");
    ui.textoNota = document.getElementById("textoNota");

    // Event delegation para editar/deletar avaliações
    if (ui.listaAvaliacoes) {
        ui.listaAvaliacoes.addEventListener("click", lidarComAcoesAvaliacao);
    }
}

// Aplica o tema salvo sem piscar ao carregar
function applySavedTheme() {
    const tema = localStorage.getItem("gamer_theme") || "dark";
    document.body.classList.toggle("light", tema === "light");
}

// Alternar entre modo dark/light
function alternarTema() {
    const isLight = document.body.classList.toggle("light");
    localStorage.setItem("gamer_theme", isLight ? "light" : "dark");
    atualizarRotuloBtnTema();
}

// Atualizar o texto do botao de tema
function atualizarRotuloBtnTema() {
    if (ui.btnTema) {
        ui.btnTema.textContent = document.body.classList.contains("light") ? "Modo escuro" : "Modo claro";
    }
}

// Encerrar sessao local
function lidarComSaida() {
    localStorage.removeItem("gamer_current_user");
    usuarioLogado = null;
    window.location.href = "login.html";
}

// ============================================================
//  CARREGAMENTO DE DADOS
// ============================================================

// Carrega detalhes + screenshots + lojas em paralelo
async function loadGameDetail(gameId) {
    currentGameId = Number(gameId);
    try {
        const [detail, screenshots, stores] = await Promise.all([
            fetchJson(`${RAWG_BASE_URL}/games/${gameId}?key=${RAWG_API_KEY}`),
            fetchJson(`${RAWG_BASE_URL}/games/${gameId}/screenshots?key=${RAWG_API_KEY}`),
            fetchJson(`${RAWG_BASE_URL}/games/${gameId}/stores?key=${RAWG_API_KEY}`)
        ]);

        await ensureRawgStoreMap();
        await renderDetail(detail, screenshots.results || [], stores.results || []);
        await loadAvaliacoes(gameId);
    } catch (_) {
        showError("Não foi possível carregar os detalhes deste jogo. Tente outro no catálogo.");
    }
}

// Garante que o mapa de lojas está populado (busca apenas uma vez)
async function ensureRawgStoreMap() {
    if (rawgStoreMap.size > 0) return;

    try {
        const data = await fetchJson(`${RAWG_BASE_URL}/stores?key=${RAWG_API_KEY}&page_size=40`);
        (data.results || []).forEach((s) => {
            if (s?.id) rawgStoreMap.set(Number(s.id), s.name || "Loja");
        });
    } catch (_) {
        // Sem o mapa, o nome da loja será extraído da URL como fallback
    }
}

// ============================================================
//  RENDERIZAÇÃO
// ============================================================

// Retorna a classe CSS conforme a faixa da nota (reusado em vários pontos)
function getScoreClass(score) {
    return score >= 75 ? "meta-alta" : score >= 50 ? "meta-media" : "meta-baixa";
}

async function renderDetail(detail, screenshots, stores) {
    const score = getMetaScore(detail);
    const scoreClass = getScoreClass(score);

    // Hero
    ui.heroImage.src = detail.background_image || "https://via.placeholder.com/1280x720?text=Sem+Imagem";
    ui.heroImage.alt = `Imagem principal de ${detail.name || "jogo"}`;
    ui.gameName.textContent = detail.name || "Jogo sem nome";
    ui.gameSubtitle.textContent = `${detail.released || "Sem data"} | ${detail.esrb_rating?.name || "Sem classificação"}`;
    ui.scoreBadge.className = `meta-score ${scoreClass}`;
    ui.scoreBadge.textContent = String(score);

    // Metacritic no card de pontuações
    if (ui.metacriticDetalhe) {
        const mc = typeof detail.metacritic === "number" ? detail.metacritic : null;
        const mcClass = mc !== null ? getScoreClass(mc) : "";
        ui.metacriticDetalhe.textContent = mc !== null ? String(mc) : "N/A";
        ui.metacriticDetalhe.className = `pontuacao-meta${mcClass ? " " + mcClass : ""}`;
    }

    // Descrição traduzida para PT-BR
    ui.gameDescription.textContent = "Traduzindo resumo...";
    const summary = await getSimplePortugueseSummary(detail.description_raw || detail.description || "");
    ui.gameDescription.textContent = summary;

    // Fatos do jogo
    const facts = [
        { label: "Desenvolvedora", value: listNames(detail.developers) },
        { label: "Publicadora", value: listNames(detail.publishers) },
        { label: "Tempo de jogo", value: detail.playtime ? `${detail.playtime}h (média)` : "Não informado" },
        { label: "Nota RAWG", value: typeof detail.rating === "number" ? detail.rating.toFixed(1) : "N/A" },
        { label: "Metacritic", value: typeof detail.metacritic === "number" ? String(detail.metacritic) : "N/A" },
        { label: "Website", value: detail.website || "Não informado" }
    ];

    ui.gameFacts.innerHTML = facts
        .map(({ label, value }) => `<li><strong>${label}:</strong> ${escapeHtml(value)}</li>`)
        .join("");

    // Tags e plataformas
    ui.gamePlatforms.innerHTML = createTagList((detail.platforms || []).map(p => p.platform?.name).filter(Boolean));
    ui.gameGenres.innerHTML = createTagList((detail.genres || []).map(g => g.name));
    ui.gameTags.innerHTML = createTagList((detail.tags || []).slice(0, 12).map(t => t.name));

    // Links de lojas
    ui.storeLinks.innerHTML = stores.length
        ? stores.map((store) => {
            const storeName = store.store?.name
                || rawgStoreMap.get(Number(store.store_id))
                || extractStoreNameFromUrl(store.url)
                || "Loja oficial";

            const href = store.url || (store.store?.domain ? `https://${store.store.domain}` : "#");
            return `<a class="link-loja" href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(storeName)}</a>`;
        }).join("")
        : `<p class="texto-suave">Sem lojas cadastradas pela RAWG para este jogo.</p>`;

    // Screenshots
    ui.screenshotsGrid.innerHTML = screenshots.length
        ? screenshots.slice(0, 12).map(shot =>
            `<img class="captura" src="${shot.image}" alt="Screenshot de ${escapeHtml(detail.name || "jogo")}" loading="lazy">`
        ).join("")
        : `<p class="texto-suave">Sem capturas de tela disponíveis.</p>`;

    // Exibe o conteúdo
    ui.loading.classList.add("oculto");
    ui.error.classList.add("oculto");
    ui.detail.classList.remove("oculto");

    // Formulário de avaliação
    if (usuarioLogado) {
        ui.painelFormAvaliacao.classList.remove("oculto");
        criarSeletorEstrelas(0);
        if (ui.formularioAvaliacao) {
            ui.formularioAvaliacao.addEventListener("submit", (e) =>
                submitAvaliacao(e, detail.id, detail.name, usuarioLogado)
            );
        }
    } else {
        // Deslogado: mostra aviso com link para login
        ui.avisoLoginAvaliacao.classList.remove("oculto");
    }
}

// ============================================================
//  DESCRIÇÃO — TRADUÇÃO E LIMPEZA
// ============================================================

// Extrai as primeiras frases e tenta traduzir para PT-BR
async function getSimplePortugueseSummary(rawText) {
    const cleaned = simplifyDescription(sanitizeText(rawText || ""), 320);
    if (!cleaned) return "Sem descrição disponível.";

    try {
        return (await translateToPortuguese(cleaned)) || cleaned;
    } catch (_) {
        return cleaned; // Fallback: exibe em inglês se a tradução falhar
    }
}

// Extrai até 2 frases iniciais até o limite de caracteres
function simplifyDescription(text, maxLen) {
    const trimmed = sanitizeText(text);
    const sentences = trimmed.replace(/([.!?])\s+/g, "$1|").split("|").filter(Boolean);
    const selected = [];
    let total = 0;

    for (const sentence of sentences) {
        if (total + sentence.length > maxLen && selected.length > 0) break;
        selected.push(sentence);
        total += sentence.length;
        if (selected.length >= 2) break;
    }

    const summary = selected.join(" ").trim();
    return summary || trimmed.slice(0, maxLen).trim();
}

// Chama a API MyMemory para traduzir EN → PT-BR
async function translateToPortuguese(text) {
    const params = new URLSearchParams({ q: text, langpair: "en|pt-BR" });
    const data = await fetchJson(`https://api.mymemory.translated.net/get?${params.toString()}`);
    const translated = data?.responseData?.translatedText;

    if (!translated) throw new Error("Tradução indisponível");
    return sanitizeText(translated);
}

// ============================================================
//  AVALIAÇÕES
// ============================================================

// Carrega e exibe as avaliações do jogo
async function loadAvaliacoes(gameId) {
    if (!ui.listaAvaliacoes) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/avaliacoes/${gameId}`);

        // Banco não configurado neste ambiente (Vercel sem MySQL)
        if (response.status === 503) {
            ui.listaAvaliacoes.innerHTML = `<p class="texto-suave">Avaliações indisponíveis neste ambiente — recurso requer banco de dados.</p>`;
            atualizarMediaSite(null, 0);
            return;
        }

        const data = await response.json();
        renderAvaliacoes(data.avaliacoes || []);
        atualizarMediaSite(data.media, data.total);
    } catch (_) {
        ui.listaAvaliacoes.innerHTML = `<p class="texto-suave">Não foi possível carregar as avaliações no momento.</p>`;
    }
}

// Atualiza o painel "Usuários do site" com a média em estrelas
function atualizarMediaSite(media, total) {
    if (!ui.estrelasPontuacao || !ui.textoMedia) return;

    if (media === null || total === 0) {
        ui.estrelasPontuacao.innerHTML = renderEstrelas(0);
        ui.textoMedia.textContent = "Sem avaliações";
        return;
    }

    ui.estrelasPontuacao.innerHTML = renderEstrelas(media);
    ui.textoMedia.textContent = `${media.toFixed(1)} / 5 — ${total} avaliação${total !== 1 ? "ões" : ""}`;
}

// Gera HTML de estrelas preenchidas proporcionalmente à nota (0–5)
function renderEstrelas(nota) {
    const pct = ((nota / 5) * 100).toFixed(1);
    return `
        <span class="estrelas-fundo"  aria-hidden="true">★★★★★</span>
        <span class="estrelas-cheias" aria-hidden="true" style="width: ${pct}%">★★★★★</span>
    `;
}

// Helpers para montar cada item de avaliação
function getBadgeEditado(av) {
    const foiEditado = av.editado_em && av.editado_em !== av.criado_em;
    if (!foiEditado) return "";
    const dataEdicao = new Date(av.editado_em).toLocaleDateString("pt-BR");
    return `<span class="badge-editado" title="Editado em ${dataEdicao}">editado</span>`;
}

function getAcoesAvaliacao(av) {
    if (!usuarioLogado || av.usuario !== usuarioLogado) return "";
    return `
        <div class="acoes-avaliacao">
            <button class="btn-acao-av btn-editar-av"
                data-action="edit-review"
                data-nota="${av.nota}"
                data-comentario="${encodeURIComponent(av.comentario)}"
                title="Editar minha avaliação">Editar</button>
            <button class="btn-acao-av btn-deletar-av"
                data-action="delete-review"
                title="Deletar minha avaliação">Deletar</button>
        </div>`;
}

function renderAvaliacaoItem(av) {
    const data = new Date(av.criado_em).toLocaleDateString("pt-BR");
    return `
        <div class="item-avaliacao">
            <div class="cabecalho-avaliacao">
                <span class="usuario-avaliacao">${escapeHtml(av.usuario)}</span>
                <div class="estrelas-display estrelas-avaliacao">${renderEstrelas(Number(av.nota))}</div>
                <span class="nota-texto">${Number(av.nota).toFixed(1)}</span>
                ${getBadgeEditado(av)}
                <span class="data-avaliacao texto-suave">${data}</span>
                ${getAcoesAvaliacao(av)}
            </div>
            <p class="comentario-avaliacao">${escapeHtml(av.comentario)}</p>
        </div>
    `;
}

// Renderiza a lista de avaliações
function renderAvaliacoes(avaliacoes) {
    if (!avaliacoes.length) {
        ui.listaAvaliacoes.innerHTML = `<p class="texto-suave">Nenhuma avaliação ainda. Seja o primeiro!</p>`;
        return;
    }

    ui.listaAvaliacoes.innerHTML = avaliacoes.map(renderAvaliacaoItem).join("");
}

// ============================================================
//  SELETOR DE ESTRELAS (formulário de avaliação)
// ============================================================

// Cria o seletor interativo com suporte a meias estrelas (0,5 a 5)
function criarSeletorEstrelas(notaInicial = 0) {
    const container = ui.seletorEstrelas;
    if (!container) return;

    container.innerHTML = "";

    let notaSelecionada = 0;
    const itens = [];

    for (let i = 1; i <= 5; i++) {
        const item = document.createElement("span");
        item.className = "estrela-item";
        item.textContent = "★";
        item.dataset.indice = i;

        // Metade esquerda = meia estrela | metade direita = estrela inteira
        const esq = document.createElement("span");
        esq.className = "estrela-esq";
        esq.title = `${i - 0.5} estrela${i - 0.5 !== 1 ? "s" : ""}`;

        const dir = document.createElement("span");
        dir.className = "estrela-dir";
        dir.title = `${i} estrela${i !== 1 ? "s" : ""}`;

        esq.addEventListener("mouseenter", () => iluminar(i - 0.5));
        dir.addEventListener("mouseenter", () => iluminar(i));
        esq.addEventListener("click", () => selecionar(i - 0.5));
        dir.addEventListener("click", () => selecionar(i));

        item.appendChild(esq);
        item.appendChild(dir);
        container.appendChild(item);
        itens.push(item);
    }

    // Ao sair do seletor, volta para a nota fixada
    container.addEventListener("mouseleave", () => iluminar(notaSelecionada));

    // Atualiza as classes visuais conforme a nota em foco
    function iluminar(nota) {
        itens.forEach((item, idx) => {
            const num = idx + 1;
            item.classList.remove("estrela-cheia", "estrela-meia", "estrela-vazia");
            if (nota >= num) item.classList.add("estrela-cheia");
            else if (nota >= num - 0.5) item.classList.add("estrela-meia");
            else item.classList.add("estrela-vazia");
        });
    }

    function selecionar(nota) {
        notaSelecionada = nota;
        ui.notaAvaliacao.value = nota;
        ui.textoNota.textContent = `${nota} estrela${nota !== 1 ? "s" : ""}`;
        iluminar(nota);
    }

    if (notaInicial > 0) selecionar(notaInicial);
    else iluminar(0);
}

// ============================================================
//  ENVIO DE AVALIAÇÃO
// ============================================================

// Valida e envia a avaliação; recarrega a lista ao concluir
async function submitAvaliacao(event, gameId, gameName, usuario) {
    event.preventDefault();

    const nota = Number(ui.notaAvaliacao.value);
    const comentario = ui.comentarioAvaliacao.value.trim();

    if (!nota || nota < 0.5 || nota > 5) {
        ui.retornoAvaliacao.textContent = "Selecione uma nota de 0,5 a 5 estrelas.";
        return;
    }

    if (comentario.length < 4) {
        ui.retornoAvaliacao.textContent = "O comentário deve ter pelo menos 4 caracteres.";
        return;
    }

    ui.retornoAvaliacao.textContent = "Enviando...";

    try {
        const response = await fetch(`${API_BASE_URL}/api/avaliacoes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario, game_id: gameId, game_name: gameName, nota, comentario })
        });

        const data = await response.json();

        if (!response.ok) {
            ui.retornoAvaliacao.textContent = data.erro || "Erro ao enviar avaliação.";
            return;
        }

        ui.retornoAvaliacao.textContent = data.mensagem || "Avaliação enviada!";
        ui.formularioAvaliacao.reset();
        ui.notaAvaliacao.value = 0;
        ui.textoNota.textContent = "Nenhuma nota selecionada";

        // Recria o seletor para resetar o estado visual das estrelas
        criarSeletorEstrelas();

        // Recarrega as avaliações com a nova entrada
        await loadAvaliacoes(currentGameId);
    } catch (_) {
        ui.retornoAvaliacao.textContent = "Servidor offline. Tente novamente mais tarde.";
    }
}

// ============================================================
//  EDITAR / DELETAR AVALIAÇÃO
// ============================================================

// Delegação de cliques na lista de avaliações
function lidarComAcoesAvaliacao(event) {
    const editBtn = event.target.closest("[data-action='edit-review']");
    if (editBtn) {
        const nota = Number(editBtn.dataset.nota);
        const comentario = decodeURIComponent(editBtn.dataset.comentario);
        editarAvaliacao(nota, comentario);
        return;
    }

    const deleteBtn = event.target.closest("[data-action='delete-review']");
    if (deleteBtn && confirm("Tem certeza que quer deletar sua avaliação?")) {
        deletarAvaliacao();
    }
}

// Pré-preenche o formulário com os dados da avaliação e faz scroll até ele
function editarAvaliacao(nota, comentario) {
    if (!ui.formularioAvaliacao) return;

    ui.comentarioAvaliacao.value = comentario;
    criarSeletorEstrelas(nota);

    const btnSubmit = ui.formularioAvaliacao.querySelector("button[type='submit']");
    if (btnSubmit) btnSubmit.textContent = "Atualizar avaliação";

    ui.retornoAvaliacao.textContent = "Editando sua avaliação existente...";
    ui.painelFormAvaliacao.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Deleta a avaliação do usuário logado neste jogo
async function deletarAvaliacao() {
    if (!usuarioLogado || !currentGameId) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/avaliacoes`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario: usuarioLogado, game_id: currentGameId })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.erro || "Erro ao deletar avaliação.");
            return;
        }

        await loadAvaliacoes(currentGameId);
    } catch (_) {
        alert("Servidor offline. Tente novamente mais tarde.");
    }
}

// ============================================================
//  UTILITÁRIOS
// ============================================================

// Exibe a seção de erro e esconde o conteúdo
function showError(message) {
    ui.loading.classList.add("oculto");
    ui.detail.classList.add("oculto");
    ui.error.classList.remove("oculto");
    ui.error.textContent = message;
}

// Extrai a melhor nota disponível (0–100)
function getMetaScore(game) {
    const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
    if (typeof game.metacritic === "number") return clamp(game.metacritic);
    if (typeof game.rating === "number") return clamp(Math.round(game.rating * 20));
    return 0;
}

// Cria uma lista de pills a partir de um array de strings
function createTagList(items) {
    if (!Array.isArray(items) || !items.length) {
        return `<span class="pilula-genero">Sem dados</span>`;
    }
    return items.map(item => `<span class="pilula-genero">${escapeHtml(String(item))}</span>`).join("");
}

// Junta os nomes de um array de objetos { name }
function listNames(items) {
    if (!Array.isArray(items) || !items.length) return "Não informado";
    return items.map(item => item.name).filter(Boolean).join(", ");
}

// Extrai o nome da loja a partir do domínio da URL
function extractStoreNameFromUrl(url) {
    if (!url) return "";
    try {
        const hostname = new URL(url).hostname.replace("www.", "");
        const label = hostname.split(".")[0] || "";
        return label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
    } catch (_) {
        return "";
    }
}

// Remove espaços extras e limpa o texto
function sanitizeText(text) {
    return String(text).replace(/\s+/g, " ").trim();
}

// Fetch com verificação de status HTTP
async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

// Escapa caracteres especiais para inserção segura em innerHTML
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
