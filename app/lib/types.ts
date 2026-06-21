export interface MockHeader {
  key: string;
  value: string;
  enabled: boolean;
}

export interface MockConfig {
  method: string;
  status: number;
  headers: MockHeader[];
  body: string;
  delay?: number; // In milliseconds
  isEncrypted?: boolean;
  queryParams?: MockParameter[];
}

export interface MockParameter {
  name: string;
  type: string; // "string" | "number" | "boolean"
  required: boolean;
  description: string;
  regex?: string;          // Regular expression pattern validation
  enums?: string;          // Comma-separated list of allowed values (enum)
  min?: number;            // Min length (string) or Min value (number)
  max?: number;            // Max length (string) or Max value (number)
  defaultValue?: string;   // Default value in UI/sandbox
}

export interface CollectionMock {
  id: string;
  name: string;
  path: string; // e.g. "/users"
  method: string;
  status: number;
  headers: MockHeader[];
  body: string;
  delay?: number;
  queryParams?: MockParameter[];
}

export interface MockCollection {
  name: string;
  description: string;
  mocks: CollectionMock[];
  isEncrypted?: boolean;
}
