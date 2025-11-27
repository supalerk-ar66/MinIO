############################
# Stage 1: Build
############################
FROM node:22-alpine AS builder

WORKDIR /app

# ติดตั้ง dependencies
COPY package*.json ./
RUN npm install

# คัดลอก source code แล้ว build
COPY . .
RUN npm run build

############################
# Stage 2: Runtime
############################
FROM node:22-alpine

WORKDIR /app

# ติดตั้งเฉพาะ production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# ดึงไฟล์ build จาก stage แรก
COPY --from=builder /app/.output ./.output

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
