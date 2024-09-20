FROM node:20-alpine3.20 AS builder

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
RUN yarn install

# Copy the rest of the app and build
COPY . .
RUN yarn build

# # Serve the app with a lightweight web server (nginx)
# FROM nginx:1.27.1-alpine AS production

# # Copy built files from previous stage
# COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["npm", "run", "preview", "--", "--host"]
