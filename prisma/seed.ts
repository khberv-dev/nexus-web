import { PrismaClient, Role, OrderStatus, StageStatus, OnboardingStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { STAGE_ORDER } from "../src/lib/stage-constants";
import { hashPassword } from "../src/lib/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Demo password shared by all seeded users — login at /login with email + this password.
const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD ?? "Demo12345!";

async function main() {
  if (process.env.DEMO_SEED !== "1") {
    console.log("Seed skipped (empty DB). Set DEMO_SEED=1 for demo users/orders: npm run db:seed");
    return;
  }

  const password = await hashPassword(DEMO_PASSWORD);

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { password },
    create: {
      zitadelId: "admin-zitadel-id",
      email: "admin@example.com",
      role: Role.ADMIN,
      password,
    },
  });

  // Clients
  const client1 = await prisma.user.upsert({
    where: { email: "client1@example.com" },
    update: { password },
    create: {
      zitadelId: "client1-zitadel-id",
      email: "client1@example.com",
      role: Role.CLIENT,
      password,
    },
  });

  const client2 = await prisma.user.upsert({
    where: { email: "client2@example.com" },
    update: { password },
    create: {
      zitadelId: "client2-zitadel-id",
      email: "client2@example.com",
      role: Role.CLIENT,
      password,
    },
  });

  // Specialists
  const spec1 = await prisma.user.upsert({
    where: { email: "specialist1@example.com" },
    update: { password },
    create: {
      zitadelId: "spec1-zitadel-id",
      email: "specialist1@example.com",
      role: Role.SPECIALIST,
      password,
      specialistProfile: {
        create: {
          onboardingStatus: OnboardingStatus.ACTIVE,
          formData: { name: "Specialist One", portfolio: "https://portfolio.example.com" },
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "specialist2@example.com" },
    update: { password },
    create: {
      zitadelId: "spec2-zitadel-id",
      email: "specialist2@example.com",
      role: Role.SPECIALIST,
      password,
      specialistProfile: {
        create: {
          onboardingStatus: OnboardingStatus.PENDING,
          formData: { name: "Specialist Two", portfolio: "https://portfolio2.example.com" },
        },
      },
    },
  });

  // Order with stages
  const existingOrder = await prisma.order.findFirst({ where: { clientId: client1.id } });
  if (!existingOrder) {
    await prisma.order.create({
      data: {
        clientId: client1.id,
        specialistId: spec1.id,
        status: OrderStatus.ACTIVE,
        briefData: { style: "modern", rooms: ["living", "bedroom"], budget: 500000 },
        stages: {
          create: STAGE_ORDER.map((type, i) => ({
            type,
            status:
              i === 0
                ? StageStatus.AWAITING_PAYMENT
                : StageStatus.BLOCKED,
          })),
        },
      },
    });
  }

  console.log("Seed completed:", { admin: admin.email, client1: client1.email, client2: client2.email, spec1: spec1.email });
  console.log(`Demo password for all seeded users: ${DEMO_PASSWORD} (override with DEMO_SEED_PASSWORD)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
