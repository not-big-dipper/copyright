# use a node image as the base image and name it 'build' for
# later reference
FROM node:18.18-alpine3.18 as build

# set the working directory to /app
WORKDIR /app
# copy the current directory contents into the container at /app
COPY ./ /app
# install dependencies, matching package-lock.json
RUN npm ci
RUN npm i -g vite
CMD [ "vite", "--host", "0.0.0.0" ]