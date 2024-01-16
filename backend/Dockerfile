FROM node:21-alpine3.19

RUN apk --no-cache add git

COPY . .

RUN npm ci

RUN npm install -g forever

CMD ["forever", "-f", "server.ts"]