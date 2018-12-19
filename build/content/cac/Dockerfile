FROM nginx

ARG REVISION=972f5ac923fbc1e667326fc4c5c50ade3f8e70e2
LABEL remediations.cac.revision=${REVISION}

COPY extract.sh /tmp
COPY default.conf /etc/nginx/conf.d/

RUN set -eux; \
    DEPS='wget \
        ca-certificates'; \
    apt-get update; \
    apt-get install -y --no-install-recommends $DEPS; \
    cd /tmp; \
    bash extract.sh ${REVISION}; \
    mv playbooks /usr/share/nginx/html; \
    rm extract.sh /usr/share/nginx/html/*.html; \
    apt-get purge -y --auto-remove $DEPS
