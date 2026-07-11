export const MAX_SAFE_CENT = Number.MAX_SAFE_INTEGER;

declare const centBrand: unique symbol;
export type Cent = number & { readonly [centBrand]: 'Cent' };

declare const businessDateBrand: unique symbol;
export type BusinessDate = string & { readonly [businessDateBrand]: 'BusinessDate' };

export interface SuccessResponse<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface ErrorResponse {
  success: false;
  code: string;
  message: string;
  details: Record<string, unknown>;
  requestId: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export type {
  components as OpenApiComponents,
  operations as OpenApiOperations,
  paths as OpenApiPaths,
} from './openapi.generated.js';
