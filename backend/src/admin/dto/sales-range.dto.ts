import { IsIn } from "class-validator";

export class SalesRangeDto {
  @IsIn(["today", "week", "month", "year"])
  range!: string;
}
