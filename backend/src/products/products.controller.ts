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
import { UseInterceptors, UploadedFiles } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as fs from "fs";
import * as path from "path";

@Controller("products")
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  // Public — returns all products (used by the Qt client to populate dropdowns)
  @Get()
  getAll() {
    return this.productsService.findAll();
  }

  // Public — returns a single product with all its fields
  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.productsService.findById(id);
  }

  // Public — returns only the media array for a given product
  @Get(":id/media")
  async getMedia(@Param("id") id: string) {
    const product = await this.productsService.findById(id);
    return product?.media;
  }

  // Admin only — creates a new product from the request body
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  // Admin only — uploads up to 20 files in one request for a given product.
  // FilesInterceptor handles the multipart parsing; diskStorage writes each
  // file to media/<productId>/ with a timestamp prefix to avoid name collisions.
  // The field name "files" must match what the Qt client sends in the multipart body.
  @Post(":id/media")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @UseInterceptors(
    FilesInterceptor("files", 20, {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          // Create the product-specific folder if it does not exist yet
          const dir = path.join("media", req.params.id as string);
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          // Prefix with timestamp so re-uploading the same filename never overwrites
          cb(null, `${Date.now()}-${file.originalname}`);
        },
      }),
    }),
  )
  uploadMedia(
    @Param("id") id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productsService.addMediaBatch(id, files);
  }

  // Admin only — deletes a media record and its file from disk
  @Delete(":id/media/:mediaId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  deleteMedia(
    @Param("mediaId") mediaId: string,
  ) {
    return this.productsService.removeMedia(mediaId);
  }

  // Admin only — deletes the product (media rows are cascade-deleted by the DB)
  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  remove(@Param("id") id: string) {
    return this.productsService.remove(id);
  }
}
