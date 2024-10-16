#----------------------- base -----------------------

FROM registry.access.redhat.com/ubi9/ubi-minimal:9.4-1227.1726694542 AS base

RUN microdnf module enable -y nodejs:20 && \
    microdnf install -y shadow-utils jq nodejs --nodocs && \
    microdnf clean all

ENV APP_ROOT=/opt/app-root
WORKDIR $APP_ROOT
RUN mkdir -p $APP_ROOT/.npm/{_logs,_cacache} && chgrp -R 0 $APP_ROOT && chmod -R ug+rwX $APP_ROOT

RUN npm install -g npm@10.8.1

USER 1001

# make npm happy....
ENV HOME=$APP_ROOT

#---------------------- build -----------------------

FROM base AS build

COPY ./certs ./certs
COPY ./db ./db
COPY ./src ./src
COPY package.json package-lock.json .npmrc .cleanmodules jest.config.js gulpfile.js .sequelizerc ./

RUN npm ci
RUN npx clean-modules -y

RUN npm run build

#----------------------- test -----------------------

FROM base AS test

COPY --from=build $APP_ROOT/dist ./
COPY --from=build $APP_ROOT/test ./
COPY --from=build $APP_ROOT/node_modules ./node_modules

ENV NODE_ENV=test

CMD [ "sh", "-c", "npm run test:ci" ]

#----------------------- dist -----------------------

FROM base AS dist

COPY --from=build $APP_ROOT/dist ./

RUN npm ci --omit=dev && npm cache clean --force

EXPOSE 9002
ENV NODE_ENV=production

CMD [ "sh", "-c", "NODE_EXTRA_CA_CERTS=$(jq -r .tlsCAPath $ACG_CONFIG /dev/null) node --max-http-header-size=16384 src/app.js" ]
