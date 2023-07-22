FROM node:20-slim
WORKDIR /home/node/app

USER root
RUN apt-get update -y && apt-get install -y openssl

ENV DOCKERIZE_VERSION v0.7.0
RUN apt-get install -y wget \
    && wget -O - https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz | tar xzf - -C /usr/local/bin \
    && apt-get autoremove -yqq --purge wget && rm -rf /var/lib/apt/lists/*

USER node

CMD [ "npm", "run", "start:dev" ]
#CMD [ "tail", "-f", "/dev/null" ]
