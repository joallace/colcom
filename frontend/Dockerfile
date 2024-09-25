FROM node:20-alpine3.20 AS builder

WORKDIR /app

ARG VITE_API_ADDRESS
ENV VITE_API_ADDRESS=$VITE_API_ADDRESS

COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

EXPOSE 80

CMD ["npm", "run", "preview", "--", "--host"]