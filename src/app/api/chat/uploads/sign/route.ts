import { handlePrivateUploadSign } from "@/server/private-media-http";

export async function POST(req: Request) {
  return handlePrivateUploadSign(req, "chat");
}
