import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  const action = req.nextUrl.searchParams.get("action")
  const APP_URL = process.env.APP_URL || "http://localhost:3000"

  if (!token || !action) {
    return NextResponse.redirect(`${APP_URL}/login?error=invalid`)
  }

  const request = await (prisma.airRequest as any).findFirst({
    where: { vpMerToken: token },
    include: { items: true }
  })

  if (!request) {
    return NextResponse.redirect(`${APP_URL}/login?error=expired`)
  }

  if (request.status !== "PENDING_VP_MER") {
    return NextResponse.redirect(`${APP_URL}/requests/${request.id}?msg=already_processed`)
  }

  if (action === "approve") {
    await prisma.airRequest.update({
      where: { id: request.id },
      data: {
        status: "PENDING_SCM",
        vpMerToken: null,
        items: {
          updateMany: {
            where: { itemStatus: "PENDING" },
            data: { itemStatus: "VP_MER_PASSED" }
          }
        }
      }
    })
    return NextResponse.redirect(`${APP_URL}/requests/${request.id}?msg=approved`)
  }

  if (action === "reject") {
    await prisma.airRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        vpMerToken: null,
        items: {
          updateMany: {
            where: { itemStatus: "PENDING" },
            data: { itemStatus: "REJECTED" }
          }
        }
      }
    })
    return NextResponse.redirect(`${APP_URL}/requests/${request.id}?msg=rejected`)
  }

  return NextResponse.redirect(`${APP_URL}/requests/${request.id}`)
}
