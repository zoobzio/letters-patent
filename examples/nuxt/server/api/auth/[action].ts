import { bridge, createDemoProvider, schema } from "../../utils/demo";

/**
 * The one route file the module asks for: the auth actions under
 * `/api/auth/*`, over the stubbed provider constructed per request.
 */
export default defineAuthHandlers(schema, (event) =>
  createDemoProvider(schema, { event }, bridge),
);
