FROM rust:1-slim-buster

RUN apt update && \
    apt install -y libfontconfig1-dev libgraphite2-dev libharfbuzz-dev libicu-dev \
        libssl-dev zlib1g-dev build-essential git openssh-client pandoc \
        graphicsmagick ghostscript curl

RUN cargo install tectonic

# Install NodeJS 12
RUN curl -sL https://deb.nodesource.com/setup_12.x | bash - && \
    apt install -y nodejs

# Install Keybase executable
RUN cd /tmp && \
    curl --remote-name https://prerelease.keybase.io/keybase_amd64.deb && \
    apt install -y ./keybase_amd64.deb

# Install Themis Contract
RUN cd /tmp && \
    git clone https://github.com/informalsystems/themis-contract.git && \
    cd themis-contract && \
    npm i && npm i -g
