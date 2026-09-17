import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { UserDto } from './dto/user.dto.js';
import { User } from './user.schema.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async findAll(): Promise<UserDto[]> {
    const users = await this.userModel.find().sort({ role: -1, _id: 1 }).lean();
    return users.map(toUserDto);
  }

  async findById(id: string): Promise<UserDto | null> {
    const user = await this.userModel.findById(id).lean();
    return user ? toUserDto(user) : null;
  }
}

function toUserDto(user: User): UserDto {
  return { id: user._id, name: user.name, role: user.role };
}
