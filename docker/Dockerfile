FROM node:22-bookworm

RUN set -ex && \
    apt-get update && \
    apt-get -y upgrade && \
    apt-get -y install \
    libnss3 \
    libgtkextra-dev \
    libgconf2-dev \
    libasound2 \
    libxtst-dev \
    libxss1 \
    libgtk-3-0 \
    libdrm2 \
    libgbm1 \
    libcanberra-gtk* \
    fonts-noto-cjk \
    gosu \
    --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
COPY . /home/node/app
RUN mv /home/node/app/docker/entrypoint.sh /usr/local/sbin && \
    chown root:root /usr/local/sbin/entrypoint.sh && \
    chmod 0755 /usr/local/sbin/entrypoint.sh && \
    mkdir /mnt/data && \
    chown -R node:node /home/node/app

USER node
WORKDIR /home/node/app
RUN npm install

USER root
WORKDIR /root
RUN chown root:root /home/node/app/node_modules/electron/dist/chrome-sandbox && \
    chmod 4755 /home/node/app/node_modules/electron/dist/chrome-sandbox
ENTRYPOINT ["/usr/local/sbin/entrypoint.sh"]
