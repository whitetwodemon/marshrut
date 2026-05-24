FROM alpine:3.19

RUN apk add --no-cache mysql-client dcron bash

COPY docker/backup.sh /backup.sh
RUN chmod +x /backup.sh

RUN echo "0 */6 * * * /backup.sh >> /var/log/backup.log 2>&1" | crontab -

CMD ["crond", "-f", "-l", "2"]
