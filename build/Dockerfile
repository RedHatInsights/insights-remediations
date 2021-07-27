FROM registry.redhat.io/ubi8/ubi-minimal:latest

WORKDIR /opt/app-root/src

RUN microdnf module enable nodejs:12 && microdnf install -y nodejs && microdnf clean all

COPY package.json package-lock.json /opt/app-root/src/

RUN npm ci --only=production

COPY . /opt/app-root/src

EXPOSE 9002
ENV NODE_ENV=production
CMD [ "node", "--max-http-header-size=16384", "src/app.js" ]
