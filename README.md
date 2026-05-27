# Lib for Gamers 🎮

Um catálogo web de jogos e plataforma de reviews construída para ajudar jogadores a pesquisarem sobre seus jogos favoritos e avaliá-los. Consome dados atualizados diretamente da [RAWG API](https://rawg.io/apidocs).

O projeto é dividido em uma interface estática (HTML/CSS/JS) e um backend com API REST (Node.js + Express). O banco de dados MySQL é **opcional** — o catálogo e a busca funcionam sem ele, mas login, favoritos e avaliações dependem de um banco configurado.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** Node.js, Express.js, CORS
- **Banco de Dados (opcional):** MySQL2 (Railway)
- **API Externa:** RAWG Video Games Database API

---

## 🚀 Como Executar Localmente

### 1. Requisitos
- Node.js instalado no seu computador.
- Uma chave gratuita da API RAWG ([obtenha aqui](https://rawg.io/apidocs)).
- *(Opcional)* Um servidor MySQL rodando localmente (ex: XAMPP, Laragon) ou na nuvem (Railway, PlanetScale, etc.) para usar login, favoritos e avaliações.

### 2. Configurando as Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto (ao lado do `server.js`). Somente a chave RAWG é obrigatória:

```env
# Obrigatório
RAWG_API_KEY=SUA_CHAVE_RAWG_AQUI

# Opcional — preencha apenas se quiser usar login, favoritos e avaliações
MYSQLHOST=SEU_HOST_MYSQL
MYSQLUSER=SEU_USUARIO_MYSQL
MYSQLPASSWORD=SUA_SENHA_MYSQL
MYSQLDATABASE=SEU_NOME_DO_BANCO
MYSQLPORT=3306
```

> **Atenção:** O arquivo `.env` já está listado no `.gitignore` e **não será enviado ao GitHub**. O servidor cria as tabelas `usuarios` e `avaliacoes` automaticamente na primeira execução com banco configurado.

### 3. Instalando dependências e Rodando o Servidor

```bash
npm install
node server.js
```

### 4. Abrindo a Interface Web
Abra o arquivo `pages/index.html` diretamente no navegador, ou use a extensão **Live Server** no VS Code. O frontend redireciona as chamadas para `http://localhost:3333` automaticamente em ambiente local.

---

## ☁️ Deploy (Hospedagem)

### Opção 1: Vercel (Recomendado para uso sem banco)

O projeto já possui um `vercel.json` configurado para funcionar como serverless no Vercel. **Apenas o catálogo e a busca funcionam nessa configuração** (login, favoritos e avaliações precisam de banco).

1. Faça push do repositório para o GitHub.
2. Acesse [vercel.com](https://vercel.com/) e importe o repositório.
3. Em **Settings > Environment Variables**, adicione:
   - `RAWG_API_KEY` → sua chave da RAWG API
4. Clique em **Deploy**. ✅

> Para habilitar login, favoritos e avaliações no Vercel, adicione também as variáveis `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE` e `MYSQLPORT` apontando para um banco MySQL externo (ex: [Railway](https://railway.app/), [PlanetScale](https://planetscale.com/)).

---

### Opção 2: Railway (Backend + Banco integrados)

O Railway permite rodar o Node.js e o MySQL juntos no mesmo projeto, com variáveis automáticas.

1. Crie uma conta em [railway.app](https://railway.app/).
2. Inicie um novo projeto e adicione o plugin **MySQL** — as credenciais aparecerão em `Variables` automaticamente.
3. Conecte sua conta do GitHub e importe este repositório.
4. Em **Variables**, adicione `RAWG_API_KEY` com sua chave.
5. Crie um domínio em `Settings > Domains` e acesse o site. O Railway instala as dependências e inicia o servidor automaticamente.