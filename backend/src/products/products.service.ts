import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./products.dto/create-product.dto";
import { MediaType } from "@prisma/client";
import * as fs from "fs";

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // Returns all products without their media (used for the dropdown lists in the Qt client)
  findAll() {
    return this.prisma.product.findMany();
  }

  // Returns a single product including its associated media records
  findById(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { media: true },
    });
  }

  // Creates a new product row from the validated DTO
  create(data: CreateProductDto) {
    return this.prisma.product.create({ data });
  }

  // Permanently deletes a product and its related records (media rows are
  // cascade-deleted by the DB constraint defined in schema.prisma)
  remove(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }

  // Deletes a single media record by ID.
  // Also removes the physical file from disk — if the file is already gone
  // the error is swallowed so the DB row is still cleaned up.
  async removeMedia(mediaId: string) {
    const media = await this.prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) throw new NotFoundException("Media not found");

    try {
      fs.unlinkSync(media.filepath); // Synchronous delete — filepath stored at upload time
    } catch {
      // File already gone from disk; continue to delete the DB row
    }

    return this.prisma.media.delete({ where: { id: mediaId } });
  }

  // Saves multiple uploaded files to the database inside a single transaction.
  // If any insert fails the whole batch is rolled back so the DB and disk
  // do not get out of sync.
  // mediaType is derived from the MIME type: anything starting with "video/"
  // is VIDEO, everything else is treated as IMAGE.
  addMediaBatch(productId: string, files: Express.Multer.File[]) {
    return this.prisma.$transaction(
      files.map((file) => {
        const mediaType: MediaType = file.mimetype.startsWith("video/")
          ? MediaType.VIDEO
          : MediaType.IMAGE;
        return this.prisma.media.create({
          data: {
            productId,
            filename: file.originalname,
            filepath: file.path,   // Relative path on the server (e.g. media/<productId>/timestamp-name.jpg)
            mimetype: file.mimetype,
            mediaType,
          },
        });
      }),
    );
  }
}
