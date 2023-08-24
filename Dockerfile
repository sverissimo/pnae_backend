FROM node:20-slim
WORKDIR /home/node/app

USER root
RUN apt-get update -y && apt-get install -y openssl

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

ENV DOCKERIZE_VERSION v0.7.0
RUN apt-get install -y wget \
  && wget -O - https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz | tar xzf - -C /usr/local/bin \
  && apt-get autoremove -yqq --purge wget && rm -rf /var/lib/apt/lists/*

RUN apt-get update \
    && apt-get -f install -y --no-install-recommends \
        wget gnupg fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 libglib2.0-0 \
        fonts-liberation \
        libgtk-3-0 \
        libwayland-client0 \
        xdg-utils \
        libu2f-udev \
        libvulkan1 \
        libnss3 \
        libnspr4 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libdrm2 \
        libxkbcommon0 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libasound2 \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p ~/.cache/puppeteer && chown -R node:node ~/.cache/puppeteer
USER node
RUN npx @puppeteer/browsers install chrome@116  --path ~/.cache/puppeteer

# RUN npm ci --only=production
# COPY package*.json ./
# RUN npm i
#RUN node ./node_modules/puppeteer/install.js

CMD [ "npm", "run", "start:dev" ]
#CMD [ "tail", "-f", "/dev/null" ]
