#!/bin/bash
set -e

OS="$(uname -s)"
THEMIS_CONTRACT_REPO=${THEMIS_CONTRACT_REPO:-'git@github.com:informalsystems/themis-contract.git'}

unixlike_font_installed() {
  SPEC="$1"
  fc-list ${SPEC} | wc -l | tr -d ' '
}

unixlike_add_path() {
  echo "Attempting to add path: $1"
  rcpath=""
  if [ "${SHELL}" = "/bin/bash" ]; then
    rcpath="${HOME}/.bashrc"
  elif [ "${SHELL}" = "/bin/zsh" ]; then
    rcpath="${HOME}/.zshrc"
  fi

  if [ "${rcpath}" = "" ]; then
    echo "Cannot autodetect shell (only BASH and ZSH are currently supported)"
    exit 1
  fi

  cat "${rcpath}" | grep -q "$1" || \
    echo -e "export PATH=\"$1:\${PATH}\"\n" >> "${rcpath}"
}

install_for_macos() {
  echo "Checking for Homebrew..."
  # See https://stackoverflow.com/a/26759734/1156132
  if ! [ -x "$(command -v brew)" ]; then
    echo "Installing Homebrew..."
    /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
  fi

  echo "Installing requirements through Homebrew..."
  brew install git node@12 pandoc tectonic graphicsmagick ghostscript pandoc-crossref || true
  # Ensure our path is set up correctly to use the freshly installed NodeJS
  unixlike_add_path "/usr/local/opt/node@12/bin"
  export PATH="/usr/local/opt/node@12/bin:${PATH}"

  # Update NPM and install Yarn
  npm i -g npm yarn

  echo "Cloning repository..."
  rm -rf /tmp/themis-contract
  git clone ${THEMIS_CONTRACT_REPO} /tmp/themis-contract

  echo "Uninstalling any old versions of themis-contract..."
  npm uninstall -g themis-contract || true
  yarn global remove themis-contract || true

  echo "Installing themis-contract..."
  cd /tmp/themis-contract && \
  yarn install && \
  yarn global add file:`pwd`

  echo "Installing required fonts..."
  cp /tmp/themis-contract/fonts/Roboto/*.ttf ~/Library/Fonts/
  cp /tmp/themis-contract/fonts/Sacramento/*.ttf ~/Library/Fonts/

  rm -rf /tmp/themis-contract
  echo "Done!"
}

if [ "${OS}" = Darwin ]; then
  install_for_macos
else
  echo "OS \"${OS}\" currently unsupported"
fi
