#!/bin/bash
set -e

OS="$(uname -s)"

unixlike_font_installed() {
  SPEC="$1"
  fc-list ${SPEC} | wc -l | tr -d ' '
}

install_for_macos() {
  echo "Checking for Homebrew..."
  # See https://stackoverflow.com/a/26759734/1156132
  if ! [ -x "$(command -v brew)" ]; then
    echo "Installing Homebrew..."
    /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
  fi

  echo "Installing requirements through Homebrew..."
  brew install git node@12 pandoc tectonic graphicsmagick ghostscript || true
  # Update NPM and install Yarn
  npm i -g npm yarn

  echo "Cloning repository..."
  rm -rf /tmp/neat-contract
  git clone git@github.com:informalsystems/neat-contract.git /tmp/neat-contract

  echo "Uninstalling any old versions of neat-contract..."
  npm uninstall -g neat-contract || true
  yarn global remove neat-contract || true

  echo "Installing neat-contract..."
  cd /tmp/neat-contract && \
  yarn install && \
  yarn global add file:`pwd`

  echo "Installing required fonts..."
  cp /tmp/neat-contract/fonts/Roboto/*.ttf ~/Library/Fonts/
  cp /tmp/neat-contract/fonts/Sacramento/*.ttf ~/Library/Fonts/

  rm -rf /tmp/neat-contract
  echo "Done!"
}

if [ "${OS}" = Darwin ]; then
  install_for_macos
else
  echo "OS \"${OS}\" currently unsupported"
fi
