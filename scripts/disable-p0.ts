import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.league.updateMany({
    where: { priority: 0 },
    data: { enabled: false },
  });
  console.log("비활성화:", result.count, "개 리그");

  const active = await prisma.league.findMany({
    where: { enabled: true },
    orderBy: { priority: "desc" },
    select: { name: true, priority: true },
  });
  console.log("활성 리그:", active.length, "개");
  active.forEach((l) => console.log(" ", l.name, "- P" + l.priority));

  await prisma.$disconnect();
}

main();
