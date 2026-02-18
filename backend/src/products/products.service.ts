import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./products.dto/create-product.dto";

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.product.findMany();
  }

  findById(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { media: true },
    });
  }

  create(data: CreateProductDto) {
    return this.prisma.product.create({ data });
  }

  remove(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }
}
