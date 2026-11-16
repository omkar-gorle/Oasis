FROM node:22-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    unoconv \
    ffmpeg \
    imagemagick \
    curl \
    ghostscript \
    nano \
    && rm -rf /var/lib/apt/lists/*

RUN sed -i 's/<policy domain="coder" rights="none" pattern="PDF" \/>//g' /etc/ImageMagick-6/policy.xml

COPY package*.json ./
RUN npm ci

COPY . .
RUN mkdir -p /app/src/storage/files /app/src/storage/temp /app/src/public/thumbnail && chown -R node:node /app
USER node
EXPOSE 8000

CMD ["npm","start"]