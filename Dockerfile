FROM node:20-slim
WORKDIR /home/node/app

USER root
ENV DOCKERIZE_VERSION v0.7.0

RUN apt-get update -y && \
    apt-get install -y openssl wget && \
    wget -O - https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz | tar xzf - -C /usr/local/bin && \
    apt-get autoremove -yqq --purge wget && \
    rm -rf /var/lib/apt/lists/*

COPY ./lib/wkhtmltox_0.12.6.1-3.bookworm_amd64.deb /home/node/app/lib/wkhtmltox_0.12.6.1-3.bookworm_amd64.deb
RUN apt-get update && \
    apt-get install -y /home/node/app/lib/wkhtmltox_0.12.6.1-3.bookworm_amd64.deb && \
    rm -rf /var/lib/apt/lists/* /home/node/app/lib/wkhtmltox_0.12.6.1-3.bookworm_amd64.deb

USER node
CMD [ "npm", "run", "start:dev" ]
#CMD [ "tail", "-f", "/dev/null" ]
