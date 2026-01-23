import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto } from "./orders.dto/create-order.dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    // Get all products involved in the order
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: dto.items.map((i) => i.productId) },
      },
    });

    // calculate Total price
    let total = 0;

    const orderItemsData = dto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      total += product.price.toNumber() * item.quantity;

      return {
        productId: product.id,
        quantity: item.quantity,
        price: product.price,
      };
    });

    return this.prisma.order.create({
      data: {
        userId: Number(userId),
        total,
        items: {
          create: await Promise.all(
            dto.items.map(async (item) => {
              const product = await this.prisma.product.findUnique({
                where: { id: item.productId },
              });

              if (!product) throw new NotFoundException("Product not found");

              return {
                quantity: item.quantity,
                price: product.price.toNumber(),

                product: {
                  connect: { id: String(item.productId) },
                },
              };
            }),
          ),
        },
      },
      include: { items: true },
    });
  }

  // testing purpose only delete later
  async removeOrder(orderId: number) {
    await this.prisma.order.delete({
      where: { id: String(orderId) },
    });
  }

  async findByUser(userId: number) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
    });
  }

  async getAllOrders() {
    return this.prisma.order.findMany({
      include: { items: true },
    });
  }
}
