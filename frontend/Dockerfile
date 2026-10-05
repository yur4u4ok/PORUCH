# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM deps AS build
COPY . .
ARG VITE_MAP_STYLE_URL
ARG VITE_DEFAULT_LOCALE=uk
ENV VITE_MAP_STYLE_URL=$VITE_MAP_STYLE_URL VITE_DEFAULT_LOCALE=$VITE_DEFAULT_LOCALE
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV BACKEND_UPSTREAM=http://backend:8000
EXPOSE 80
