#!/bin/bash

# Helper function per fixare catch blocks con error unknown
fix_error_unknown() {
  local file="$1"
  echo "Fixing $file..."
  
  # Pattern 1: error.message → error instanceof Error ? error.message : 'Unknown error'
  sudo sed -i "s/error\.message/error instanceof Error ? error.message : 'Unknown error'/g" "$file"
  
  # Pattern 2: err.message
  sudo sed -i "s/err\.message/err instanceof Error ? err.message : 'Unknown error'/g" "$file"
  
  # Pattern 3: e.message
  sudo sed -i "s/e\.message/e instanceof Error ? e.message : 'Unknown error'/g" "$file"
  
  # Pattern 4: error.stack
  sudo sed -i "s/error\.stack/error instanceof Error ? error.stack : String(error)/g" "$file"
  
  # Pattern 5: String(error) in logs
  sudo sed -i 's/logger\.error(`\([^`]*\)`, error);/logger.error(`\1`, error instanceof Error ? error.message : String(error));/g' "$file"
  sudo sed -i 's/logger\.error(`\([^`]*\)`, err);/logger.error(`\1`, err instanceof Error ? err.message : String(err));/g' "$file"
  sudo sed -i 's/logger\.error(`\([^`]*\)`, e);/logger.error(`\1`, e instanceof Error ? e.message : String(e));/g' "$file"
}

# Fix activity.service.ts
fix_error_unknown "src/modules/activity/activity.service.ts"

# Fix backup controllers
fix_error_unknown "src/modules/backup/backup.controller.ts"
fix_error_unknown "src/modules/backup/backup.service.ts"
fix_error_unknown "src/modules/backup/gdrive-backup.controller.ts"
fix_error_unknown "src/modules/backup/google-drive.service.ts"
fix_error_unknown "src/modules/backup/system-backup.controller.ts"

# Fix n8n
fix_error_unknown "src/modules/n8n/n8n.controller.ts"
fix_error_unknown "src/modules/n8n/n8n.service.ts"

# Fix optimization
fix_error_unknown "src/modules/optimization/optimization.controller.ts"
fix_error_unknown "src/modules/optimization/optimization.service.ts"

# Fix projects
fix_error_unknown "src/modules/projects/credentials.scheduler.ts"
fix_error_unknown "src/modules/projects/discovery.service.ts"
fix_error_unknown "src/modules/projects/projects.service.ts"

# Fix system-settings
fix_error_unknown "src/modules/system-settings/system-settings.controller.ts"

echo "Done fixing error unknown types!"

# Continue with more files
fix_error_unknown "src/modules/backup/system-backup.service.ts"
fix_error_unknown "src/modules/databases/databases.service.ts"
fix_error_unknown "src/modules/docker/docker.service.ts"
fix_error_unknown "src/modules/domains/domains.service.ts"
fix_error_unknown "src/modules/minio/minio.service.ts"
fix_error_unknown "src/modules/ssl/ssl.service.ts"
fix_error_unknown "src/modules/traefik/traefik.service.ts"
fix_error_unknown "src/modules/websocket/handlers/project.handler.ts"
fix_error_unknown "src/utils/exec.ts"
fix_error_unknown "src/utils/pm2.ts"

echo "Phase 2 done!"
