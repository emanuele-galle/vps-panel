export function wordpressTemplate(config: {
  projectSlug: string;
  projectName: string;
  port: number;
  dbPassword: string;
  previewDomain: string;
}) {
  return `version: '3.8'

networks:
  ${config.projectSlug}_network:
    driver: bridge
  traefik-public:
    external: true

volumes:
  ${config.projectSlug}_db:
  ${config.projectSlug}_wp:

services:
  wordpress:
    image: wordpress:latest
    container_name: ${config.projectSlug}_wordpress
    restart: unless-stopped
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_NAME: wordpress
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: ${config.dbPassword}
    volumes:
      - ${config.projectSlug}_wp:/var/www/html
      - ./uploads:/var/www/html/wp-content/uploads
    networks:
      - ${config.projectSlug}_network
      - traefik-public
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${config.projectSlug}.rule=Host(\`${config.projectSlug}.${config.previewDomain}\`)"
      - "traefik.http.routers.${config.projectSlug}.entrypoints=websecure"
      - "traefik.http.routers.${config.projectSlug}.tls.certresolver=letsencrypt"
      - "traefik.http.services.${config.projectSlug}.loadbalancer.server.port=80"
    depends_on:
      - db

  db:
    image: mysql:8.0
    container_name: ${config.projectSlug}_db
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: ${config.dbPassword}
      MYSQL_RANDOM_ROOT_PASSWORD: '1'
    volumes:
      - ${config.projectSlug}_db:/var/lib/mysql
      - ./backups:/backups
    networks:
      - ${config.projectSlug}_network
`;
}
