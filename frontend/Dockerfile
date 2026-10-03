FROM node:24-alpine AS build

WORKDIR /app

ARG VITE_API_ADDRESS
ENV VITE_API_ADDRESS=$VITE_API_ADDRESS

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.30-alpine-slim AS production

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]