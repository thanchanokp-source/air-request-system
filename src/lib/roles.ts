// A person can hold MANY roles (User.roles[]) while `role` stays the primary.
// Use these to match a role in Prisma `where` — checks primary role OR roles[].
//   findMany({ where: { isActive: true, ...roleOr("VP_SCM") } })
export const roleOr = (role: string) => ({ OR: [{ role }, { roles: { has: role } }] })
export const roleInOr = (roles: string[]) => ({ OR: [{ role: { in: roles } }, { roles: { hasSome: roles } }] })
