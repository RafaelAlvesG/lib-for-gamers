// LIB FOR GAMERS — Backend
// Node.js + Express | Porta: 3333
// Banco de dados MySQL é opcional — funciona sem ele no Vercel (apenas a RAWG API key é necessária)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Redireciona a raiz para o index.html dentro da nova pasta pages
app.get("/", (req, res) => {
  res.redirect("/pages/index.html");
});

// Endpoint para fornecer a chave da API (impedindo que fique no front-end e github)
app.get("/api/config", (req, res) => {
  res.json({ rawgApiKey: process.env.RAWG_API_KEY });
});

// ============================================================
// CONEXÃO AO BANCO DE DADOS (APENAS SE CONFIGURADO NO .ENV)
// ============================================================
const DB_ENABLED = !!process.env.MYSQLHOST;
let db = null;

if (DB_ENABLED) {
  try {
    const mysql = require("mysql2");
    db = mysql.createConnection({
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
      port: Number(process.env.MYSQLPORT) || 3306
    });

    db.connect((err) => {
      if (err) {
        console.error("Erro ao conectar ao banco:", err.message);
        db = null; // Desativa recursos de banco se falhar
      } else {
        console.log(`Conectado ao MySQL em: ${db.config.host}`);
        prepararBanco();
      }
    });
  } catch (e) {
    console.warn("[AVISO] Erro ao carregar o driver do MySQL. Recursos de banco desabilitados.");
    db = null;
  }
} else {
  console.log("[INFO] Rodando em modo RAWG-only (Sem Banco de Dados).");
}

function prepararBanco() {
  if (!db) return;

  // Prepara o banco: cria a tabela de contas e os jogos favoritados
  db.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id       INT AUTO_INCREMENT PRIMARY KEY,
      usuario  VARCHAR(255) UNIQUE NOT NULL,
      email    VARCHAR(255) UNIQUE NOT NULL,
      senha    VARCHAR(255)        NOT NULL,
      favoritos JSON
    )
  `, (err) => {
    if (err) console.error("Erro ao criar tabela 'usuarios':", err.message);
    else console.log("Tabela 'usuarios' pronta.");
  });

  // Tabela de avaliações: guarda os comentários e notas que os usuários publicam
  db.query(`
    CREATE TABLE IF NOT EXISTS avaliacoes (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      usuario    VARCHAR(255)   NOT NULL,
      game_id    INT            NOT NULL,
      game_name  VARCHAR(255),
      nota       DECIMAL(2,1)   NOT NULL,
      comentario TEXT           NOT NULL,
      criado_em  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error("Erro ao criar tabela 'avaliacoes':", err.message);
    else console.log("Tabela 'avaliacoes' pronta.");
  });

  // Atualização do banco: Garante que a coluna 'editado_em' exista para marcar comentários editados
  db.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'avaliacoes'
       AND COLUMN_NAME  = 'editado_em'`,
    (err, rows) => {
      if (err) { console.error("Erro ao verificar coluna editado_em:", err.message); return; }
      if (rows && rows[0] && rows[0].cnt === 0) {
        db.query(
          `ALTER TABLE avaliacoes ADD COLUMN editado_em TIMESTAMP NULL DEFAULT NULL`,
          (err) => {
            if (err) console.error("Erro ao adicionar coluna editado_em:", err.message);
            else console.log("Coluna 'editado_em' adicionada na tabela 'avaliacoes'.");
          }
        );
      } else {
        console.log("Coluna 'editado_em' já existe.");
      }
    }
  );
}

// Middleware para impedir que rotas de banco quebrem se o banco não estiver configurado
function requireDB(req, res, next) {
  if (!db) {
    return res.status(503).json({ erro: "Banco de dados não configurado neste ambiente." });
  }
  next();
}

// ============================================================
//  AUTENTICAÇÃO (Opcional - Requer Banco)
// ============================================================

app.post("/api/cadastrar", requireDB, (req, res) => {
  const usuario = String(req.body.usuario || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const senha = String(req.body.senha || "").trim();

  if (!usuario || !email || !senha) {
    return res.status(400).json({ erro: "Usuário, email e senha são obrigatórios." });
  }

  if (senha.length < 6) {
    return res.status(400).json({ erro: "A senha deve ter no mínimo 6 caracteres." });
  }

  db.query(
    "SELECT id FROM usuarios WHERE email = ? OR usuario = ? LIMIT 1",
    [email, usuario],
    (err, rows) => {
      if (err) return res.status(500).json({ erro: "Erro ao verificar cadastro." });

      if (rows.length > 0) {
        return res.status(409).json({ erro: "Este email ou nome de usuário já está em uso." });
      }

      db.query(
        "INSERT INTO usuarios (usuario, email, senha) VALUES (?, ?, ?)",
        [usuario, email, senha],
        (err, result) => {
          if (err) return res.status(500).json({ erro: "Erro ao salvar usuário." });
          res.status(201).json({ mensagem: "Usuário cadastrado com sucesso!", id: result.insertId });
        }
      );
    }
  );
});

app.post("/api/login", requireDB, (req, res) => {
  const identity = String(req.body.identity || "").trim().toLowerCase();
  const senha = String(req.body.senha || "").trim();

  if (!identity || !senha) {
    return res.status(400).json({ mensagem: "Usuário/email e senha são obrigatórios." });
  }

  db.query(
    "SELECT id, usuario, email FROM usuarios WHERE (email = ? OR usuario = ?) AND senha = ? LIMIT 1",
    [identity, identity, senha],
    (err, rows) => {
      if (err) return res.status(500).json({ mensagem: "Erro interno no servidor." });

      if (rows.length === 0) {
        return res.status(401).json({ mensagem: "Usuário/email ou senha incorretos." });
      }

      res.json({
        sucesso: true,
        mensagem: "Login realizado com sucesso!",
        usuario: rows[0].usuario,
        email: rows[0].email
      });
    }
  );
});

// ============================================================
//  FAVORITOS (Opcional - Requer Banco)
// ============================================================

function findUsuario(usuario, callback) {
  if (!db) return callback(new Error("Sem banco"));
  db.query(
    "SELECT id, favoritos FROM usuarios WHERE email = ? OR usuario = ?",
    [usuario, usuario],
    callback
  );
}

function parseFavoritos(row) {
  try {
    return typeof row.favoritos === "string"
      ? JSON.parse(row.favoritos)
      : (row.favoritos || []);
  } catch (_) { return []; }
}

app.post("/api/favoritos", requireDB, (req, res) => {
  const { usuario, game_id, game_name } = req.body;

  findUsuario(usuario, (err, rows) => {
    if (err || !rows.length) return res.status(400).json({ ok: false });

    const favs = parseFavoritos(rows[0]);

    if (!favs.find(f => f.game_id === game_id)) {
      favs.push({ game_id, game_name });
      db.query(
        "UPDATE usuarios SET favoritos = ? WHERE id = ?",
        [JSON.stringify(favs), rows[0].id],
        () => res.json({ ok: true })
      );
    } else {
      res.json({ ok: true });
    }
  });
});

app.delete("/api/favoritos", requireDB, (req, res) => {
  const { usuario, game_id } = req.body;

  findUsuario(usuario, (err, rows) => {
    if (err || !rows.length) return res.status(400).json({ ok: false });

    const favs = parseFavoritos(rows[0]);
    const antes = favs.length;
    const novosFavs = favs.filter(f => f.game_id !== game_id);

    if (novosFavs.length < antes) {
      db.query(
        "UPDATE usuarios SET favoritos = ? WHERE id = ?",
        [JSON.stringify(novosFavs), rows[0].id],
        () => res.json({ ok: true })
      );
    } else {
      res.json({ ok: true });
    }
  });
});

// ============================================================
//  AVALIAÇÕES (Opcional - Requer Banco)
// ============================================================

app.get("/api/avaliacoes/medias", requireDB, (req, res) => {
  const ids = (req.query.ids || "").split(",").map(Number).filter(Boolean);

  if (!ids.length) return res.json({ medias: {} });

  db.query(
    `SELECT game_id, AVG(nota) AS media, COUNT(*) AS total
     FROM avaliacoes
     WHERE game_id IN (?)
     GROUP BY game_id`,
    [ids],
    (err, rows) => {
      if (err) return res.status(500).json({ erro: "Erro ao buscar médias." });

      const medias = {};
      rows.forEach(r => {
        medias[r.game_id] = {
          media: Math.round(Number(r.media) * 10) / 10,
          total: Number(r.total)
        };
      });

      res.json({ medias });
    }
  );
});

app.get("/api/avaliacoes/:game_id", requireDB, (req, res) => {
  const gameId = Number(req.params.game_id);

  if (!gameId) return res.status(400).json({ erro: "ID de jogo inválido." });

  db.query(
    `SELECT usuario, nota, comentario, criado_em, editado_em
     FROM avaliacoes
     WHERE game_id = ?
     ORDER BY criado_em DESC`,
    [gameId],
    (err, rows) => {
      if (err) return res.status(500).json({ erro: "Erro ao buscar avaliações." });

      const total = rows.length;
      const media = total > 0
        ? Math.round((rows.reduce((sum, r) => sum + Number(r.nota), 0) / total) * 10) / 10
        : null;

      res.json({ avaliacoes: rows, media, total });
    }
  );
});

app.post("/api/avaliacoes", requireDB, (req, res) => {
  const { usuario, game_id, game_name, nota, comentario } = req.body;
  const notaNum = Number(nota);
  const textoComentario = String(comentario || "").trim();

  const notaValida = !isNaN(notaNum) && notaNum >= 0.5 && notaNum <= 5 && (notaNum * 2) % 1 === 0;

  if (!usuario || !game_id || !notaValida || textoComentario.length < 4) {
    return res.status(400).json({
      erro: "Dados inválidos. A nota deve ser de 0,5 a 5 e o comentário deve ter pelo menos 4 caracteres."
    });
  }

  db.query(
    "SELECT id FROM avaliacoes WHERE usuario = ? AND game_id = ? LIMIT 1",
    [usuario, game_id],
    (err, rows) => {
      if (err) return res.status(500).json({ erro: "Erro ao verificar avaliação existente." });

      if (rows.length > 0) {
        db.query(
          "UPDATE avaliacoes SET nota = ?, comentario = ?, game_name = ?, editado_em = NOW() WHERE usuario = ? AND game_id = ?",
          [notaNum, textoComentario, game_name || "", usuario, game_id],
          (err) => {
            if (err) return res.status(500).json({ erro: "Erro ao atualizar avaliação." });
            res.json({ mensagem: "Avaliação atualizada com sucesso!" });
          }
        );
      } else {
        db.query(
          "INSERT INTO avaliacoes (usuario, game_id, game_name, nota, comentario) VALUES (?, ?, ?, ?, ?)",
          [usuario, game_id, game_name || "", notaNum, textoComentario],
          (err) => {
            if (err) return res.status(500).json({ erro: "Erro ao salvar avaliação." });
            res.status(201).json({ mensagem: "Avaliação enviada com sucesso!" });
          }
        );
      }
    }
  );
});

app.delete("/api/avaliacoes", requireDB, (req, res) => {
  const { usuario, game_id } = req.body;

  if (!usuario || !game_id) {
    return res.status(400).json({ erro: "Usuário e game_id são obrigatórios." });
  }

  db.query(
    "DELETE FROM avaliacoes WHERE usuario = ? AND game_id = ?",
    [usuario, Number(game_id)],
    (err, result) => {
      if (err) return res.status(500).json({ erro: "Erro ao deletar avaliação." });
      if (result.affectedRows === 0) return res.status(404).json({ erro: "Avaliação não encontrada." });
      res.json({ mensagem: "Avaliação removida com sucesso!" });
    }
  );
});

// Verificador de saúde do servidor: serve para checar facilmente se ele está online e funcionando.
app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "online", db: !!db });
});

const PORT = process.env.PORT || 3333;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
