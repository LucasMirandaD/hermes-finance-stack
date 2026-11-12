export abstract class BaseError {
  abstract get message(): string;
}

export class GenericError extends BaseError {
  constructor(private readonly details: string = 'unexpected_error') {
    super();
  }
  get message(): string {
    return this.details;
  }
}

export class NotFound extends BaseError {
  constructor(private readonly object: string) {
    super();
  }
  get message(): string {
    return `${this.object} was not found`;
  }
}

export class InvalidOperation extends BaseError {
  constructor(private readonly error: string) {
    super();
  }
  get message(): string {
    return this.error;
  }
}

export class CouldNotCreate extends BaseError {
  constructor(
    private readonly modelName: string,
    private readonly error: string,
  ) {
    super();
  }
  get message(): string {
    return `Could not create ${this.modelName} caused by: ${this.error}`;
  }
}

export class CouldNotUpdate extends BaseError {
  constructor(
    private readonly modelName: string,
    private readonly error: string,
  ) {
    super();
  }
  get message(): string {
    return `Could not update ${this.modelName} caused by: ${this.error}`;
  }
}

export class CouldNotSave extends BaseError {
  constructor(
    private readonly modelName: string,
    private readonly error: string,
  ) {
    super();
  }
  get message(): string {
    return `Could not save ${this.modelName} caused by: ${this.error}`;
  }
}
