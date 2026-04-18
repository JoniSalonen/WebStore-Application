import { Test, TestingModule } from "@nestjs/testing";
import { UsersService } from "./users.service";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcrypt";

jest.mock("bcrypt");

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

describe("UsersService", () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();

    // Default: hashing returns a predictable value
    (bcrypt.hash as jest.Mock).mockResolvedValue("hashed_password");
  });

  describe("findAll", () => {
    it("returns all users", async () => {
      const users = [{ id: 1, email: "a@a.com" }];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await service.findAll();
      expect(result).toBe(users);
    });
  });

  describe("findByEmail", () => {
    it("returns the user for the given email", async () => {
      const user = { id: 1, email: "a@a.com" };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findByEmail("a@a.com");
      expect(result).toBe(user);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "a@a.com" },
      });
    });

    it("returns null when no user matches", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await service.findByEmail("nobody@test.com");
      expect(result).toBeNull();
    });
  });

  describe("createUser", () => {
    const dto = { name: "Alice", email: "alice@test.com", password: "secret" };

    it("hashes the password before storing", async () => {
      mockPrisma.user.create.mockResolvedValue({ id: 1, ...dto });

      await service.createUser(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith("secret", 10);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ password: "hashed_password" }),
      });
    });

    it("does not store the plain-text password", async () => {
      mockPrisma.user.create.mockResolvedValue({ id: 1, ...dto });

      await service.createUser(dto);

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.password).not.toBe("secret");
    });
  });

  describe("removeUser", () => {
    it("throws when the user does not exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.removeUser(999)).rejects.toThrow("User not found");
    });

    it("deletes and returns the user when found", async () => {
      const user = { id: 1, email: "a@a.com" };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.delete.mockResolvedValue(user);

      const result = await service.removeUser(1);
      expect(result).toBe(user);
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe("findAdmins", () => {
    it("queries only users with ADMIN role", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.findAdmins();

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { role: "ADMIN" },
      });
    });
  });

  describe("createAdminUser", () => {
    it("forces the role to ADMIN regardless of dto", async () => {
      const dto = { name: "Boss", email: "boss@test.com", password: "pass" };
      mockPrisma.user.create.mockResolvedValue({ id: 2, ...dto, role: "ADMIN" });

      await service.createAdminUser(dto);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ role: "ADMIN" }),
      });
    });
  });
});
