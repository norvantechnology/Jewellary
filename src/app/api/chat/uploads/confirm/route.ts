import { handlePrivateUploadConfirm } from "@/server/private-media-http";

export async function PUT(req: Request) {
  return handlePrivateUploadConfirm(req, "chat");
}

export async function POST(req: Request) {
  return handlePrivateUploadConfirm(req, "chat");
}
