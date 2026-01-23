import * as request from "supertest";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import * as bcrypt from "bcrypt";

describe("Products & auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    await prisma.product.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    const hashedPassword = await bcrypt.hash("userpass", 10);

    await prisma.user.create({
      data: {
        email: "user@example.com",
        password: hashedPassword,
        role: "USER",
      },
    });

    // Create test admin
    await prisma.user.create({
      data: {
        email: "admin@example.com",
        password: hashedPassword,
        role: "ADMIN",
      },
    });

    // Login user
    const userResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "user@example.com", password: "userpass" });

    userToken = userResponse.body.accessToken;

    // Login admin
    const adminResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@example.com", password: "userpass" });

    adminToken = adminResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /products - should return empty array", async () => {
    return request(app.getHttpServer())
      .get("/products")
      .expect(200)
      .expect(200, []);
  });

  it("POST /products - should fail for non-admin user", async () => {
    return request(app.getHttpServer())
      .post("/products")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ name: "Test Product", price: 100 })
      .expect(403);
  });

  it("POST /products - should create product for admin user", async () => {
    return request(app.getHttpServer())
      .post("/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Test Product",
        price: 100,
        stock: 10,
        brandName: "Test Brand",
        category: "Test Category",
        subCategory: "Test SubCategory",
        description: "This is a test product.",
      })
      .expect(201);
  });

  it("GET /products - should return array with one product", async () => {
    return request(app.getHttpServer())
      .get("/products")
      .expect(200)
      .expect((res) => {
        if (!Array.isArray(res.body) || res.body.length !== 1) {
          throw new Error("Response is not an array with one product");
        }
      });
  });

  it("DELETE /products/:id - should fail for non-admin user", async () => {
    const products = await prisma.product.findMany();
    const productId = products[0].id;
    return request(app.getHttpServer())
      .delete(`/products/${productId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .expect(403);
  });

  it("DELETE /products/:id - should delete product for admin user", async () => {
    const products = await prisma.product.findMany();
    const productId = products[0].id;
    return request(app.getHttpServer())
      .delete(`/products/${productId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });
});
