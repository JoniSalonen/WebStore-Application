import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Order, OrderStatus } from "@prisma/client";
import { from } from "rxjs";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardData() {
    const [
      userCount,
      productCount,
      orderCount,
      pendingOrders,
      paidOrders,
      shippedOrders,
      completedOrders,
      completedRevenue,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: "USER" } }),
      this.prisma.product.count(),
      this.prisma.order.count({
        where: {
          status: {
            notIn: [
              OrderStatus.CANCELLED,
              OrderStatus.SHIPPED,
              OrderStatus.COMPLETED,
            ],
          },
        },
      }),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      this.prisma.order.count({ where: { status: OrderStatus.PAID } }),
      this.prisma.order.count({ where: { status: OrderStatus.SHIPPED } }),
      this.prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
      this.prisma.order.aggregate({
        where: {
          status: {
            in: [OrderStatus.COMPLETED, OrderStatus.SHIPPED, OrderStatus.PAID],
          },
        },
        _sum: {
          total: true,
        },
      }),
    ]);

    return {
      userCount,
      productCount,
      orderCount,
      pendingOrders,
      paidOrders,
      shippedOrders,
      completedOrders,
      revenue: completedRevenue._sum.total ?? 0,
    };
  }

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    const oldStatus = order.status;

    if (oldStatus === status) {
      return order;
    }

    if (oldStatus === OrderStatus.PENDING && status === OrderStatus.PAID) {
      // Send confirmation email logic here
      for (const item of order.items) {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) throw new Error("Product not found");
        if (product.stock < item.quantity) {
          throw new Error(`Not enough stock for product ${product.name}`);
        }
        await this.prisma.product.update({
          where: { id: product.id },
          data: {
            stock: { decrement: item.quantity },
          },
        });
      }
    }

    if (oldStatus === OrderStatus.PAID && status === OrderStatus.CANCELLED) {
      // Restock products
      for (const item of order.items) {
        await this.prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
          },
        });
      }
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: status as OrderStatus },
    });
  }

  async getSalesData(range: "today" | "week" | "month" | "year") {
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "year":
        startDate.setFullYear(now.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    const salesData = await this.prisma.order.findMany({
      where: {
        status:
          OrderStatus.PAID || OrderStatus.COMPLETED || OrderStatus.SHIPPED,
        createdAt: {
          gte: startDate,
          lte: now,
        },
      },
      select: {
        total: true,
        createdAt: true,
        items: { select: { quantity: true } },
      },
    });

    const totalRevenue = salesData.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = salesData.length;
    const totalItemsSold = salesData.reduce(
      (sum, item) =>
        sum + item.items.reduce((itemSum, i) => itemSum + i.quantity, 0),
      0,
    );

    return {
      range,
      from: startDate,
      to: now,
      totalRevenue,
      totalOrders,
      totalItemsSold,
    };
  }

  async getSalesChartData(range: string) {
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;

      case "week":
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;

      case "month":
        startDate.setMonth(now.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "year":
        startDate.setFullYear(now.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;

      default:
        startDate.setHours(0, 0, 0, 0); // Earliest date
    }

    const salesData = await this.prisma.order.findMany({
      where: {
        status:
          OrderStatus.PAID || OrderStatus.COMPLETED || OrderStatus.SHIPPED,
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        total: true,
        createdAt: true,
        items: { select: { quantity: true } },
      },
    });

    const dailyMap: Record<
      string,
      { date: string; revenue: number; orders: number; itemsSold: number }
    > = {};

    for (const order of salesData) {
      const date = order.createdAt.toISOString().split("T")[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { date, revenue: 0, orders: 0, itemsSold: 0 };
      }

      dailyMap[date].revenue += order.total;
      dailyMap[date].orders += 1;
      dailyMap[date].itemsSold += order.items.reduce(
        (itemSum, i) => itemSum + i.quantity,
        0,
      );
    }
    const result = [];
    const cursor = new Date(startDate);

    while (cursor <= now) {
      const dateKey = cursor.toISOString().split("T")[0];

      result.push({
        date: dateKey,
        revenue: dailyMap[dateKey]?.revenue || 0,
        orders: dailyMap[dateKey]?.orders || 0,
        itemsSold: dailyMap[dateKey]?.itemsSold || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }
}
