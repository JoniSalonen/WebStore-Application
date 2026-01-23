import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardData() {
    const [userCount, productCount, orderCount, revenue] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.product.count(),
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        _sum: {
          total: true,
        },
      }),
    ]);

    return {
      userCount,
      productCount,
      orderCount,
      revenue: revenue._sum.total || 0,
    };
  }
}
