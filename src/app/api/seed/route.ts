import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST() {
  try {
    const hash = await bcrypt.hash("password123", 10)

    const users = [
      { email: "mer@nanyang.com", name: "MER User", role: "MER_USER", password: hash },
      { email: "vp.mer@nanyang.com", name: "VP MER", role: "VP_MER", password: hash },
      { email: "scm@nanyang.com", name: "SCM User", role: "SCM_USER", password: hash },
      { email: "vp.scm@nanyang.com", name: "VP SCM", role: "VP_SCM", password: hash },
      { email: "president@nanyang.com", name: "President", role: "PRESIDENT", password: hash },
      { email: "logistics@nanyang.com", name: "Logistics", role: "LOGISTICS", password: hash },
      { email: "claim@nanyang.com", name: "Claim", role: "CLAIM", password: hash },
    ]

    for (const u of users) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: u
      })
    }

    const masters = [
      { name: "BRAND A" }, { name: "BRAND B" }, { name: "BRAND C" }
    ]
    for (const m of masters) {
      await prisma.masterBrand.upsert({ where: { name: m.name }, update: {}, create: m })
    }

    const bus = [
      { name: "BU SHIRT" }, { name: "BU PANTS" }, { name: "BU JACKET" }
    ]
    for (const b of bus) {
      await prisma.masterBU.upsert({ where: { name: b.name }, update: {}, create: b })
    }

    return NextResponse.json({ ok: true, message: "Seeded successfully" })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
