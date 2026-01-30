import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto } from "./orders.dto/create-order.dto";

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      // Fetch all products in the order at once
      const products = await tx.product.findMany({
        where: {
          id: { in: dto.items.map((i) => i.productId) },
        },
      });

      let total = 0;

      const orderItemsData = [];

      for (const item of dto.items) {
        const product = products.find((p) => p.id === item.productId);

        if (!product) {
          throw new NotFoundException(`Product not found: ${item.productId}`);
        }

        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Not enough stock for ${product.name}. Available: ${product.stock}`,
          );
        }

        // calculate total price
        total += product.price.toNumber() * item.quantity;

        // update stock
        await tx.product.update({
          where: { id: product.id },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        orderItemsData.push({
          quantity: item.quantity,
          price: product.price.toNumber(), // price at the time of order
          product: {
            connect: { id: product.id },
          },
        });
      }

      // Create order + items
      return tx.order.create({
        data: {
          userId: Number(userId),
          total,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
        },
      });
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
      include: {
        items: true,
      },
    });
  }

  async getAllOrders() {
    return this.prisma.order.findMany({
      include: { items: true },
    });
  }

  async getUserOrders(userId: number) {
    return this.prisma.order.findMany({
      where: {
        userId: Number(userId),
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}
