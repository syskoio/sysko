import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    prisma: "src/prisma.ts",
    express: "src/express.ts",
    fastify: "src/fastify.ts",
    redis: "src/redis.ts",
    axios: "src/axios.ts",
    bullmq: "src/bullmq.ts",
    mongoose: "src/mongoose.ts",
    sequelize: "src/sequelize.ts",
    typeorm: "src/typeorm.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
});
