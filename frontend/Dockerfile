FROM node:20-alpine3.20

WORKDIR /app

ARG VITE_API_ADDRESS
ENV VITE_API_ADDRESS=$VITE_API_ADDRESS

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build