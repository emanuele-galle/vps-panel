import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Achille347!', 10);

  const user = await prisma.user.update({
    where: { email: 'admin@vps-panel.local' },
    data: {
      email: 'emanuelegalle@gmail.com',
      name: 'Emanuele Galle',
      password: passwordHash,
    },
  });

  console.log('✅ Admin aggiornato:', user.email);

  // Verifica che non ci siano altri utenti
  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true }
  });

  console.log('Utenti totali:', allUsers.length);
  allUsers.forEach(u => console.log(`  - ${u.email} (${u.role})`));
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
