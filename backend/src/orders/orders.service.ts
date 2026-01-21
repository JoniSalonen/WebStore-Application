import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto } from "./orders.dto/create-order.dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  createOrder(userId: number, items: CreateOrderDto[]) {
    return this.prisma.$transaction(async (prisma) => {
      let total = new Prisma.Decimal(0);

      const order = await prisma.order.create({
        data: {
          userId,
          total,
        },
      });

      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new BadRequestException(
            `Product with ID ${item.productId} does not exist.`,
          );
        }
        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ID ${item.productId}.`,
          );
        }

        total = total.add(product.price.mul(item.quantity));

        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            quatity: item.quantity,
            price: product.price,
          },
        });

        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { total },
        include: { items: true },
      });

      return order;
    });
  }

  // testing purpose only delete later
  async removeOrder(orderId: number) {
    await this.prisma.order.delete({
      where: { id: orderId },
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
