export class PersonDto {
  /**
   * User id, as returned by GET /users.
   * @example "agent-1"
   */
  id: string;

  /**
   * Display name, so the interface and these docs never show a bare id.
   * @example "Carla Ruiz"
   */
  name: string;
}
