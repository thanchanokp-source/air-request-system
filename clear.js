const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$connect().then(async () => {
  const logs = await p.approvalLog.deleteMany({});
  const reqs = await p.airRequest.deleteMany({});
  console.log('Deleted ApprovalLog:', logs.count);
  console.log('Deleted AirRequest:', reqs.count);
  await p.$disconnect();
}).catch(e => { console.error(e); process.exit(1); });
