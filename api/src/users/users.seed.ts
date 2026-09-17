import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { User } from './user.schema.js';

const SEEDED_USERS: User[] = [
  { _id: 'requester-1', name: 'Lucía Fernández', role: 'requester' },
  { _id: 'requester-2', name: 'Martín Gómez', role: 'requester' },
  { _id: 'requester-3', name: 'Sofía Díaz', role: 'requester' },
  { _id: 'requester-4', name: 'Tomás Pérez', role: 'requester' },
  { _id: 'agent-1', name: 'Carla Ruiz', role: 'agent' },
  { _id: 'agent-2', name: 'Diego López', role: 'agent' },
  { _id: 'agent-3', name: 'Valentina Torres', role: 'agent' },
  { _id: 'agent-4', name: 'Julián Romero', role: 'agent' },
];

// Upsert with $setOnInsert: restarting the app never duplicates or overwrites users.
@Injectable()
export class UsersSeed implements OnApplicationBootstrap {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.userModel.bulkWrite(
      SEEDED_USERS.map(({ _id, name, role }) => ({
        updateOne: {
          filter: { _id },
          update: { $setOnInsert: { name, role } },
          upsert: true,
        },
      })),
    );
  }
}
