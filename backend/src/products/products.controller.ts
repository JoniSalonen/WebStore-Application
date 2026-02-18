import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Delete,
  UseGuards,
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./products.dto/create-product.dto";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { JwtAuthGuard } from "../auth/auth.guard";
import { UseInterceptors, UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as fs from "fs";
import * as path from "path";

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

  @Get(":id/media")
  getMedia(@Param("id") id: string) {
    return this.productsService.findById(id).media;
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  remove(@Param("id") id: string) {
    return this.productsService.remove(id);
  }
}
