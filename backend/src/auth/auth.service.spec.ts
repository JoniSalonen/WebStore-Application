import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcrypt";

// Mock bcrypt so tests don't run the real (slow) hashing algorithm
jest.mock("bcrypt");

const mockPrisma = {
  user: { findUnique: jest.fn() },
};

const mockJwt = {
  sign: jest.fn().mockReturnValue("mock-jwt-token"),
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe("login", () => {
    const mockUser = {
      id: 1,
      email: "admin@test.com",
      password: "hashed_pass",
      role: "ADMIN",
    };

    it("throws UnauthorizedException when user does not exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login("nobody@test.com", "pass"))
        .rejects.toThrow(UnauthorizedException);
    });

    it("throws UnauthorizedException when password is wrong", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login("admin@test.com", "wrong"))
        .rejects.toThrow(UnauthorizedException);
    });

    it("returns an accessToken on valid credentials", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login("admin@test.com", "correct");

      expect(result).toEqual({ accessToken: "mock-jwt-token" });
      // Token payload must include sub, email and role
      expect(mockJwt.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });
  });
});
