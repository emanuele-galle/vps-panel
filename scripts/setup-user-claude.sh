#!/bin/bash
# Setup Claude Code per terminali utente
# Questo script configura l'ambiente Claude Code per workspace utente

set -e

USER_ID="$1"
WORKSPACE_DIR="$2"

if [ -z "$USER_ID" ] || [ -z "$WORKSPACE_DIR" ]; then
    echo "Uso: $0 <user_id> <workspace_dir>"
    exit 1
fi

# Crea directory workspace se non esiste
mkdir -p "$WORKSPACE_DIR"

# Crea .bashrc personalizzato nel workspace
cat > "$WORKSPACE_DIR/.bashrc" << 'BASHRC_EOF'
# Claude Code Environment for User Workspace

# Basic environment
export PS1='\[\033[01;32m\]\u@vps-panel\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '
export PATH="$HOME/.local/bin:/root/.local/bin:$PATH"
export TERM="xterm-256color"
export COLORTERM="truecolor"

# Claude Code aliases
alias claude='/root/.local/bin/claude'
alias cc='/root/.local/bin/claude'

# Helper per documentazione rapida
claude-help() {
    echo "🤖 Claude Code - Guida Rapida"
    echo ""
    echo "Comandi disponibili:"
    echo "  claude                 - Avvia Claude Code in modalità interattiva"
    echo "  claude <prompt>        - Esegui un prompt diretto"
    echo "  claude --help          - Mostra aiuto completo"
    echo ""
    echo "Esempi:"
    echo "  claude 'analizza questo progetto'"
    echo "  claude 'crea un nuovo componente React per login'"
    echo "  claude 'debug il database connection'"
    echo ""
    echo "📚 Documentazione: https://claude.ai/claude-code"
}

# Benvenuto
echo "🤖 Claude Code è disponibile in questo terminale!"
echo "Digita 'claude' per iniziare o 'claude-help' per la guida rapida"
echo ""

BASHRC_EOF

# Crea directory .claude locale per l'utente (opzionale)
mkdir -p "$WORKSPACE_DIR/.claude"

echo "✅ Workspace Claude Code configurato per utente $USER_ID in $WORKSPACE_DIR"
