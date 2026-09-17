// The metadata every paginated response carries. Features extend this and add their own
// `items`, because OpenAPI has no generics: only a concrete class documents itself in Swagger.
export abstract class PaginatedDto {
  /**
   * Records matching the request across every page, not the number returned here.
   * Divide by the limit to know how many pages there are.
   * @example 42
   */
  total: number;

  /**
   * Page these items come from.
   * @example 1
   */
  page: number;

  /**
   * Page size used for this response.
   * @example 20
   */
  limit: number;
}
