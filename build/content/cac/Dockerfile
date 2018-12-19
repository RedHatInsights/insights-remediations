FROM registry.access.redhat.com/rhscl/nginx-114-rhel7

ARG REVISION=972f5ac923fbc1e667326fc4c5c50ade3f8e70e2
LABEL remediations.cac.revision=${REVISION}

COPY extract.sh /tmp
COPY default.conf /opt/app-root/etc/nginx.d

RUN set -eux; \
    rmdir /opt/app-root/src/nginx-start; \
    cd /tmp; \
    bash extract.sh ${REVISION}; \
    mv playbooks /opt/app-root/src;

CMD ["/usr/libexec/s2i/run"]
