FROM node:22-alpine
RUN npm install -g pnpm@11.5.2
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build
CMD ["node", "dist/main.js"]