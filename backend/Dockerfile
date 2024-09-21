FROM node:20-alpine3.20

ARG TIMEZONE

# RUN apk add --no-cache tzdata git

ENV TZ=${TIMEZONE:-"America/Recife"}

# Install app dependencies
COPY package.json ./
RUN npm install
RUN npm install -g typescript

# Copy the rest of the app
COPY . .

# Build TypeScript into JavaScript
RUN npm run build

# Expose the port on which the app runs
EXPOSE 4000

# Start the application
CMD ["npm", "start"]