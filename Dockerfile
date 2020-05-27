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

# Add our code
COPY . /src/

# Install Themis Contract
RUN cd /src && \
    npm i && npm i -g && \
    rm -rf node_modules/

WORKDIR /contracts

ENTRYPOINT [ "/usr/bin/themis-contract" ]
CMD [ "help" ]
