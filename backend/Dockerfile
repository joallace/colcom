FROM node:24-alpine

WORKDIR /app

ARG TZ
ENV TZ=$TZ

RUN apk add --no-cache git tzdata
RUN git config --global user.email "admin@colcom.com"
RUN git config --global user.name "admin"

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]