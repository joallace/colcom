FROM node:20-alpine3.20 AS build

WORKDIR /app

ARG VITE_API_ADDRESS
ENV VITE_API_ADDRESS=$VITE_API_ADDRESS

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

FROM nginx:1.27.1-alpine3.20 AS production

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]