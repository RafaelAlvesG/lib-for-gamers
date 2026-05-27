# Lib for Gamers

Um catálogo web de jogos moderno, responsivo e de alta performance que consome dados em tempo real diretamente da [RAWG Video Games Database API](https://rawg.io/apidocs).

A aplicação conta com um design escuro premium (glassmorphism), animações suaves e um sistema de backend robusto projetado para se adaptar dinamicamente ao ambiente de hospedagem.

---

## Diferencial de Engenharia: Railway vs. Vercel

### O Problema Original
O projeto foi inicialmente projetado para rodar no **Railway** integrado a um banco de dados relacional **MySQL**. O backend conectava-se de forma obrigatória ao MySQL durante a inicialização usando as credenciais providas pelo Railway.

Ao subir a aplicação no **Vercel** (um ambiente Serverless sem banco de dados integrado por padrão):
1. O servidor tentava a conexão com o banco ausente, resultando em um erro fatal e **travando o backend**.
2. Com o backend travado, a rota de segurança `/api/config` ficava inacessível.
3. Consequentemente, a interface web não conseguia obter a chave secreta da API (`RAWG_API_KEY`), fazendo com que o catálogo ficasse **totalmente em branco** na tela do usuário.

### A Solução Implementada
O código em `server.js` foi refatorado para funcionar em **modo híbrido inteligente**. O banco de dados MySQL agora é **100% opcional**:
* **Modo Sem Banco (Padrão Vercel):** O servidor detecta a ausência de variáveis do MySQL, ignora a inicialização da conexão e ativa o **modo RAWG-only**. A busca, os filtros e a página de detalhes funcionam perfeitamente. Funcionalidades dependentes do banco (login e avaliações) são interceptadas e desabilitadas com respostas limpas de status `503 Service Unavailable`, garantindo que o app **nunca quebre**.
* **Modo Com Banco (Habilitado local ou Railway):** Conecta automaticamente ao MySQL e habilita toda a persistência de contas de usuários, favoritos e sistema de comentários/avaliações.

---

## Funcionalidades Principais

* **Busca Inteligente:** Pesquisa instantânea de jogos por nome.
* **Filtros Dinâmicos:** Filtragem de catálogo completa por gêneros de jogos.
* **Ordenação Personalizada:** Ordenação rápida por popularidade, nota do Metacritic, data de lançamento e nota dos usuários.
* **Página de Detalhes:** Informações robustas incluindo capturas de tela (screenshots), nota oficial, resumo do jogo em português, plataformas e links oficiais das lojas para compra.
* **Design Premium:** Interface escura moderna com elementos transparentes (glassmorphism), suporte nativo a temas e transições suaves.

---

## Como Rodar este Projeto Localmente

### 1. Pré-requisitos
* Ter o **Node.js** instalado na sua máquina.
* Ter uma chave de API gratuita da RAWG ([cadastre-se e gere uma aqui](https://rawg.io/apidocs)).

### 2. Configurando o Ambiente
Crie um arquivo `.env` na raiz do projeto (este arquivo já está no `.gitignore` e não vai para o repositório por segurança):

```env
# Chave da API (Obrigatória para o catálogo)
RAWG_API_KEY=sua_chave_secreta_da_rawg_aqui

# Configuração do MySQL (Opcional - Ativa o login, favoritos e avaliações)
MYSQLHOST=seu_host_do_banco
MYSQLUSER=seu_usuario_do_banco
MYSQLPASSWORD=sua_senha_do_banco
MYSQLDATABASE=nome_do_seu_banco
MYSQLPORT=3306
```

### 3. Executando o Servidor
Abra o terminal na pasta do projeto e execute:
```bash
# Instala as dependências leves necessárias
npm install

# Inicia o servidor local
node server.js
```
O servidor estará rodando em: `http://localhost:3333`

### 4. Visualizando o Frontend
Abra o arquivo `pages/index.html` diretamente no seu navegador ou utilizando a extensão **Live Server** no seu editor de código.

---

## Deploy no Vercel (Passo a Passo)

1. Suba o projeto para o seu repositório no **GitHub**.
2. Acesse seu painel da [Vercel](https://vercel.com/) e importe o repositório.
3. Antes de clicar em Deploy, vá na seção **Environment Variables** e adicione a variável secreta:
   * **Key:** `RAWG_API_KEY`
   * **Value:** *(A sua chave da RAWG API)*
4. *(Opcional)* Se no futuro desejar ativar o login e avaliações na Vercel, adicione também as chaves `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE` e `MYSQLPORT` apontando para um MySQL externo (como o do **Railway**).
5. Clique em **Deploy**. A Vercel lerá o arquivo `vercel.json` na raiz e configurará as rotas estáticas e serverless automaticamente! ✅