#!/bin/bash
set -e

OS="$(uname -s)"

unixlike_font_installed() {
  SPEC="$1"
  fc-list ${SPEC} | wc -l | tr -d ' '
}

install_for_macos() {
  echo "Installing requirements through Homebrew..."
  brew install node@12 pandoc tectonic graphicsmagick ghostscript || true
  # Update NPM and install Yarn
  npm i -g npm yarn

  echo "Cloning repository..."
  git clone git@github.com:informalsystems/neat-contract.git /tmp/neat-contract

  echo "Uninstalling any old versions of neat-contract..."
  npm uninstall -g neat-contract

  echo "Installing neat-contract..."
  cd /tmp/neat-contract && \
  yarn install && \
  yarn global add file:`pwd`

  echo "Checking font availability..."
  HELVETICA=$(unixlike_font_installed "Helvetica:style=Regular")
  SACRAMENTO=$(unixlike_font_installed "Sacramento:style=Regular")

  if [ $HELVETICA -eq 0 ]; then
    echo "Missing font: Helvetica"
  else
    echo "Helvetica installed!"
  fi
  if [ $SACRAMENTO -eq 0 ]; then
    echo "Missing font: Sacramento (can be downloaded from https://fonts.google.com/specimen/Sacramento)"
  else
    echo "Sacramento installed!"
  fi
}

if [ "${OS}" = Darwin ]; then
  install_for_macos
else
  echo "OS \"${OS}\" currently unsupported"
fi
