# Используем pre-built dist/ из репозитория
FROM nginx:alpine
COPY frontend/dist/ /var/www/html/
COPY docker/nginx-app.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
