import { HttpException, HttpStatus } from '@nestjs/common';

export class RedisOperationException extends HttpException {
  constructor(
    message: string,
    public readonly originalError: unknown,
  ) {
    // Passes the message and a 500 status code to NestJS
    super(message, HttpStatus.INTERNAL_SERVER_ERROR);
    this.name = 'RedisOperationException';
  }
}
