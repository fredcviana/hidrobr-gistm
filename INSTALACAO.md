# HIDROBR GISTM Manager — Guia de Instalação Local (Windows)

## O que você vai ter rodando

Ao final deste guia, o sistema estará funcionando na sua máquina com:
- Frontend React em http://localhost:5173
- API Node.js em http://localhost:3001
- PostgreSQL (banco de dados) em localhost:5432
- Redis (cache) em localhost:6379
- MinIO (armazenamento de arquivos) em http://localhost:9001
- pgAdmin (interface visual do banco) em http://localhost:5050

---

## PASSO 1 — Instalar Node.js

1. Acesse: https://nodejs.org
2. Clique no botão verde **LTS**
3. Execute o instalador baixado (.msi)
4. Clique em **Next** em todas as telas (padrão está correto)
5. Finalize e feche

**Verificar instalação:** Abra o Prompt de Comando (Win + R → cmd → Enter) e digite:
```
node --version
npm --version
```
Deve aparecer algo como `v20.x.x` e `10.x.x`.

---

## PASSO 2 — Instalar Docker Desktop

1. Acesse: https://www.docker.com/products/docker-desktop
2. Clique em **Download for Windows**
3. Execute o instalador baixado
4. Quando perguntar sobre **WSL 2**, marque a opção e aceite
5. Reinicie o computador se solicitado
6. Após reiniciar, abra o **Docker Desktop** pelo menu Iniciar
7. Aguarde o ícone na bandeja do sistema ficar **verde** (pode demorar 1-2 minutos)

---

## PASSO 3 — Baixar o projeto

Abra o **Git Bash** (instalado com Git) ou o **PowerShell** e execute:

```bash
# Clonar o repositório (substitua pela URL real quando disponível)
git clone https://github.com/hidrobr/gistm-manager.git
cd gistm-manager
```

Se ainda não tiver repositório, descompacte o arquivo ZIP do projeto e abra o terminal na pasta raiz (`hidrobr-gistm`).

---

## PASSO 4 — Subir o banco de dados e serviços

No terminal, dentro da pasta do projeto:

```bash
# Subir PostgreSQL, Redis, MinIO e pgAdmin
docker compose -f infra/docker-compose.dev.yml up -d
```

Aguarde 30-60 segundos. Para verificar se tudo subiu:

```bash
docker compose -f infra/docker-compose.dev.yml ps
```

Todos os serviços devem aparecer com status **running**.

---

## PASSO 5 — Configurar variáveis de ambiente

```bash
# Copiar o arquivo de exemplo
copy apps\api\.env.example apps\api\.env
```

Abra o arquivo `apps/api/.env` em qualquer editor de texto e gere as secrets JWT:

Abra o PowerShell e execute:
```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copie o resultado e cole no campo `JWT_ACCESS_SECRET=` do `.env`.
Execute novamente e cole no `JWT_REFRESH_SECRET=`.

---

## PASSO 6 — Instalar dependências

```bash
# Na pasta raiz do projeto
npm install
```

Aguarde o download de todos os pacotes (pode demorar 2-3 minutos).

---

## PASSO 7 — Criar o banco de dados e inserir dados iniciais

```bash
# Criar todas as tabelas
npm run db:migrate

# Inserir os 18 princípios GISTM e usuários demo
npm run db:seed
```

Se o migrate pedir um nome para a migration, digite: `initial`

---

## PASSO 8 — Iniciar o sistema

```bash
# Iniciar API e frontend simultaneamente
npm run dev
```

Aguarde aparecer as mensagens:
- `🚀 HIDROBR GISTM API em http://localhost:3001`
- `Local: http://localhost:5173/`

---

## PASSO 9 — Acessar o sistema

Abra o navegador e acesse: **http://localhost:5173**

### Credenciais de acesso:

| Perfil | E-mail | Senha |
|--------|--------|-------|
| HIDROBR Admin | admin@hidrobr.com.br | Hidrobr@2025! |
| Consultor HIDROBR | ricardo.mendes@hidrobr.com.br | Hidrobr@2025! |
| Cliente Admin | ana.silva@mineracaoexemplo.com.br | Cliente@2025! |

---

## Ferramentas adicionais

**pgAdmin (interface visual do banco):**
- Acesse: http://localhost:5050
- Login: admin@hidrobr.com.br / hidrobr_dev_2025
- Para conectar ao banco: Add New Server → Host: postgres, Port: 5432, User: hidrobr, Pass: hidrobr_dev_2025

**MinIO Console (gerenciar arquivos):**
- Acesse: http://localhost:9001
- Login: hidrobr_minio / hidrobr_minio_2025

**Prisma Studio (visualizar dados):**
```bash
npm run db:studio
```
Acesse: http://localhost:5555

---

## Resolver problemas comuns

**Porta em uso:** Se aparecer "port already in use", algum serviço está usando a mesma porta.
```bash
# Parar tudo e reiniciar
docker compose -f infra/docker-compose.dev.yml down
docker compose -f infra/docker-compose.dev.yml up -d
```

**Docker não inicia:** Verifique se o Docker Desktop está com o ícone verde na bandeja do sistema antes de executar qualquer comando.

**Erro no npm install:** Feche e reabra o terminal como Administrador.

**Banco não conecta:** Aguarde 30 segundos após subir o Docker e tente novamente.

---

## Parar o sistema

```bash
# Parar API e frontend (Ctrl+C no terminal onde está rodando)

# Parar banco e serviços Docker
docker compose -f infra/docker-compose.dev.yml stop
```

Para reiniciar depois:
```bash
docker compose -f infra/docker-compose.dev.yml start
npm run dev
```
