import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { PrismaService } from "../prisma/prisma.service";
import { MediaType } from "@prisma/client";
import * as fs from "fs";

// Keep all real fs functions but replace unlinkSync so tests never touch disk
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  unlinkSync: jest.fn(),
}));

const mockPrisma = {
  product: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  media: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  // Array-form transaction: just resolves all the passed promises
  $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) =>
    Promise.all(ops),
  ),
};

describe("ProductsService", () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
    // Re-apply the transaction implementation after clearAllMocks resets it
    mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
  });

  describe("findAll", () => {
    it("returns all products", async () => {
      const products = [{ id: "p1", name: "Widget" }];
      mockPrisma.product.findMany.mockResolvedValue(products);

      const result = await service.findAll();
      expect(result).toBe(products);
    });
  });

  describe("findById", () => {
    it("returns the product with its media when found", async () => {
      const product = { id: "p1", name: "Widget", media: [] };
      mockPrisma.product.findUnique.mockResolvedValue(product);

      const result = await service.findById("p1");
      expect(result).toBe(product);
      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: "p1" },
        include: { media: true },
      });
    });

    it("returns null when product does not exist", async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      const result = await service.findById("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("passes the DTO directly to prisma", async () => {
      const dto = {
        name: "Widget",
        price: 9.99,
        stock: 5,
        brandName: "ACME",
        category: "Tools",
        subCategory: "Hand Tools",
        description: "A fine widget",
      };
      const created = { id: "p1", ...dto };
      mockPrisma.product.create.mockResolvedValue(created);

      const result = await service.create(dto as any);
      expect(result).toBe(created);
      expect(mockPrisma.product.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe("remove", () => {
    it("deletes the product by id", async () => {
      const deleted = { id: "p1" };
      mockPrisma.product.delete.mockResolvedValue(deleted);

      const result = await service.remove("p1");
      expect(result).toBe(deleted);
      expect(mockPrisma.product.delete).toHaveBeenCalledWith({
        where: { id: "p1" },
      });
    });
  });

  describe("removeMedia", () => {
    it("throws NotFoundException when media record does not exist", async () => {
      mockPrisma.media.findUnique.mockResolvedValue(null);

      await expect(service.removeMedia("m1")).rejects.toThrow(NotFoundException);
    });

    it("deletes the file from disk and then the DB row", async () => {
      const media = {
        id: "m1",
        filepath: "media/p1/photo.jpg",
      };
      mockPrisma.media.findUnique.mockResolvedValue(media);
      mockPrisma.media.delete.mockResolvedValue(media);

      await service.removeMedia("m1");

      expect(fs.unlinkSync).toHaveBeenCalledWith("media/p1/photo.jpg");
      expect(mockPrisma.media.delete).toHaveBeenCalledWith({
        where: { id: "m1" },
      });
    });

    it("still deletes the DB row even when the file is already gone", async () => {
      const media = { id: "m1", filepath: "media/p1/missing.jpg" };
      mockPrisma.media.findUnique.mockResolvedValue(media);
      // Simulate the file not existing on disk
      (fs.unlinkSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error("ENOENT");
      });
      mockPrisma.media.delete.mockResolvedValue(media);

      // Should not throw
      await expect(service.removeMedia("m1")).resolves.toBeDefined();
      expect(mockPrisma.media.delete).toHaveBeenCalled();
    });
  });

  describe("addMediaBatch", () => {
    const makeFile = (
      name: string,
      mime: string,
    ): Express.Multer.File =>
      ({
        originalname: name,
        path: `media/p1/${name}`,
        mimetype: mime,
      }) as Express.Multer.File;

    it("creates one media row per file inside a transaction", async () => {
      const files = [makeFile("photo.jpg", "image/jpeg")];
      mockPrisma.media.create.mockResolvedValue({ id: "m1" });

      await service.addMediaBatch("p1", files);

      expect(mockPrisma.media.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("sets mediaType to IMAGE for image MIME types", async () => {
      const files = [makeFile("photo.png", "image/png")];
      mockPrisma.media.create.mockResolvedValue({ id: "m1" });

      await service.addMediaBatch("p1", files);

      expect(mockPrisma.media.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ mediaType: MediaType.IMAGE }),
      });
    });

    it("sets mediaType to VIDEO for video MIME types", async () => {
      const files = [makeFile("clip.mp4", "video/mp4")];
      mockPrisma.media.create.mockResolvedValue({ id: "m2" });

      await service.addMediaBatch("p1", files);

      expect(mockPrisma.media.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ mediaType: MediaType.VIDEO }),
      });
    });

    it("handles multiple files in a single transaction", async () => {
      const files = [
        makeFile("a.jpg", "image/jpeg"),
        makeFile("b.mp4", "video/mp4"),
      ];
      mockPrisma.media.create
        .mockResolvedValueOnce({ id: "m1" })
        .mockResolvedValueOnce({ id: "m2" });

      const result = await service.addMediaBatch("p1", files);

      expect(mockPrisma.media.create).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });
  });
});
