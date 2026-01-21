import { IsNumber, IsString, IsInt } from "class-validator";

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsNumber()
  price!: number;

  @IsInt()
  stock!: number;

  @IsString()
  brandName!: string;

  @IsString()
  category!: string;

  @IsString()
  subCategory!: string;

  // Adding imageUrl field back if needed in the future
  // @IsString()
  // imageUrl!: string;

  // Adding videoUrl field back if needed in the future
  // @IsString()
  // videoUrl!: string;

  @IsString()
  description!: string;
}
