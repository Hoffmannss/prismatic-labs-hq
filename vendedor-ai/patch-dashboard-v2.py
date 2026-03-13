#!/usr/bin/env python3
"""
patch-dashboard-v2.py
Aplica 4 mudanças no dashboard.html:
  1. Remove Monitor do nav sidebar
  2. Move Monitor (Notion Sync + Live Log) para dentro do Autopilot
  3. Remove section-monitor duplicada
  4. Adiciona negocio ao pageTitles + corrige listener auto-check
"""
import sys, re

FILE = 'public/dashboard.html'

try:
    content = open(FILE, 'r', encoding='utf-8').read()
except FileNotFoundError:
    print(f'ERRO: {FILE} não encontrado. Rode este script dentro de /root/vendedor-ai/')
    sys.exit(1)

original = content
changes = 0

# ── 1. Remove Monitor do nav ──────────────────────────────────────────────────
OLD1 = '''            <div class="nav-item" data-section="monitor">
                <span class="nav-icon"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span>
                <span>Monitor</span>
            </div>

            <span class="nav-section-label">Configurações</span>'''
NEW1 = '            <span class="nav-section-label">Configurações</span>'

if OLD1 in content:
    content = content.replace(OLD1, NEW1, 1)
    changes += 1
    print('✓ 1. Monitor removido do nav')
else:
    print('⚠ 1. Nav Monitor não encontrado (já aplicado ou diff no arquivo)')

# ── 2. Insere Monitor dentro do Autopilot ────────────────────────────────────
ANCHOR2 = '''                        <button class="btn btn-ghost" onclick="runSingleProfile()">
                            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            Analisar Perfil
                        </button>
                    </div>
                </div>
            </div>

            <!-- ══════════ TRACKER ══════════ -->'''

MONITOR_BLOCK = '''                        <button class="btn btn-ghost" onclick="runSingleProfile()">
                            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            Analisar Perfil
                        </button>
                    </div>
                </div>

                <!-- ── Monitor de Pipeline ── -->
                <div class="card" style="margin-top:16px">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Notion Sync</div>
                            <div class="card-desc">Sincroniza o CRM local com o database no Notion</div>
                        </div>
                        <div style="display:flex;gap:8px;align-items:center">
                            <span id="notionStatusBadge" class="pill pill-off" style="font-size:11px">
                                <span class="pill-dot"></span>
                                <span id="notionStatusText">Verificando...</span>
                            </span>
                            <button class="btn btn-sm btn-ghost" onclick="checkNotionStatus()">
                                <svg viewBox="0 0 24 24" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                Verificar
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="runNotionSync()">
                                <svg viewBox="0 0 24 24" width="14" height="14"><polyline points="5 12 12 5 19 12"/><polyline points="5 19 12 12 19 19"/></svg>
                                Sync Agora
                            </button>
                        </div>
                    </div>
                    <div class="card-body" id="notionStatusOutput" style="display:none">
                        <pre id="notionStatusPre" style="font-size:11px;color:var(--text2);margin:0;white-space:pre-wrap;line-height:1.6"></pre>
                    </div>
                </div>

                <div class="card" style="margin-top:16px">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Monitor de Pipeline</div>
                            <div class="card-desc">Logs em tempo real — autopilot, notion-sync, dashboard</div>
                        </div>
                        <div style="display:flex;gap:8px;align-items:center">
                            <span id="streamStatus" class="pill pill-off" style="font-size:11px">
                                <span class="pill-dot"></span>
                                <span id="streamStatusText">Desconectado</span>
                            </span>
                            <select id="logFilter" class="form-select" style="width:auto;padding:5px 8px;font-size:12px" onchange="applyLogFilter()">
                                <option value="all">Todos</option>
                                <option value="autopilot">Autopilot</option>
                                <option value="notion-sync">Notion Sync</option>
                                <option value="error">Erros</option>
                            </select>
                            <button class="btn btn-sm btn-ghost" onclick="clearLogs()">Limpar</button>
                            <button class="btn btn-sm btn-ghost" id="streamToggleBtn" onclick="toggleStream()">
                                <svg viewBox="0 0 24 24" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                Conectar
                            </button>
                        </div>
                    </div>
                    <div class="card-body" style="padding:0">
                        <div id="logContainer" style="
                            background:#0a0a0f;
                            border-radius:0 0 12px 12px;
                            height:480px;
                            overflow-y:auto;
                            padding:14px 16px;
                            font-family:'SF Mono','Fira Code','Consolas',monospace;
                            font-size:12px;
                            line-height:1.7;
                        ">
                            <div style="color:var(--text3);text-align:center;padding:40px 0">
                                Clique em <strong style="color:var(--text)">Conectar</strong> para iniciar o stream de logs em tempo real
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ══════════ TRACKER ══════════ -->'''

if ANCHOR2 in content:
    content = content.replace(ANCHOR2, MONITOR_BLOCK, 1)
    changes += 1
    print('✓ 2. Monitor inserido dentro do Autopilot')
else:
    print('⚠ 2. Anchor de inserção não encontrado (já aplicado?)')

# ── 3. Remove section-monitor original (agora duplicada) ─────────────────────
# Padrão: desde o comentário até o fechamento da div
PATTERN3 = re.compile(
    r'\s*<!-- ═+\s*MONITOR DE PIPELINE\s*═+ -->\s*'
    r'<div id="section-monitor"[^>]*>.*?</div>\s*\n'
    r'\s*\n\s*<!-- ═+\s*MEU NEGÓCIO',
    re.DOTALL
)
match3 = PATTERN3.search(content)
if match3:
    replacement3 = '\n\n            <!-- ══════════ MEU NEGÓCIO'
    content = content[:match3.start()] + replacement3 + content[match3.end() - len('<!-- ══════════ MEU NEGÓCIO'):]
    changes += 1
    print('✓ 3. section-monitor original removida')
else:
    # Fallback: simples string match
    OLD3_START = '            <!-- ══════════ MONITOR DE PIPELINE ══════════ -->'
    OLD3_END   = '            <!-- ══════════ MEU NEGÓCIO ══════════ -->'
    idx_start = content.find(OLD3_START)
    idx_end   = content.find(OLD3_END)
    if idx_start != -1 and idx_end != -1 and idx_start < idx_end:
        content = content[:idx_start] + content[idx_end:]
        changes += 1
        print('✓ 3. section-monitor original removida (fallback)')
    else:
        print('⚠ 3. section-monitor não encontrada (já aplicado?)')

# ── 4a. pageTitles: adiciona negocio ─────────────────────────────────────────
OLD4 = "    stats:    'Análise',\n    guide:    'Como Usar'"
NEW4 = "    stats:    'Análise',\n    negocio:  'Meu Negócio',\n    guide:    'Como Usar'"

if OLD4 in content:
    content = content.replace(OLD4, NEW4, 1)
    changes += 1
    print('✓ 4a. negocio adicionado ao pageTitles')
elif "negocio:  'Meu Negócio'" in content:
    print('✓ 4a. negocio já estava no pageTitles')
else:
    print('⚠ 4a. pageTitles não encontrado — verifique manualmente')

# ── 4b. Listener auto-check: monitor → autopilot ─────────────────────────────
OLD4B = "if (item.dataset.section === 'monitor') {"
NEW4B = "if (item.dataset.section === 'autopilot') {"

if OLD4B in content:
    content = content.replace(OLD4B, NEW4B, 1)
    changes += 1
    print('✓ 4b. Listener Notion auto-check: monitor → autopilot')
elif NEW4B in content:
    print('✓ 4b. Listener já apontava para autopilot')
else:
    print('⚠ 4b. Listener não encontrado')

# ── Salvar ────────────────────────────────────────────────────────────────────
if content != original:
    open(FILE, 'w', encoding='utf-8').write(content)
    print(f'\n✅ Patch aplicado — {changes} mudança(s). Rode: pm2 restart vendedor-dashboard')
else:
    print('\nℹ️  Nenhuma mudança necessária — patch já estava aplicado.')
