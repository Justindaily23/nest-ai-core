import 'fastify';
import { MultipartFile } from '@fastify/multipart';

declare module 'fasitfy' {
  interface FasitfyRequest {
    /**
     * Checks if the incoming request content-type is multipart/form-data.
     */
    isMultipart(): boolean;

    /**
     * Parses the incoming multi-part request body streams and extracts the first available file part pointer.
     */
    file(): Promise<MultipartFile | undefined>;
  }
}
