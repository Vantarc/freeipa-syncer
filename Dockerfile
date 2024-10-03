FROM node:22.9.0

COPY ./src /srv

WORKDIR /srv

RUN npm install

CMD node main.js