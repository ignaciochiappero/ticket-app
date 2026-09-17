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

  /**
   * Every user's name by id, so a response can show "Lucía Fernández" instead
   * of `requester-1`. One query over the 8 seeded users: names are never
   * copied onto a ticket, so a renamed user cannot leave a stale one behind.
   */
  async namesById(): Promise<Map<string, string>> {
    const users = await this.userModel.find({}, { name: 1 }).lean();
    return new Map(users.map((user) => [user._id, user.name]));
  }

  // Returns the stored user, password hash included, so only the auth module compares passwords.
  async findByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).lean();
  }
}

function toUserDto(user: User): UserDto {
  return { id: user._id, name: user.name, role: user.role };
}
