#----------------------- base -----------------------

FROM registry.redhat.io/ubi8/ubi-minimal:8.7-1049 AS base

RUN microdnf module enable nodejs:16 && \
    microdnf install -y nodejs --nodocs && \
    microdnf clean all

ENV APP_ROOT=/opt/app-root/src
WORKDIR $APP_ROOT
RUN chgrp -R 0 $APP_ROOT && chmod -R g+rwX $APP_ROOT

RUN npm install -g npm@8.19.3
RUN chown -R 1001:0 ".npm"

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

CMD [ "node", "--max-http-header-size=16384", "src/app.js" ]
