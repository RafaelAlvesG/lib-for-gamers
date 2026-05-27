// LIB FOR GAMERS — Página Inicial e Catálogo (app.js)
// Cuida da apresentação dos jogos usando a API RAWG. Controla a pesquisa, 
// os filtros de gêneros e reordenamento da lista de jogos.
// Além disso, gerencia também a parte de Login, Cadastro, salvamento dos 
// favoritos localmente e a troca de modo Claro/Escuro (Tema Light/Dark).
let RAWG_API_KEY  = "";
const RAWG_BASE_URL = "https://api.rawg.io/api";
// Configuração para funcionar tanto localmente quanto no Vercel
const API_BASE_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname) || window.location.protocol === "file:" 
  ? "http://localhost:3333" 
  : "";

// Tradução dos slugs de gênero da RAWG para PT-BR
const GENRE_TRANSLATIONS = {
    action:                  "Ação",
    adventure:               "Aventura",
    arcade:                  "Arcade",
    board:                   "Tabuleiro",
    card:                    "Cartas",
    casual:                  "Casual",
    educational:             "Educacional",
    family:                  "Família",
    fighting:                "Luta",
    indie:                   "Indie",
    "massively-multiplayer": "MMO",
    platformer:              "Plataforma",
    puzzle:                  "Quebra-cabeça",
    racing:                  "Corrida",
    "role-playing-jogos-rpg":"RPG",
    shooter:                 "Tiro",
    simulation:              "Simulação",
    sports:                  "Esportes",
    strategy:                "Estratégia"
};

// Chaves do localStorage para sessão e tema
const STORAGE_KEYS = {
    usuarioAtual: "gamer_current_user",
    theme:        "gamer_theme"
};

// Estado global da aplicação
const estado = {
    usuarioAtual:    null,  // usuário logado (ou null)
    jogos:           [],    // jogos do catálogo
    favoritos:       [],    // favoritos do usuário
    mediasJogos:     {},    // médias do site por game_id
    searchDebounce:  null,  // timer do debounce de busca
    paginaAtual:     1,
    tamanhoPagina:   36,
    temMaisJogos:    true,
    carregandoJogos: false
};

// Referências ao DOM, preenchidas em mapearElementos()
const tela = {};

// ============================================================
//  INICIALIZAÇÃO
// ============================================================

document.addEventListener("DOMContentLoaded", iniciar);

async function iniciar() {
    estado.usuarioAtual = obterUsuarioAtual();
    mapearElementos();
    vincularEventos();
    carregarTema();

    try {
        const configResp = await fetch(`${API_BASE_URL}/api/config`);
        const configData = await configResp.json();
        if (configData.rawgApiKey) RAWG_API_KEY = configData.rawgApiKey;
    } catch(err) {
        console.warn("Aviso: Chave da API não foi recebida do servidor.");
    }

    const isLoginPage    = window.location.pathname.includes("login.html");
    const isRegisterPage = window.location.pathname.includes("cadastro.html");

    // Usuário já logado tentando acessar login/cadastro → manda pra home
    if (estado.usuarioAtual && (isLoginPage || isRegisterPage)) {
        window.location.href = "index.html";
        return;
    }

    if (tela.secaoAutenticacao) {
        mostrarFormularioAutenticacao(isRegisterPage ? "register" : "login");
    }

    atualizarInterfaceAutenticacao();
    carregarDadosIniciais();
}

// Mapeia os elementos do DOM usados pelo script
function mapearElementos() {
    // Auth (só existem em login.html e cadastro.html)
    tela.secaoAutenticacao  = document.getElementById("secaoAutenticacao");
    tela.authMessage        = document.getElementById("authMessage");
    tela.btnMostraLogin     = document.getElementById("btnMostraLogin");
    tela.btnMostraCadastro  = document.getElementById("btnMostraCadastro");
    tela.formularioLogin    = document.getElementById("formularioLogin");
    tela.formularioCadastro = document.getElementById("formularioCadastro");
    tela.emailLogin         = document.getElementById("emailLogin");
    tela.senhaLogin         = document.getElementById("senhaLogin");
    tela.usuarioCadastro    = document.getElementById("usuarioCadastro");
    tela.emailCadastro      = document.getElementById("emailCadastro");
    tela.senhaCadastro      = document.getElementById("senhaCadastro");

    // Controles globais (todas as páginas)
    tela.secaoApp      = document.getElementById("secaoApp");
    tela.btnSair       = document.getElementById("btnSair");
    tela.btnTema       = document.getElementById("btnTema");
    tela.entradaBusca  = document.getElementById("entradaBusca");
    tela.filtroGenero  = document.getElementById("filtroGenero");
    tela.filtroOrdenacao = document.getElementById("filtroOrdenacao");

    // Abas e grids da home
    tela.sectionTabs      = document.querySelectorAll(".aba-secao");
    tela.contentSections  = document.querySelectorAll(".secao-conteudo");
    tela.gradeJogos       = document.getElementById("gradeJogos");
    tela.gradeFavoritos   = document.getElementById("gradeFavoritos");
    tela.infoCatalogo     = document.getElementById("infoCatalogo");
    tela.btnCarregarMais  = document.getElementById("btnCarregarMais");
    tela.crachaUsuario    = document.getElementById("crachaUsuario");
}

// Registra todos os event listeners
function vincularEventos() {
    // Alternância entre login e cadastro
    if (tela.btnMostraLogin)    tela.btnMostraLogin.addEventListener("click", () => mostrarFormularioAutenticacao("login"));
    if (tela.btnMostraCadastro) tela.btnMostraCadastro.addEventListener("click", () => mostrarFormularioAutenticacao("register"));
    if (tela.formularioLogin)    tela.formularioLogin.addEventListener("submit", lidarComLogin);
    if (tela.formularioCadastro) tela.formularioCadastro.addEventListener("submit", lidarComCadastro);

    // Sair e trocar tema
    if (tela.btnSair)  tela.btnSair.addEventListener("click", lidarComSaida);
    if (tela.btnTema)  tela.btnTema.addEventListener("click", alternarTema);

    // Busca e filtro
    if (tela.entradaBusca) tela.entradaBusca.addEventListener("input", lidarComBusca);
    if (tela.filtroGenero) tela.filtroGenero.addEventListener("change", () => carregarJogos(true));
    if (tela.filtroOrdenacao) tela.filtroOrdenacao.addEventListener("change", () => carregarJogos(true));
    if (tela.btnCarregarMais) tela.btnCarregarMais.addEventListener("click", () => carregarJogos(false));

    // Abas da home
    if (tela.sectionTabs) {
        tela.sectionTabs.forEach((btn) => {
            btn.addEventListener("click", () => switchSection(btn.dataset.target));
        });
    }

    // Delegação de clique nos grids (favoritar + navegar)
    if (tela.gradeJogos)     tela.gradeJogos.addEventListener("click", lidarComAcoesGrade);
    if (tela.gradeFavoritos) tela.gradeFavoritos.addEventListener("click", lidarComAcoesGrade);
}

// ============================================================
//  AUTENTICAÇÃO
// ============================================================

// Alterna entre as abas de login e cadastro
function mostrarFormularioAutenticacao(type) {
    const isLogin = type === "login";
    if (tela.btnMostraLogin)    tela.btnMostraLogin.classList.toggle("ativo", isLogin);
    if (tela.btnMostraCadastro) tela.btnMostraCadastro.classList.toggle("ativo", !isLogin);
    if (tela.formularioLogin)    tela.formularioLogin.classList.toggle("oculto", !isLogin);
    if (tela.formularioCadastro) tela.formularioCadastro.classList.toggle("oculto", isLogin);
    definirMensagemAutenticacao("");
}

// Envia o cadastro e redireciona ao login em caso de sucesso
function lidarComCadastro(event) {
    event.preventDefault();

    const usuario = tela.usuarioCadastro.value.trim();
    const email   = tela.emailCadastro.value.trim().toLowerCase();
    const senha   = tela.senhaCadastro.value.trim();

    requestAuthApi("/api/cadastrar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ usuario, email, senha })
    })
    .then(() => {
        if (tela.formularioCadastro) tela.formularioCadastro.reset();
        window.location.href = "login.html?registered=1";
    })
    .catch((err) => {
        definirMensagemAutenticacao(err.message || "Falha ao cadastrar. Verifique o servidor.");
    });
}

// Envia as credenciais e salva o usuário na sessão
function lidarComLogin(event) {
    event.preventDefault();

    const identity = tela.emailLogin.value.trim().toLowerCase();
    const senha    = tela.senhaLogin.value.trim();

    if (!identity || senha.length < 6) {
        definirMensagemAutenticacao("Preencha o usuário/email e uma senha de pelo menos 6 caracteres.");
        return;
    }

    requestAuthApi("/api/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ identity, senha })
    })
    .then((data) => {
        const loggedName = (data.usuario || identity).trim();
        localStorage.setItem(STORAGE_KEYS.usuarioAtual, loggedName);
        estado.usuarioAtual = loggedName;
        if (tela.formularioLogin) tela.formularioLogin.reset();
        window.location.href = "index.html";
    })
    .catch((err) => {
        definirMensagemAutenticacao(err.message || "Falha no login. Verifique o servidor.");
    });
}

// Encerra a sessão e vai para o login
function lidarComSaida() {
    localStorage.removeItem(STORAGE_KEYS.usuarioAtual);
    estado.usuarioAtual = null;
    window.location.href = "login.html";
}

// Mostra/oculta elementos conforme o estado de login
function atualizarInterfaceAutenticacao() {
    const logado = Boolean(estado.usuarioAtual);

    if (tela.secaoAutenticacao) tela.secaoAutenticacao.classList.toggle("oculto", logado);
    if (tela.secaoApp)          tela.secaoApp.classList.remove("oculto");

    if (tela.btnSair) {
        tela.btnSair.style.display = logado ? "inline-block" : "none";
    }

    if (tela.crachaUsuario) {
        tela.crachaUsuario.innerHTML = logado
            ? `Usuário: ${estado.usuarioAtual}`
            : `<a href="login.html" style="color: inherit;">Fazer Login</a>`;
    }

    atualizarBotaoCarregarMais();
}

// ============================================================
//  CATÁLOGO DE JOGOS
// ============================================================

// Carrega favoritos + gêneros + jogos em paralelo
async function carregarDadosIniciais() {
    estado.favoritos = getFavoritesForCurrentUser();
    renderizarFavoritos();

    await Promise.all([
        loadGenres(),
        carregarJogos(true)
    ]);
}

// Busca gêneros da RAWG e popula o select de filtro
async function loadGenres() {
    let generos = [];

    try {
        const data = await fetchJson(`${RAWG_BASE_URL}/genres?key=${RAWG_API_KEY}`);
        generos = data.results || [];
    } catch (_) {
        // Falha silenciosa — select fica só com "Todos os gêneros"
    }

    const options = [`<option value="">Todos os gêneros</option>`];
    generos.forEach((genre) => {
        options.push(`<option value="${genre.slug}">${escapeHtml(getGenreLabel(genre))}</option>`);
    });

    tela.filtroGenero.innerHTML = options.join("");
}

// Carrega (ou recarrega) a lista de jogos com os filtros ativos
// resetList = true volta para página 1 e limpa o grid
async function carregarJogos(resetList = true) {
    if (estado.carregandoJogos) return;
    if (!resetList && !estado.temMaisJogos) return;

    estado.carregandoJogos = true;

    if (resetList) {
        estado.paginaAtual   = 1;
        estado.temMaisJogos  = true;
        tela.gradeJogos.innerHTML = createInfoBox("Carregando jogos...");
    }

    atualizarBotaoCarregarMais();

    const params = new URLSearchParams({
        key:       RAWG_API_KEY,
        page_size: String(estado.tamanhoPagina),
        page:      String(estado.paginaAtual)
    });

    const search         = tela.entradaBusca.value.trim();
    const selectedGenre  = tela.filtroGenero.value;
    const ordering       = tela.filtroOrdenacao?.value || "";

    if (search)        params.set("search", search);
    if (selectedGenre) params.set("genres", selectedGenre);
    if (ordering && ordering !== "site_rating" && ordering !== "-site_rating") params.set("ordering", ordering);

    try {
        const data        = await fetchJson(`${RAWG_BASE_URL}/games?${params.toString()}`);
        let loadedGames   = data.results || [];

        // Ordenação por nota do site: busca médias antes de renderizar
        if ((ordering === "site_rating" || ordering === "-site_rating") && loadedGames.length) {
            const ids = loadedGames.map(g => g.id);
            try {
                const mediaData = await fetchJson(`${API_BASE_URL}/api/avaliacoes/medias?ids=${ids.join(",")}`);
                const medias    = mediaData.medias || {};
                Object.assign(estado.mediasJogos, medias);

                const direcao = ordering === "site_rating" ? 1 : -1;
                loadedGames.sort((a, b) => ((medias[b.id]?.media || 0) - (medias[a.id]?.media || 0)) * direcao);
            } catch (_) {}
        }

        estado.jogos        = resetList ? loadedGames : [...estado.jogos, ...loadedGames];
        estado.temMaisJogos = Boolean(data.next);

        if (estado.temMaisJogos) estado.paginaAtual += 1;

        renderizarJogos();
    } catch (_) {
        // Modo offline: limpa lista e avisa no console
        estado.jogos        = [];
        estado.temMaisJogos = false;
        console.warn("Não foi possível conectar à RAWG. Verifique sua conexão.");
        renderizarJogos();
    } finally {
        estado.carregandoJogos = false;
        atualizarInfoCatalogo();
        atualizarBotaoCarregarMais();
    }
}

// Renderiza o grid do catálogo e dispara o carregamento das médias
function renderizarJogos() {
    if (!estado.jogos.length) {
        tela.gradeJogos.innerHTML = createInfoBox("Nenhum jogo encontrado para os filtros aplicados.");
        atualizarInfoCatalogo();
        atualizarBotaoCarregarMais();
        return;
    }

    tela.gradeJogos.innerHTML = estado.jogos.map(createGameCard).join("");
    carregarMediasJogos();
}

// Renderiza o grid de favoritos
function renderizarFavoritos() {
    if (!estado.favoritos.length) {
        tela.gradeFavoritos.innerHTML = createInfoBox("Você ainda não adicionou favoritos.");
        return;
    }

    tela.gradeFavoritos.innerHTML = estado.favoritos.map(createGameCard).join("");
    carregarMediasJogos();
}

// Busca as médias do site para todos os jogos visíveis e atualiza os badges
async function carregarMediasJogos() {
    const ids = [...new Set([
        ...estado.jogos.map(j => j.id),
        ...estado.favoritos.map(j => j.id)
    ])];

    if (!ids.length) return;

    try {
        const data = await fetchJson(`${API_BASE_URL}/api/avaliacoes/medias?ids=${ids.join(",")}`);
        estado.mediasJogos = data.medias || {};

        document.querySelectorAll("[data-media-id]").forEach(badge => {
            const gameId = Number(badge.dataset.mediaId);
            const info   = estado.mediasJogos[gameId];

            if (info) {
                badge.textContent = `★ ${info.media.toFixed(1)}`;
                badge.title       = `${info.total} avaliação${info.total !== 1 ? "ões" : ""} no site`;
                badge.classList.remove("oculto");

                // Esconde o "—" em todos os cards com esse jogo
                document.querySelectorAll(`[data-media-vazia="${gameId}"]`).forEach(el => {
                    el.classList.add("oculto");
                });
            }
        });
    } catch (_) {
        // Falha silenciosa — o "—" permanece nos cards
    }
}

// ============================================================
//  INTERAÇÕES COM OS CARDS
// ============================================================

// Delegação de cliques nos grids: favoritar tem prioridade, senão navega para o jogo
function lidarComAcoesGrade(event) {
    const favBtn = event.target.closest("button[data-action='favorite']");
    if (favBtn) {
        const game = findGameById(Number(favBtn.dataset.id));
        if (game) toggleFavorite(game);
        return;
    }

    const card = event.target.closest(".cartao-clicavel[data-action='details']");
    if (card) {
        const game = findGameById(Number(card.dataset.id));
        if (game) window.location.href = `game.html?id=${game.id}`;
    }
}

// Procura um jogo pelo ID em todas as coleções conhecidas
function findGameById(gameId) {
    for (const colecao of [estado.jogos, estado.favoritos]) {
        const found = colecao.find(item => item.id === gameId);
        if (found) return found;
    }
    return null;
}

// Adiciona ou remove um jogo dos favoritos (local + servidor)
function toggleFavorite(game) {
    if (!estado.usuarioAtual) {
        alert("Você precisa estar logado para favoritar um jogo.");
        return;
    }

    const jaFavorito = estado.favoritos.some(item => item.id === game.id);

    if (jaFavorito) {
        estado.favoritos = estado.favoritos.filter(item => item.id !== game.id);
        fetch(`${API_BASE_URL}/api/favoritos`, {
            method:  "DELETE",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ usuario: estado.usuarioAtual, game_id: game.id })
        }).catch(() => null);
    } else {
        estado.favoritos.unshift(game);
        fetch(`${API_BASE_URL}/api/favoritos`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ usuario: estado.usuarioAtual, game_id: game.id, game_name: game.name })
        }).catch(() => null);
    }

    saveFavoritesForCurrentUser(estado.favoritos);
    renderizarJogos();
    renderizarFavoritos();
}

// ============================================================
//  MONTAGEM DOS CARDS
// ============================================================

// Helpers para os dados do card — mantêm o template limpo
function getNotaInfo(jogo) {
    const valor = parseInt(jogo.metacritic || (jogo.rating ? jogo.rating * 20 : 0));
    const classe = valor >= 75 ? "meta-alta" : valor >= 50 ? "meta-media" : "meta-baixa";
    return { texto: valor || "N/A", classe };
}

function getGeneroTraduzido(jogo) {
    const obj = jogo.generos?.[0] || jogo.genres?.[0];
    if (!obj) return "N/A";
    return GENRE_TRANSLATIONS[obj.slug] || obj.name || "N/A";
}

function getFavInfo(jogoId) {
    const ativo = estado.favoritos.some(f => f.id === jogoId);
    return { classe: ativo ? "fav-ativo" : "", icone: ativo ? "★" : "☆" };
}

// Gera o HTML de um card de jogo
function createGameCard(jogo) {
    const img  = jogo.background_image || "https://via.placeholder.com/640x360?text=Sem+Imagem";
    const nota = getNotaInfo(jogo);
    const fav  = getFavInfo(jogo.id);

    return `
        <article class="cartao-jogo cartao-clicavel" data-action="details" data-id="${jogo.id}">
            <img class="miniatura-jogo" src="${img}" alt="${escapeHtml(jogo.name)}" loading="lazy">
            <button class="btn-estrela ${fav.classe}" data-action="favorite" data-id="${jogo.id}" type="button" aria-label="Favoritar" title="Favoritar">
                ${fav.icone}
            </button>
            <div class="corpo-jogo">
                <h3 class="titulo-jogo">${escapeHtml(jogo.name || "Sem Nome")}</h3>
                <span class="pilula-genero">${escapeHtml(getGeneroTraduzido(jogo))}</span>
                <div class="notas-card">
                    <div class="nota-card-item">
                        <span class="nota-card-rotulo">Metacritic</span>
                        <span class="pontuacao-meta ${nota.classe}">${nota.texto}</span>
                    </div>
                    <div class="nota-card-item">
                        <span class="nota-card-rotulo">Usuários</span>
                        <span class="pontuacao-site oculto" data-media-id="${jogo.id}">★</span>
                        <span class="pontuacao-site-vazia" data-media-vazia="${jogo.id}">—</span>
                    </div>
                </div>
            </div>
        </article>
    `;
}

// ============================================================
//  CONTROLES DA INTERFACE
// ============================================================

// Busca com debounce de 350ms para não disparar a cada tecla
function lidarComBusca() {
    clearTimeout(estado.searchDebounce);
    estado.searchDebounce = setTimeout(() => carregarJogos(true), 350);
}

// Troca entre as abas Catálogo e Favoritos
function switchSection(sectionId) {
    tela.sectionTabs.forEach((btn) => {
        btn.classList.toggle("ativo", btn.dataset.target === sectionId);
    });
    tela.contentSections.forEach((section) => {
        section.classList.toggle("oculto", section.id !== sectionId);
    });
}

// Atualiza o texto informativo do catálogo
function atualizarInfoCatalogo() {
    if (!tela.infoCatalogo) return;

    if (!estado.jogos.length) {
        tela.infoCatalogo.textContent = "";
        return;
    }

    const moreText = estado.temMaisJogos
        ? "Há mais jogos para carregar."
        : "Você chegou ao fim da lista.";

    tela.infoCatalogo.textContent = `${estado.jogos.length} jogos carregados. ${moreText}`;
}

// Atualiza o estado e o texto do botão "Carregar mais"
function atualizarBotaoCarregarMais() {
    if (!tela.btnCarregarMais) return;

    tela.btnCarregarMais.disabled = estado.carregandoJogos || !estado.temMaisJogos;
    tela.btnCarregarMais.textContent = estado.carregandoJogos
        ? "Carregando..."
        : estado.temMaisJogos
            ? "Carregar mais jogos"
            : "Todos os jogos carregados";
}

// ============================================================
//  TEMA
// ============================================================

function alternarTema() {
    const isLight = document.body.classList.toggle("light");
    localStorage.setItem(STORAGE_KEYS.theme, isLight ? "light" : "dark");
    atualizarRotuloBtnTema();
}

function carregarTema() {
    const tema = localStorage.getItem(STORAGE_KEYS.theme) || "dark";
    document.body.classList.toggle("light", tema === "light");
    atualizarRotuloBtnTema();
}

function atualizarRotuloBtnTema() {
    if (tela.btnTema) {
        tela.btnTema.textContent = document.body.classList.contains("light")
            ? "Modo escuro"
            : "Modo claro";
    }
}

// ============================================================
//  PERSISTÊNCIA — Sessão e Favoritos
// ============================================================

// Lê o usuário logado do localStorage
function obterUsuarioAtual() {
    const stored = localStorage.getItem(STORAGE_KEYS.usuarioAtual);
    return stored ? stored.trim() : null;
}

// Recupera os favoritos do usuário atual
function getFavoritesForCurrentUser() {
    if (!estado.usuarioAtual) return [];
    try {
        const value = localStorage.getItem(`gamer_favorites_${estado.usuarioAtual}`);
        return value ? JSON.parse(value) : [];
    } catch (_) { return []; }
}

// Salva os favoritos do usuário atual
function saveFavoritesForCurrentUser(favoritos) {
    if (estado.usuarioAtual) {
        localStorage.setItem(`gamer_favorites_${estado.usuarioAtual}`, JSON.stringify(favoritos));
    }
}

// Exibe mensagem de erro/sucesso nos formulários de auth
function definirMensagemAutenticacao(message) {
    if (tela.authMessage) {
        tela.authMessage.textContent = message;
    } else if (message) {
        alert(message);
    }
}

// Cria um bloco de mensagem informativa dentro dos grids
function createInfoBox(message) {
    return `<div class="caixa-vazia">${escapeHtml(message)}</div>`;
}

// Fetch com verificação de status HTTP
async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

// Wrapper de auth — traduz erros de rede para mensagens amigáveis
async function requestAuthApi(path, options) {
    try {
        const response = await fetch(`${API_BASE_URL}${path}`, options);
        const data     = await response.json().catch(() => ({}));

        if (!response.ok) {
            const msg = data.mensagem || data.erro || `Erro ${response.status}.`;
            throw new Error(msg);
        }

        return data;
    } catch (error) {
        if (error.message.includes("Failed to fetch")) {
            throw new Error("Servidor offline ou URL incoreta.");
        }
        throw error;
    }
}



// Escapa caracteres especiais para inserção segura em innerHTML
function escapeHtml(value) {
    return String(value)
        .replace(/&/g,  "&amp;")
        .replace(/</g,  "&lt;")
        .replace(/>/g,  "&gt;")
        .replace(/"/g,  "&quot;")
        .replace(/'/g,  "&#039;");
}
