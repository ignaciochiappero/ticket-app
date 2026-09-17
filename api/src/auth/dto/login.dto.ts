import { IsString, Length } from 'class-validator';

export class LoginDto {
  /**
   * Username of a seeded user. See the README for the full list.
   * @example "carla.ruiz"
   */
  @IsString()
  @Length(1, 50)
  username: string;

  /**
   * The user's password. Seeded users share the demo password documented in the README.
   * @example "ticket-demo"
   */
  @IsString()
  @Length(1, 100)
  password: string;
}
