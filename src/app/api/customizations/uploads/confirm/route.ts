import { handlePrivateUploadConfirm } from "@/server/private-media-http";

export async function PUT(req: Request) {
  return handlePrivateUploadConfirm(req, "customizations");
}

export async function POST(req: Request) {
  return handlePrivateUploadConfirm(req, "customizations");
}
