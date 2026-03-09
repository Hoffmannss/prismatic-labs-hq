# 🖥️ Electron Desktop App — Guia Completo

## Instalação de Dependências

```bash
npm install
```

## Desenvolvimento Local

```bash
npm run dev
```

Isso abrirá o app em modo desenvolvimento com DevTools.

## Build para Produção

### Windows (.exe)
```bash
npm run build
```

Saída: `dist/Vendedor IA-Setup-1.0.0.exe`

### Todas as plataformas
```bash
npm run build:all
```

Gera: `.exe` (Windows), `.dmg` (macOS), `.AppImage` (Linux)

## Configurar Auto-Update

### 1. Criar Personal Access Token

1. GitHub → Settings → Developer Settings → Personal Access Tokens
2. Generate new token (classic)
3. Scopes: `repo` (full access)
4. Copiar token

### 2. Adicionar no `.env`

```env
GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

### 3. Publicar release

```bash
npm run publish
```

Isso:
- Gera o build
- Cria release no GitHub
- Faz upload dos binários
- Gera `latest.yml` (metadata para auto-update)

### 4. Testar auto-update

1. Instalar versão 1.0.0
2. Publicar versão 1.0.1
3. App detecta update automaticamente
4. Baixa em background
5. Notifica "Atualização pronta"
6. Ao fechar, instala nova versão

## Ícone Customizado

Substituir `electron/icon.png` por ícone 1024x1024.

**Formato:** PNG com transparência  
**Ferramenta:** Adobe Illustrator, Figma, ou Canva

## Troubleshooting

### "Backend não iniciou"
- Verificar se porta 3456 está livre
- Checar logs: `npm run dev` mostra stdout do backend

### "Update não funciona"
- Verificar se `GH_TOKEN` está correto
- Confirmar que releases são publicados no repo
- Verificar configuração em `electron-builder.yml`

### "App não inicia"
- Deletar `node_modules` e reinstalar
- Verificar Node.js >= 18
- Windows: executar como administrador

## Estrutura de Pastas

```
electron/
├── main.js          # Processo principal (lifecycle, auto-update)
├── preload.js       # Bridge segura (IPC)
├── splash.html      # Tela de carregamento
└── icon.png         # Ícone 1024x1024
```

## Comandos de Atalho

| Comando | Ação |
|---------|------|
| `Ctrl+R` | Reload dashboard |
| `Ctrl+Shift+I` | DevTools (apenas dev) |
| `Ctrl+Q` | Fechar app |

## System Tray

**Duplo clique no ícone:** Abre dashboard  
**Menu:**
- 📊 Abrir Dashboard
- 🚀 Disparar Autopilot
- 🔄 Reiniciar App
- ❌ Sair

## Próximos Passos

- [ ] Gerar ícone profissional
- [ ] Testar build em máquina limpa
- [ ] Configurar code signing (Windows Defender)
- [ ] Criar instalador customizado (NSIS)