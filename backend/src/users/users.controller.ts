import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  ParseIntPipe,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { User } from "@prisma/client";
import { CreateUserDto } from "./users.dto/create-user.dto";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get(":email")
  async getByEmail(@Param("email") email: string): Promise<User | null> {
    return this.usersService.findByEmail(email);
  }

  @Post()
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.createUser(dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number): Promise<User> {
    return this.usersService.removeUser(id);
  }

  @Post("admin")
  createAdmin(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.createAdminUser(dto);
  }

  @Get("admin")
  async getAdminUsers(): Promise<User[]> {
    return await this.usersService.findAdmins();
  }
}
