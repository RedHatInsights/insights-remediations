
#----------------------- base -----------------------

FROM registry.redhat.io/ubi8/ubi-minimal:latest AS base

WORKDIR /opt/app-root/src

RUN microdnf module enable nodejs:16 && \
    microdnf install -y nodejs --nodocs && \
    microdnf clean all

#--------------------- packages ---------------------

FROM base AS packages

COPY package.json package-lock.json ./

#----------------------- test -----------------------

FROM packages AS test

RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=test

#----------------------- dist -----------------------

FROM packages AS dist

RUN npm ci --omit=dev

COPY --from=test /opt/app-root/src ./

EXPOSE 9002
ENV NODE_ENV=production

CMD [ "node", "--max-http-header-size=16384", "src/app.js" ]
