import { NextRequest, NextResponse } from "next/server";
import { fetchCompanyFilms } from "@/lib/tmdb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const companyId = parseInt(id);
  if (isNaN(companyId)) return NextResponse.json([], { status: 400 });

  const page = parseInt(request.nextUrl.searchParams.get("page") ?? "1");
  return NextResponse.json(await fetchCompanyFilms(companyId, page));
}
