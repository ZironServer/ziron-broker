FROM node:16.13.0-stretch as build
WORKDIR /usr/app/
COPY . .
RUN npm install
RUN npm run build


FROM node:16.13.0-slim

LABEL description="Ziron broker"

WORKDIR /usr/app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=build /usr/app/dist ./dist

HEALTHCHECK --interval=15s --timeout=15s --start-period=10s \
   CMD node node_modules/ziron-server/dist/healthcheck.js d-8888

EXPOSE 8888

CMD node dist/run.js