FROM registry.redhat.io/ubi8/nodejs-12


WORKDIR /opt/app-root/src

COPY package.json package-lock.json /opt/app-root/src/

RUN npm ci --only=production

COPY . /opt/app-root/src

EXPOSE 9002
ENV NODE_ENV=production
CMD [ "node", "--max-http-header-size=16384", "src/app.js" ]
