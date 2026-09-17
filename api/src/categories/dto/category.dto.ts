export class CategoryDto {
  /**
   * Category id. Use it in the path of PATCH and DELETE /categories/{id}.
   * @example "66e9b1f2a3c4d5e6f7a8b9c0"
   */
  id: string;

  /**
   * Category name, unique regardless of letter case.
   * @example "Hardware"
   */
  name: string;

  /**
   * True once a ticket used the category. Used categories can no longer be renamed or deleted.
   * @example false
   */
  used: boolean;
}
