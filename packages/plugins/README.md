# @syskoio/plugins

Framework and library integrations for [Sysko Observe](https://syskoio.dev). Each plugin is opt-in and imported individually — only pull in what you use.

## Install

```bash
npm install @syskoio/plugins
```

Requires `@syskoio/core` to be initialized first.

## Plugins

### Express

Extracts the parameterized route (`/users/:id` instead of `/users/42`):

```ts
import { instrumentExpress } from "@syskoio/plugins/express";
instrumentExpress(app);
```

### Fastify

```ts
import { instrumentFastify } from "@syskoio/plugins/fastify";
instrumentFastify(app);
```

### Prisma

Adds `db.query` child spans with operation, model, and duration:

```ts
import { instrumentPrisma } from "@syskoio/plugins/prisma";
instrumentPrisma(prisma);
```

### Redis (ioredis / redis)

```ts
import { instrumentRedis } from "@syskoio/plugins/redis";
instrumentRedis(client);
```

### Axios

```ts
import { instrumentAxios } from "@syskoio/plugins/axios";
instrumentAxios();
```

### BullMQ

```ts
import { instrumentBullMQ } from "@syskoio/plugins/bullmq";
instrumentBullMQ({ worker, queue });
```

### Mongoose

```ts
import { instrumentMongoose } from "@syskoio/plugins/mongoose";
instrumentMongoose();
```

### Sequelize

```ts
import { instrumentSequelize } from "@syskoio/plugins/sequelize";
instrumentSequelize(sequelize);
```

### TypeORM

```ts
import { instrumentTypeORM } from "@syskoio/plugins/typeorm";
instrumentTypeORM(dataSource);
```

### pg (node-postgres)

```ts
import { instrumentPgClient } from "@syskoio/plugins/pg";
instrumentPgClient(client);
```

## Docs

[syskoio.dev/docs/plugins](https://syskoio.dev/docs/plugins)
