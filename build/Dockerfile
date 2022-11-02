
#----------------------- base -----------------------

FROM registry.redhat.io/ubi8/ubi-minimal:latest AS base

USER root

WORKDIR /opt/app-root/src

RUN microdnf module enable nodejs:16 && \
    microdnf install -y nodejs --nodocs && \
    microdnf clean all

#--------------------- packages ---------------------

FROM base AS packages

COPY package.json package-lock.json ./

#--------------------- dist (1) ---------------------

FROM packages AS dist

RUN npm ci --omit=dev

COPY . .

#----------------------- test -----------------------

FROM dist AS test

RUN npm ci

# add the test code...

ENV NODE_ENV=test

#--------------------- dist (2) ---------------------

FROM dist

USER 1001
EXPOSE 9002
ENV NODE_ENV=production
CMD [ "node", "--max-http-header-size=16384", "src/app.js" ]
