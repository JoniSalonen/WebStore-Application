import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrderStatus } from "@prisma/client";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // Runs all dashboard queries in parallel with Promise.all to reduce response time.
  // Returns totals for users, products, orders broken down by status, and total revenue
  // from orders that are PAID, SHIPPED, or COMPLETED.
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
      // Active orders = anything that is not cancelled, shipped, or completed
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
      // Sum the `total` column for all revenue-generating statuses
      this.prisma.order.aggregate({
        where: {
          status: {
            in: [OrderStatus.COMPLETED, OrderStatus.SHIPPED, OrderStatus.PAID],
          },
        },
        _sum: { total: true },
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

  // Transitions an order to a new status with side-effects:
  //   PENDING → PAID    : decrements stock for every item in the order
  //   PAID → CANCELLED  : restores stock for every item
  // All other transitions just update the status column.
  async updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new Error("Order not found");

    const oldStatus = order.status;

    // No-op if the status is not actually changing
    if (oldStatus === status) return order;

    if (oldStatus === OrderStatus.PENDING && status === OrderStatus.PAID) {
      // Validate stock and decrement for each line item before confirming payment
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
          data: { stock: { decrement: item.quantity } },
        });
      }
    }

    if (oldStatus === OrderStatus.PAID && status === OrderStatus.CANCELLED) {
      // Restock all items when a paid order is cancelled
      for (const item of order.items) {
        await this.prisma.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: status as OrderStatus },
    });
  }

  // Returns aggregated sales totals (revenue, order count, items sold) for the
  // given time range. Only includes orders with a revenue-generating status.
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
        status: {
          in: [OrderStatus.PAID, OrderStatus.COMPLETED, OrderStatus.SHIPPED],
        },
        createdAt: { gte: startDate, lte: now },
      },
      select: {
        total: true,
        createdAt: true,
        items: { select: { quantity: true } },
      },
    });

    const totalRevenue = salesData.reduce((sum, order) => sum + order.total, 0);
    const totalOrders  = salesData.length;
    const totalItemsSold = salesData.reduce(
      (sum, item) =>
        sum + item.items.reduce((itemSum, i) => itemSum + i.quantity, 0),
      0,
    );

    return { range, from: startDate, to: now, totalRevenue, totalOrders, totalItemsSold };
  }

  // Returns a day-by-day breakdown of revenue, order count, and items sold
  // suitable for rendering the sales chart. Every date between startDate and
  // today is included even if there were no sales (revenue will be 0).
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
        startDate.setHours(0, 0, 0, 0);
    }

    const salesData = await this.prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.PAID, OrderStatus.COMPLETED, OrderStatus.SHIPPED],
        },
        createdAt: { gte: startDate },
      },
      select: {
        total: true,
        createdAt: true,
        items: { select: { quantity: true } },
      },
    });

    // Group orders by date string ("yyyy-MM-dd") for quick lookup
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
      dailyMap[date].orders  += 1;
      dailyMap[date].itemsSold += order.items.reduce(
        (itemSum, i) => itemSum + i.quantity, 0,
      );
    }

    // Walk every calendar day in the range so the chart has no gaps
    const result = [];
    const cursor = new Date(startDate);

    while (cursor <= now) {
      const dateKey = cursor.toISOString().split("T")[0];
      result.push({
        date:      dateKey,
        revenue:   dailyMap[dateKey]?.revenue   || 0,
        orders:    dailyMap[dateKey]?.orders    || 0,
        itemsSold: dailyMap[dateKey]?.itemsSold || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }

  // Returns the top-selling products ranked by total quantity sold within the
  // given time range. `limit` controls how many entries are returned.
  async getTopSellingProducts(range: string, limit: number) {
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
        startDate.setHours(0, 0, 0, 0);
    }

    // Fetch order items from qualifying orders within the date range
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          status: {
            in: [OrderStatus.PAID, OrderStatus.COMPLETED, OrderStatus.SHIPPED],
          },
          createdAt: { gte: startDate },
        },
      },
      include: { product: true },
    });

    // Aggregate quantity and revenue per product
    const productMap: Record<
      string,
      { productId: string; name: string; totalQuantity: number; totalRevenue: number }
    > = {};

    for (const item of items) {
      if (!productMap[item.productId]) {
        productMap[item.productId] = {
          productId: item.productId,
          name: item.product.name,
          totalQuantity: 0,
          totalRevenue: 0,
        };
      }
      productMap[item.productId].totalQuantity += item.quantity;
      productMap[item.productId].totalRevenue  += item.quantity * item.product.price.toNumber();
    }

    // Sort descending by quantity sold and return the top `limit` entries
    return Object.values(productMap)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, limit);
  }

  // Returns products whose stock is at or below the threshold (default 10),
  // ordered from lowest stock first — useful for restocking alerts.
  async getLowStockProducts(threshold = 10) {
    return this.prisma.product.findMany({
      where: { stock: { lte: threshold } },
      orderBy: { stock: "asc" },
      select: {
        id: true,
        name: true,
        stock: true,
        price: true,
        brandName: true,
        category: true,
      },
    });
  }
}
