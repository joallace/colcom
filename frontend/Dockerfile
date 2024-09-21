FROM node:20-alpine3.20 AS builder

WORKDIR /app

ARG VITE_API_ADDRESS
ENV VITE_API_ADDRESS=$VITE_API_ADDRESS

COPY package.json ./
RUN yarn install

COPY . .
RUN yarn build

EXPOSE 80

CMD ["npm", "run", "preview", "--", "--host"]
