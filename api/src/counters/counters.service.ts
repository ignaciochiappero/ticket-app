import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Counter } from './counter.schema.js';

@Injectable()
export class CountersService {
  constructor(
    @InjectModel(Counter.name) private readonly counterModel: Model<Counter>,
  ) {}

  /**
   * The next number in a named sequence, never handed to two callers at once.
   * MongoDB has no auto-increment, and reading the current value to write
   * value + 1 would give two simultaneous callers the same number. `$inc` is a
   * single atomic update, so the number it returns is that caller's alone.
   */
  async next(name: string): Promise<number> {
    const counter = await this.counterModel
      .findOneAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      )
      .lean();
    // upsert with returnDocument: 'after' always yields a document.
    return counter!.seq;
  }
}
