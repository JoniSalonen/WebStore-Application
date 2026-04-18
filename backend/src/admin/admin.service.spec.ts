import { Test, TestingModule } from "@nestjs/testing";
import { AdminService } from "./admin.service";
import { PrismaService } from "../prisma/prisma.service";
import { OrderStatus } from "@prisma/client";

const mockPrisma = {
  user: { count: jest.fn() },
  product: {
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  order: {
    count: jest.fn(),
    aggregate: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  orderItem: { findMany: jest.fn() },
};

describe("AdminService", () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  // ─── getDashboardData ─────────────────────────────────────────────────────

  describe("getDashboardData", () => {
    it("returns aggregated counts and revenue from parallel DB queries", async () => {
      mockPrisma.user.count.mockResolvedValue(5);
      mockPrisma.product.count.mockResolvedValue(10);
      // order.count is called 5 times in sequence inside Promise.all
      mockPrisma.order.count
        .mockResolvedValueOnce(3)  // orderCount (active)
        .mockResolvedValueOnce(1)  // pendingOrders
        .mockResolvedValueOnce(1)  // paidOrders
        .mockResolvedValueOnce(0)  // shippedOrders
        .mockResolvedValueOnce(1); // completedOrders
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { total: 250.0 } });

      const result = await service.getDashboardData();

      expect(result.userCount).toBe(5);
      expect(result.productCount).toBe(10);
      expect(result.orderCount).toBe(3);
      expect(result.revenue).toBe(250.0);
    });

    it("returns 0 revenue when _sum.total is null (no qualifying orders)", async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { total: null } });

      const result = await service.getDashboardData();

      expect(result.revenue).toBe(0);
    });
  });

  // ─── updateOrderStatus ────────────────────────────────────────────────────

  describe("updateOrderStatus", () => {
    const baseOrder = {
      id: "order-1",
      status: OrderStatus.PENDING,
      items: [{ productId: "prod-1", quantity: 2 }],
    };
    const baseProduct = { id: "prod-1", name: "Widget", stock: 10 };

    it("throws when the order is not found", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOrderStatus("order-1", OrderStatus.PAID),
      ).rejects.toThrow("Order not found");
    });

    it("returns the order unchanged when the target status already matches", async () => {
      const paidOrder = { ...baseOrder, status: OrderStatus.PAID };
      mockPrisma.order.findUnique.mockResolvedValue(paidOrder);

      const result = await service.updateOrderStatus("order-1", OrderStatus.PAID);

      expect(result).toBe(paidOrder);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it("decrements stock for each item when PENDING → PAID", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(baseOrder);
      mockPrisma.product.findUnique.mockResolvedValue(baseProduct);
      mockPrisma.product.update.mockResolvedValue({});
      mockPrisma.order.update.mockResolvedValue({
        ...baseOrder,
        status: OrderStatus.PAID,
      });

      await service.updateOrderStatus("order-1", OrderStatus.PAID);

      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: { stock: { decrement: 2 } },
      });
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: { status: OrderStatus.PAID },
      });
    });

    it("throws when stock is insufficient on PENDING → PAID", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(baseOrder);
      // Only 1 in stock but 2 are ordered
      mockPrisma.product.findUnique.mockResolvedValue({
        ...baseProduct,
        stock: 1,
      });

      await expect(
        service.updateOrderStatus("order-1", OrderStatus.PAID),
      ).rejects.toThrow("Not enough stock");
    });

    it("throws when a product is not found on PENDING → PAID", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(baseOrder);
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOrderStatus("order-1", OrderStatus.PAID),
      ).rejects.toThrow("Product not found");
    });

    it("increments stock for each item when PAID → CANCELLED", async () => {
      const paidOrder = { ...baseOrder, status: OrderStatus.PAID };
      mockPrisma.order.findUnique.mockResolvedValue(paidOrder);
      mockPrisma.product.update.mockResolvedValue({});
      mockPrisma.order.update.mockResolvedValue({
        ...paidOrder,
        status: OrderStatus.CANCELLED,
      });

      await service.updateOrderStatus("order-1", OrderStatus.CANCELLED);

      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: { stock: { increment: 2 } },
      });
    });

    it("updates status without touching stock for other transitions", async () => {
      const paidOrder = { ...baseOrder, status: OrderStatus.PAID };
      mockPrisma.order.findUnique.mockResolvedValue(paidOrder);
      mockPrisma.order.update.mockResolvedValue({
        ...paidOrder,
        status: OrderStatus.SHIPPED,
      });

      await service.updateOrderStatus("order-1", OrderStatus.SHIPPED);

      expect(mockPrisma.product.update).not.toHaveBeenCalled();
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: { status: OrderStatus.SHIPPED },
      });
    });
  });

  // ─── getSalesChartData ────────────────────────────────────────────────────

  describe("getSalesChartData", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Fix "now" to a known UTC date so date arithmetic is deterministic
      jest.setSystemTime(new Date("2025-01-08T12:00:00.000Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("returns one entry when range is 'today'", async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      const result = await service.getSalesChartData("today");

      expect(result).toHaveLength(1);
    });

    it("fills zero revenue/orders for days with no sales", async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      const result = await service.getSalesChartData("today");

      expect(result[0].revenue).toBe(0);
      expect(result[0].orders).toBe(0);
      expect(result[0].itemsSold).toBe(0);
    });

    it("accumulates revenue from multiple orders on the same day", async () => {
      // Mirror how the service computes startDate (local midnight), then place
      // orders 30 min into that same period so both the service cursor and the
      // order share the identical UTC date key regardless of the local timezone.
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const orderTime = new Date(startDate.getTime() + 30 * 60 * 1000);

      mockPrisma.order.findMany.mockResolvedValue([
        { total: 50, createdAt: orderTime, items: [{ quantity: 1 }] },
        { total: 75, createdAt: orderTime, items: [{ quantity: 2 }] },
      ]);

      const result = await service.getSalesChartData("today");

      const entry = result.find((e) => e.orders > 0);
      expect(entry).toBeDefined();
      expect(entry!.revenue).toBe(125);
      expect(entry!.orders).toBe(2);
      expect(entry!.itemsSold).toBe(3);
    });

    it("returns 8 entries for the 'week' range (7 days ago through today)", async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      const result = await service.getSalesChartData("week");

      // 2025-01-01 through 2025-01-08 = 8 days
      expect(result).toHaveLength(8);
    });
  });

  // ─── getLowStockProducts ──────────────────────────────────────────────────

  describe("getLowStockProducts", () => {
    it("uses threshold of 10 by default", async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      await service.getLowStockProducts();

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { stock: { lte: 10 } } }),
      );
    });

    it("uses the provided threshold", async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      await service.getLowStockProducts(3);

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { stock: { lte: 3 } } }),
      );
    });

    it("orders results by stock ascending so most critical items appear first", async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      await service.getLowStockProducts();

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { stock: "asc" } }),
      );
    });
  });
});
