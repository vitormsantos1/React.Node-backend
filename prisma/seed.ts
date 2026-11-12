import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;
const adminName = process.env.ADMIN_NAME?.trim() || 'Administrador VetCare';

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL precisa estar configurada para executar a seed.',
  );
}

if (!adminEmail || !adminPassword) {
  throw new Error(
    'Configure ADMIN_EMAIL e ADMIN_PASSWORD para gerar o administrador.',
  );
}

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const passwordHash = bcrypt.hashSync(adminPassword!, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      password: passwordHash,
      role: Role.ADMIN,
    },
    create: {
      name: adminName,
      email: adminEmail!,
      password: passwordHash,
      role: Role.ADMIN,
    },
  });

  console.info('Conta de administrador criada ou atualizada.');
}

main()
  .catch(() => {
    console.error('Falha ao gerar a conta de administrador.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
