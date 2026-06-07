import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { presignRequestBaseSchema, presignResponseSchema } from "./media.schema";
import {
  errorResponseSchema,
  validationErrorResponseSchema,
} from "../../lib/openapi";

const json = <T>(schema: T) => ({
  content: { "application/json": { schema } },
});

export function registerMediaOpenApi(registry: OpenAPIRegistry) {
  const PresignReq = registry.register("PresignRequest", presignRequestBaseSchema);
  const PresignRes = registry.register("PresignResponse", presignResponseSchema);

  registry.registerPath({
    method: "post",
    path: "/media/presign",
    tags: ["Media"],
    summary: "Get a presigned URL to upload media directly to storage",
    security: [{ bearerAuth: [] }],
    request: { body: json(PresignReq) },
    responses: {
      200: { description: "Presigned upload URL", ...json(PresignRes) },
      400: { description: "Validation error", ...json(validationErrorResponseSchema) },
      401: { description: "Unauthorized", ...json(errorResponseSchema) },
    },
  });
}
