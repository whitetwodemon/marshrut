# Stage 1: Build Vite frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend-src/package*.json ./
RUN npm ci --silent
COPY frontend-src/ ./
RUN npm run build

# Stage 2: Nginx
FROM nginx:alpine
COPY --from=build /app/dist/ /var/www/html/
COPY docker/nginx-app.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
