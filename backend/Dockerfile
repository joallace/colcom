FROM node:20-alpine3.20

ARG TIMEZONE

# RUN apk add --no-cache tzdata git

ENV TZ=${TIMEZONE:-"America/Recife"}

# Install app dependencies
COPY package.json yarn.lock ./
RUN yarn install

# Copy the rest of the app
COPY . .

# Build TypeScript into JavaScript
RUN yarn build

# Expose the port on which the app runs
EXPOSE 4000

# Start the application
CMD ["yarn", "start"]