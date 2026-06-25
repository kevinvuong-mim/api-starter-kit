interface ErrorResponse {
  path: string;
  error: string;
  stack?: string; // Only in development
  success: false;
  message: string;
  timestamp: string;
  statusCode: number;
  errors?: ValidationError[];
}

interface SuccessResponse<T = any> {
  data?: T;
  path: string;
  message: string;
  success: boolean;
  timestamp: string;
  statusCode: number;
}

interface ValidationError {
  value?: any;
  field: string;
  message: string;
}

export type { ErrorResponse, SuccessResponse, ValidationError };
