FROM node:22.23.4-alpine

RUN apk add --no-cache libc6-compat

WORKDIR /app
ARG NEXTAUTH_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm install --prefer-offline

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
