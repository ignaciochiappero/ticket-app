import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { hashPassword } from '../auth/password.js';
import { User, type UserRole } from './user.schema.js';

// Demo credentials for a local seeded app, documented in the README. They protect nothing real.
export const DEMO_PASSWORD = 'ticket-demo';

interface SeededUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}

const SEEDED_USERS: SeededUser[] = [
  {
    id: 'requester-1',
    username: 'lucia.fernandez',
    name: 'Lucía Fernández',
    role: 'requester',
  },
  {
    id: 'requester-2',
    username: 'martin.gomez',
    name: 'Martín Gómez',
    role: 'requester',
  },
  {
    id: 'requester-3',
    username: 'sofia.diaz',
    name: 'Sofía Díaz',
    role: 'requester',
  },
  {
    id: 'requester-4',
    username: 'tomas.perez',
    name: 'Tomás Pérez',
    role: 'requester',
  },
  { id: 'agent-1', username: 'carla.ruiz', name: 'Carla Ruiz', role: 'agent' },
  {
    id: 'agent-2',
    username: 'diego.lopez',
    name: 'Diego López',
    role: 'agent',
  },
  {
    id: 'agent-3',
    username: 'valentina.torres',
    name: 'Valentina Torres',
    role: 'agent',
  },
  {
    id: 'agent-4',
    username: 'julian.romero',
    name: 'Julián Romero',
    role: 'agent',
  },
];

@Injectable()
export class UsersSeed implements OnApplicationBootstrap {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  // Fields are written with $set, so a restart also repairs users created by an older schema.
  // Only the hash is stored, and a new salt on every restart changes nothing for the user.
  async onApplicationBootstrap(): Promise<void> {
    const operations = await Promise.all(
      SEEDED_USERS.map(async ({ id, username, name, role }) => ({
        updateOne: {
          filter: { _id: id },
          update: {
            $set: {
              username,
              name,
              role,
              passwordHash: await hashPassword(DEMO_PASSWORD),
            },
          },
          upsert: true,
        },
      })),
    );
    await this.userModel.bulkWrite(operations);
    await this.userModel.createIndexes();
  }
}
