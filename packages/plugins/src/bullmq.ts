import { startSpan, withSpan } from "@sysko/core";

export interface BullMQJob {
  id?: string;
  name: string;
  queueName: string;
  data: unknown;
}

export interface BullMQQueueLike {
  name: string;
  add(jobName: string, data: unknown, opts?: unknown): Promise<{ id?: string }>;
}

export function instrumentBullMQQueue(queue: BullMQQueueLike): void {
  const orig = queue.add.bind(queue);
  queue.add = async function (jobName: string, data: unknown, opts?: unknown) {
    const span = startSpan({
      kind: "queue.publish",
      name: `${queue.name} add`,
      attributes: { "queue.name": queue.name, "job.name": jobName },
    });
    try {
      const job = await orig(jobName, data, opts);
      if (job.id !== undefined) span.setAttribute("job.id", job.id);
      span.end();
      return job;
    } catch (err) {
      span.setStatus("error", err);
      span.end();
      throw err;
    }
  };
}

export function instrumentBullMQProcessor<T extends BullMQJob>(
  processor: (job: T) => Promise<void>,
): (job: T) => Promise<void> {
  return (job) =>
    withSpan(
      {
        kind: "queue.consume",
        name: `${job.queueName} process`,
        attributes: {
          "queue.name": job.queueName,
          "job.name": job.name,
          ...(job.id !== undefined ? { "job.id": job.id } : {}),
        },
      },
      () => processor(job),
    );
}
