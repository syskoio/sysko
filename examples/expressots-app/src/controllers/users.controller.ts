import "reflect-metadata";
import type { Response } from "express";
import { withSpan } from "@sysko/core";
import { controller, Get, param, response } from "@expressots/adapter-express";

@controller("/users")
export class UserController {
  @Get("")
  listUsers(@response() res: Response): void {
    res.json([
      { id: 1, name: "alice" },
      { id: 2, name: "bob" },
    ]);
  }

  @Get("/:id")
  getUser(@param("id") id: string, @response() res: Response): void {
    res.json({ id, name: "alice" });
  }

  @Get("/:id/orders")
  async getUserOrders(@param("id") id: string, @response() res: Response): Promise<void> {
    const orders = await withSpan({ kind: "db.query", name: "orders.findByUser" }, async () => {
      await new Promise((r) => setTimeout(r, 25 + Math.random() * 20));
      return [
        { id: 1, item: "widget", total: 42 },
        { id: 2, item: "gadget", total: 99 },
      ];
    });
    res.json({ userId: id, orders });
  }
}
