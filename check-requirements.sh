#!/usr/bin/env bash
set -u

INSTALL=0
SKIP_NPM_INSTALL=0
YES=0
MIN_NODE_MAJOR=18
MIN_PYTHON_MAJOR=3
MIN_PYTHON_MINOR=8
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FAILURES=()
WARNINGS=()

for arg in "$@"; do
  case "$arg" in
    --install) INSTALL=1 ;;
    --skip-npm-install) SKIP_NPM_INSTALL=1 ;;
    --yes|-y) YES=1 ;;
    --help|-h)
      cat <<'HELP'
SansqritPy requirements checker

Usage:
  bash ./bootstrap/check-requirements.sh
  bash ./bootstrap/check-requirements.sh --install

Options:
  --install           Install missing dependencies where possible.
  --skip-npm-install  Do not run npm install/npm ci.
  --yes, -y           Do not prompt before install commands.
HELP
      exit 0
      ;;
    *) echo "Unknown argument: $arg"; exit 2 ;;
  esac
done

section() {
  printf "\n== %s ==\n" "$1"
}

ok() {
  printf "[OK] %s\n" "$1"
}

missing() {
  printf "[MISSING] %s\n" "$1"
}

fail() {
  printf "[FAIL] %s\n" "$1"
  FAILURES+=("$1")
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

version_number() {
  printf "%s" "$1" | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1
}

version_major() {
  printf "%s" "$1" | cut -d. -f1
}

version_minor() {
  printf "%s" "$1" | cut -d. -f2
}

version_at_least() {
  local version="$1"
  local want_major="$2"
  local want_minor="${3:-0}"
  local major minor
  major="$(version_major "$version")"
  minor="$(version_minor "$version")"
  [[ -n "$major" && -n "$minor" ]] || return 1
  if (( major > want_major )); then return 0; fi
  if (( major == want_major && minor >= want_minor )); then return 0; fi
  return 1
}

confirm_install() {
  local tool="$1"
  if (( YES == 1 )); then return 0; fi
  printf "Install %s now? Type y to continue: " "$tool"
  read -r answer
  [[ "$answer" =~ ^([yY]|[yY][eE][sS])$ ]]
}

detect_manager() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    if has_command brew; then echo "brew"; return; fi
  fi
  if has_command apt-get; then echo "apt"; return; fi
  if has_command dnf; then echo "dnf"; return; fi
  if has_command yum; then echo "yum"; return; fi
  if has_command pacman; then echo "pacman"; return; fi
  if has_command zypper; then echo "zypper"; return; fi
  echo ""
}

sudo_cmd() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

install_packages() {
  local label="$1"
  shift
  if (( INSTALL == 0 )); then
    missing "$label is not installed. Re-run with --install to install it."
    return 0
  fi
  confirm_install "$label" || { missing "$label installation skipped."; return 0; }
  local manager
  manager="$(detect_manager)"
  case "$manager" in
    brew)
      brew install "$@"
      ;;
    apt)
      sudo_cmd apt-get update
      sudo_cmd apt-get install -y "$@"
      ;;
    dnf)
      sudo_cmd dnf install -y "$@"
      ;;
    yum)
      sudo_cmd yum install -y "$@"
      ;;
    pacman)
      sudo_cmd pacman -Sy --noconfirm "$@"
      ;;
    zypper)
      sudo_cmd zypper install -y "$@"
      ;;
    *)
      fail "No supported package manager found for $label."
      return 1
      ;;
  esac
}

install_node() {
  local manager
  manager="$(detect_manager)"
  if (( INSTALL == 0 )); then
    missing "Node.js is not installed. Re-run with --install to install it."
    return
  fi
  confirm_install "Node.js 18+" || { missing "Node.js installation skipped."; return; }
  case "$manager" in
    brew) brew install node ;;
    apt)
      if has_command curl; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo_cmd bash -
        sudo_cmd apt-get install -y nodejs
      else
        sudo_cmd apt-get update
        sudo_cmd apt-get install -y nodejs npm
      fi
      ;;
    dnf) sudo_cmd dnf install -y nodejs npm ;;
    yum) sudo_cmd yum install -y nodejs npm ;;
    pacman) sudo_cmd pacman -Sy --noconfirm nodejs npm ;;
    zypper) sudo_cmd zypper install -y nodejs npm ;;
    *) fail "No supported package manager found for Node.js." ;;
  esac
}

ensure_git() {
  section "Git"
  if has_command git; then
    ok "$(git --version) ($(command -v git))"
  else
    install_packages "Git" git
  fi
}

ensure_node() {
  section "Node.js"
  if has_command node; then
    local raw version
    raw="$(node --version)"
    version="$(version_number "$raw")"
    if version_at_least "$version" "$MIN_NODE_MAJOR" 0; then
      ok "Node.js $raw ($(command -v node))"
    else
      fail "Node.js $raw found, but SansqritPy requires Node.js >= $MIN_NODE_MAJOR."
    fi
  else
    install_node
  fi

  if has_command npm; then
    ok "npm $(npm --version) ($(command -v npm))"
  else
    fail "npm was not found. It is normally installed with Node.js."
  fi
}

ensure_python() {
  section "Python"
  local candidate raw version
  for candidate in python3 python; do
    if has_command "$candidate"; then
      raw="$("$candidate" --version 2>&1 || true)"
      version="$(version_number "$raw")"
      if version_at_least "$version" "$MIN_PYTHON_MAJOR" "$MIN_PYTHON_MINOR"; then
        ok "$raw ($(command -v "$candidate"))"
        return
      fi
      WARNINGS+=("$candidate exists but version is $raw")
    fi
  done

  local manager
  manager="$(detect_manager)"
  case "$manager" in
    brew) install_packages "Python $MIN_PYTHON_MAJOR.$MIN_PYTHON_MINOR+" python ;;
    apt|dnf|yum|pacman|zypper) install_packages "Python $MIN_PYTHON_MAJOR.$MIN_PYTHON_MINOR+" python3 python3-pip ;;
    *) fail "Python $MIN_PYTHON_MAJOR.$MIN_PYTHON_MINOR+ was not found." ;;
  esac
}

ensure_rust() {
  section "Rust"
  if has_command rustup; then
    ok "$(rustup --version | head -n 1) ($(command -v rustup))"
  elif (( INSTALL == 1 )); then
    confirm_install "Rust toolchain" || { missing "Rust installation skipped."; return; }
    if ! has_command curl; then install_packages "curl" curl; fi
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    # shellcheck source=/dev/null
    [[ -f "$HOME/.cargo/env" ]] && source "$HOME/.cargo/env"
  else
    missing "rustup is missing. Re-run with --install to install Rust."
  fi

  if has_command rustc; then ok "$(rustc --version)"; else missing "rustc is not available yet."; fi
  if has_command cargo; then ok "$(cargo --version)"; else missing "cargo is not available yet."; fi

  if has_command rustup; then
    if rustup target list --installed | grep -qx "wasm32-unknown-unknown"; then
      ok "Rust target wasm32-unknown-unknown installed"
    elif (( INSTALL == 1 )); then
      rustup target add wasm32-unknown-unknown || fail "Failed to install wasm32-unknown-unknown."
    else
      missing "Rust target wasm32-unknown-unknown is missing. Re-run with --install to add it."
    fi
  fi
}

ensure_wasm_pack() {
  section "wasm-pack"
  if has_command wasm-pack; then
    ok "$(wasm-pack --version) ($(command -v wasm-pack))"
  elif (( INSTALL == 1 )) && has_command cargo; then
    confirm_install "wasm-pack" || { missing "wasm-pack installation skipped."; return; }
    cargo install wasm-pack || fail "Failed to install wasm-pack."
  else
    missing "wasm-pack is missing. Re-run with --install after Rust/Cargo are available."
  fi
}

ensure_node_dependencies() {
  section "Project npm dependencies"
  if (( SKIP_NPM_INSTALL == 1 )); then
    missing "Skipped npm dependency install because --skip-npm-install was provided."
    return
  fi
  if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
    missing "No package.json found at $PROJECT_ROOT"
    return
  fi
  if [[ -d "$PROJECT_ROOT/node_modules" ]]; then
    ok "node_modules exists"
    return
  fi
  if (( INSTALL == 0 )); then
    missing "node_modules is missing. Re-run with --install to run npm install."
    return
  fi
  if ! has_command npm; then
    fail "Cannot install npm dependencies because npm is missing."
    return
  fi
  (
    cd "$PROJECT_ROOT" || exit 1
    if [[ -f package-lock.json ]]; then
      npm ci
    else
      npm install
    fi
  ) || fail "npm dependency install failed."
}

printf "SansqritPy system requirements check\n"
printf "Project root: %s\n" "$PROJECT_ROOT"
if (( INSTALL == 1 )); then printf "Install mode: enabled\n"; else printf "Install mode: check only\n"; fi

ensure_git
ensure_node
ensure_python
ensure_rust
ensure_wasm_pack
ensure_node_dependencies

if (( ${#WARNINGS[@]} > 0 )); then
  section "Warnings"
  for warning in "${WARNINGS[@]}"; do printf -- "- %s\n" "$warning"; done
fi

section "Summary"
if (( ${#FAILURES[@]} > 0 )); then
  for failure in "${FAILURES[@]}"; do printf -- "- %s\n" "$failure"; done
  printf "Requirements check completed with failures.\n"
  exit 1
fi

ok "Requirements check completed."
printf "Run the app with: npm start\n"
