FROM node:20-alpine3.20

WORKDIR /app

ARG TIMEZONE
ENV TZ=${TIMEZONE:-"America/Recife"}

RUN apk add --no-cache git
RUN git config --global user.email "admin@colcom.com"
RUN git config --global user.name "admin"

COPY package.json package-lock.json ./
RUN npm install
RUN npm install -g typescript

COPY . .
RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]