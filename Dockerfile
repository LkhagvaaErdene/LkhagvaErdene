# One container = the app + the identification API (same origin, no CORS needed).
FROM node:22-alpine
WORKDIR /app
COPY server ./server
COPY src ./src
ENV NODE_ENV=production PORT=8787 TRUST_PROXY=1
EXPOSE 8787
CMD ["node", "server/server.js"]
