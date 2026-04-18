import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { PrismaService } from "../prisma/prisma.service";

// The transaction mock calls the callback with the same mock prisma so
// tx.product.findMany etc. route back to the mocked methods below.
const mockPrisma = {
  product: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  order: {
    create: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe("OrdersService", () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();

    // Simulate the Prisma interactive transaction by calling the callback
    // with the same mock object so tx.* calls hit the mocked methods
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) =>
      cb(mockPrisma),
    );
  });

  describe("createOrder", () => {
    const dto = { items: [{ productId: "prod-1", quantity: 2 }] };
    const mockProduct = {
      id: "prod-1",
      name: "Widget",
      stock: 10,
      price: { toNumber: () => 15.0 },
    };

    it("throws NotFoundException when a product in the order does not exist", async () => {
      mockPrisma.product.findMany.mockResolvedValue([]); // returns empty — product not found

      await expect(service.createOrder(1, dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws BadRequestException when stock is insufficient", async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { ...mockProduct, stock: 1 }, // only 1 in stock but 2 ordered
      ]);

      await expect(service.createOrder(1, dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("creates the order and decrements stock on success", async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.product.update.mockResolvedValue({});
      mockPrisma.order.create.mockResolvedValue({
        id: "order-1",
        total: 30,
        items: [],
      });

      const result = await service.createOrder(1, dto as any);

      // Stock must be decremented
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: { stock: { decrement: 2 } },
      });

      // Order must be created with the correct total (2 × 15 = 30)
      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 1, total: 30 }),
        }),
      );

      expect(result.id).toBe("order-1");
    });

    it("calculates total correctly for multiple products", async () => {
      const dto2 = {
        items: [
          { productId: "prod-1", quantity: 2 }, // 2 × 15 = 30
          { productId: "prod-2", quantity: 3 }, // 3 × 10 = 30
        ],
      };
      const prod2 = {
        id: "prod-2",
        name: "Gadget",
        stock: 5,
        price: { toNumber: () => 10.0 },
      };
      mockPrisma.product.findMany.mockResolvedValue([mockProduct, prod2]);
      mockPrisma.product.update.mockResolvedValue({});
      mockPrisma.order.create.mockResolvedValue({ id: "order-2", total: 60, items: [] });

      await service.createOrder(1, dto2 as any);

      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ total: 60 }),
        }),
      );
    });
  });

  describe("removeOrder", () => {
    it("deletes the order by its UUID string", async () => {
      mockPrisma.order.delete.mockResolvedValue(undefined);

      await service.removeOrder("order-uuid-123");

      expect(mockPrisma.order.delete).toHaveBeenCalledWith({
        where: { id: "order-uuid-123" },
      });
    });
  });

  describe("findByUser", () => {
    it("returns orders belonging to the given user", async () => {
      const orders = [{ id: "o1", userId: 1 }];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      const result = await service.findByUser(1);

      expect(result).toBe(orders);
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1 } }),
      );
    });
  });

  describe("getAllOrders", () => {
    it("returns all orders including their items", async () => {
      const orders = [{ id: "o1" }, { id: "o2" }];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      const result = await service.getAllOrders();

      expect(result).toBe(orders);
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { items: true } }),
      );
    });
  });
});
