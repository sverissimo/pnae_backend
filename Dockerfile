FROM node:20-slim
WORKDIR /home/node/app

USER root
RUN apt-get update -y && apt-get install -y openssl

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# RUN apt-get update \
#   && apt-get install -y wget gnupg \
#   && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
#   && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
#   && apt-get update \
#   && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
#   --no-install-recommends \
#   && rm -rf /var/lib/apt/lists/*
# RUN apt-get update \
#   && apt-get install -y wget gnupg fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
#   --no-install-recommends \
#   && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
#   && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
#   && apt-get update \
#   && apt-get install -y google-chrome-stable \
#   --no-install-recommends \
#   && rm -rf /var/lib/apt/lists/*

#RUN chmod -R o+rx /puppeteer/node_modules/puppeteer/.local-chromium
# RUN apt-get install -y ca-certificates wget
# RUN apt-get update && apt-get install gnupg wget -y && \
#   wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
#   sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
#   apt-get update && \
#   apt-get install google-chrome-stable -y --no-install-recommends && \
#   rm -rf /var/lib/apt/lists/*

ENV DOCKERIZE_VERSION v0.7.0
RUN apt-get install -y wget \
  && wget -O - https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz | tar xzf - -C /usr/local/bin \
  && apt-get autoremove -yqq --purge wget && rm -rf /var/lib/apt/lists/*

#----------------------------- TRY THIS NEXT:
#   apt-get install -yqq unzip && \
# wget -O /tmp/chromedriver.zip http://chromedriver.storage.googleapis.com/`curl -sS chromedriver.storage.googleapis.com/LATEST_RELEASE`/chromedriver_linux64.zip && \
# unzip /tmp/chromedriver.zip chromedriver -d /usr/local/bin/

#----------------------------- TRY THIS NEXT:
# RUN apt-get update \
#     && apt-get -f install -y --no-install-recommends \
#         fonts-liberation \
#         libgtk-3-0 \
#         libwayland-client0 \
#         xdg-utils \
#         libu2f-udev \
#         libvulkan1 \
#         libnss3 \
#         libnspr4 \
#         libatk1.0-0 \
#         libatk-bridge2.0-0 \
#         libcups2 \
#         libdrm2 \
#         libxkbcommon0 \
#         libxcomposite1 \
#         libxdamage1 \
#         libxfixes3 \
#         libxrandr2 \
#         libgbm1 \
#         libasound2 \
#     && rm -rf /var/lib/apt/lists/*

#----------------------------- TRY THIS NEXT:
# Add puppeteer.cjs to nest-cli.json oto compile to dist
USER node

CMD [ "npm", "run", "start:dev" ]
#CMD [ "tail", "-f", "/dev/null" ]
