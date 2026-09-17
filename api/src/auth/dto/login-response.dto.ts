export class LoginResponseDto {
  /**
   * Session token (JWT, valid for 8 hours). Send it on every other request as
   * `Authorization: Bearer <token>`, or paste it into the Authorize button to try
   * the protected endpoints from here. Ask GET /auth/me for the user it belongs to.
   * @example "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZ2VudC0xIiwicm9sZSI6ImFnZW50In0.signature"
   */
  token: string;
}
