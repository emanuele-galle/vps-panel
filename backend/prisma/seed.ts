import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@vps-panel.local' },
    update: {},
    create: {
      email: 'admin@vps-panel.local',
      name: 'Admin User',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Created admin user:', admin.email);

  // Create default system settings
  const settings = [
    {
      key: 'panel_name',
      value: 'VPS Control Panel',
      description: 'Nome del pannello di controllo',
    },
    {
      key: 'panel_version',
      value: '1.0.0',
      description: 'Versione attuale del pannello',
    },
    {
      key: 'max_projects_per_user',
      value: '50',
      description: 'Numero massimo di progetti per utente',
    },
    {
      key: 'backup_retention_days',
      value: '30',
      description: 'Giorni di conservazione dei backup',
    },
    {
      key: 'metrics_retention_days',
      value: '90',
      description: 'Giorni di conservazione delle metriche',
    },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('✅ Created system settings');

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
