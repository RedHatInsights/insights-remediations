#----------------------- base -----------------------

FROM registry.access.redhat.com/ubi8/ubi-minimal:8.9-1137 AS base

RUN microdnf module enable nodejs:16 && \
    microdnf install -y jq nodejs --nodocs && \
    microdnf clean all

ENV APP_ROOT=/opt/app-root/src
WORKDIR $APP_ROOT
RUN mkdir -p $APP_ROOT/.npm/{_logs,_cacache} && chgrp -R 0 $APP_ROOT && chmod -R ug+rwX $APP_ROOT

RUN npm install -g npm@8.19.3

#--------------------- packages ---------------------

FROM base AS packages

USER 1001

COPY package.json package-lock.json .npmrc ./

#----------------------- test -----------------------

FROM packages AS test

RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=test

#----------------------- dist -----------------------

FROM packages AS dist

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=test /opt/app-root/src/dist ./

EXPOSE 9002
ENV NODE_ENV=production

CMD [ "sh", "-c", "NODE_EXTRA_CA_CERTS=$(jq -r .tlsCAPath $ACG_CONFIG /dev/null) node --max-http-header-size=16384 src/app.js" ]
