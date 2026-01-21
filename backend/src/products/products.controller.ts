import { Controller, Get, Param, Post, Body, Delete } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./products.dto/create-producs.dto";

@Controller("products")
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  getAll() {
    return this.productsService.findAll();
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.productsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.productsService.remove(id);
  }
}
