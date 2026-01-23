import { IsString, IsInt, IsNumber, Min, IsNotEmpty } from "class-validator";

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsInt()
  @Min(0)
  stock!: number;

  @IsString()
  @IsNotEmpty()
  brandName!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  subCategory!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;
}
