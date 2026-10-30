import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/web/auth";

export const { GET, POST } = toNextJsHandler((request: Request) => auth().handler(request));
