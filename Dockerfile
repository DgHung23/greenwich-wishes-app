# Greenwich Wishes - container image with PostgreSQL support
FROM node:22-alpine

WORKDIR /app

# Cài đặt thư viện dependencies trước để tận dụng Docker cache
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production \
    PORT=8780 \
    DATA_DIR=/data \
    TRUST_PROXY=1

# Volume lưu uploads và dữ liệu
VOLUME /data
EXPOSE 8780

RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node

CMD ["node", "--no-warnings", "server.js"]
