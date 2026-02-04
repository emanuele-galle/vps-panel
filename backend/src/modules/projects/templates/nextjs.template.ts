export function nextjsTemplate(config: {
  projectSlug: string;
  projectName: string;
  port: number;
  previewDomain: string;
}) {
  return `version: '3.8'

networks:
  traefik-public:
    external: true

services:
  app:
    image: node:20-alpine
    container_name: ${config.projectSlug}_app
    restart: unless-stopped
    working_dir: /app
    command: sh -c "npm install && npm run build && npm start"
    environment:
      NODE_ENV: production
      PORT: 3000
    volumes:
      - ./src:/app
      - /app/node_modules
      - /app/.next
    networks:
      - traefik-public
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${config.projectSlug}.rule=Host(\`${config.projectSlug}.${config.previewDomain}\`)"
      - "traefik.http.routers.${config.projectSlug}.entrypoints=websecure"
      - "traefik.http.routers.${config.projectSlug}.tls.certresolver=letsencrypt"
      - "traefik.http.services.${config.projectSlug}.loadbalancer.server.port=3000"
`;
}
